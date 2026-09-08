// GET /api/barcode-lookup?code=8850124021001 — แปลง "เลขบาร์โค้ด → ชื่อ+หมวดหมู่" สำหรับ tab
// "สแกนบาร์โค้ด" ใน src/app/add-item/camera/page.js (ตัวเลขได้จากการถอดรหัสในเบราว์เซอร์ด้วย
// @zxing/browser ฝั่ง client แล้ว — เส้นนี้แค่รับเลขที่ถอดได้แล้วไปหาชื่อสินค้า ไม่ได้ทำ image processing เอง)
//
// ลำดับการหา (เร็ว → ช้า, ฟรี → ฟรี):
//   1) food_reference.barcode ในฐานเราเอง (เคยสแกน/ผูกไว้แล้ว) — เจอก็จบ ไม่ต้องออกเน็ต
//   2) Open Food Facts (https://world.openfoodfacts.org) — ฐานข้อมูลสินค้าสาธารณะ ฟรี ไม่ต้อง API key
//      ครอบคลุมสินค้าไทยพอสมควร (คนทั่วโลกช่วยกันเพิ่ม) — เจอแล้ว "เขียนกลับ" ใส่ food_reference ทันที
//      (upsert ด้วย barcode) เพื่อให้สแกนเลขเดิมครั้งหน้าไม่ต้องออกเน็ตอีก — pattern เดียวกับ
//      writeBackToReference ที่ /api/expiry-estimate ทำอยู่แล้ว
//   3) ไม่เจอทั้งคู่ → คืน 404 พร้อมข้อความ ให้หน้า camera พาไปพิมพ์เองที่ /add-item (เหมือน vision-identify
//      ตอนทายรูปไม่ออก) — ไม่มีจุดไหนเดา/แต่งชื่อสินค้าขึ้นมาเองเด็ดขาด
//
// เหมือนฟีเจอร์ scan อื่นๆ ในแอปนี้ทั้งหมด: ผลลัพธ์จากตรงนี้แค่ "prefill" ฟอร์ม /add-item เท่านั้น
// user ต้องตรวจสอบ/แก้ไข/กดบันทึกเองเสมอ ไม่มีอะไรถูกเขียนลง pantry_items จากเส้นนี้โดยตรง
import { query } from "@/lib/server/db";
import { CATEGORIES } from "@/lib/shared/constants";

const NOT_FOUND_MSG = "ไม่พบสินค้านี้ในฐานข้อมูล ลองพิมพ์ชื่อเองก่อนนะ";

// Open Food Facts ไม่มีหมวดหมู่ตรงกับ CATEGORIES ของเราเป๊ะๆ — เดาแบบหยาบๆ จาก category_tags/keywords
// ที่ Open Food Facts ให้มา เผื่อช่วย prefill หมวดหมู่ได้บ้าง (user แก้ไขเองได้เสมออยู่แล้วในฟอร์ม)
function guessCategory(product) {
  const haystack = [
    ...(product.categories_tags || []),
    ...(product.categories?.split(",") || []),
  ]
    .join(" ")
    .toLowerCase();

  const rules = [
    { keys: ["milk", "dairy", "egg", "cheese", "yogurt", "yoghurt"], category: "นม/ไข่" },
    { keys: ["meat", "chicken", "pork", "beef", "fish", "seafood"], category: "เนื้อสัตว์" },
    { keys: ["vegetable", "fruit", "produce"], category: "ผัก/ผลไม้" },
    { keys: ["bread", "bakery", "cake", "pastry"], category: "เบเกอรี่" },
    { keys: ["beverage", "drink", "juice", "soda", "water", "coffee", "tea"], category: "เครื่องดื่ม" },
    { keys: ["sauce", "condiment", "spice", "seasoning", "snack", "instant", "canned", "dried"], category: "ของแห้ง/เครื่องปรุง" },
  ];
  for (const rule of rules) {
    if (rule.keys.some((k) => haystack.includes(k))) return rule.category;
  }
  return null;
}

export async function GET(req) {
  const code = new URL(req.url).searchParams.get("code")?.trim();
  if (!code) {
    return Response.json({ error: "ไม่พบเลขบาร์โค้ด" }, { status: 400 });
  }

  // 1) เช็คในฐานเราเองก่อนเสมอ — ครอบ try/catch เพราะถ้า query พัง (เช่น ยังไม่ได้รัน migration
  // 0007_barcode.sql กับฐานจริง คอลัมน์ barcode จะยังไม่มี) ต้องคืน JSON error ที่อ่านได้เสมอ ไม่ปล่อยให้
  // Next.js ตกไปคืน error page เปล่าๆ ที่ฝั่ง client เอาไป res.json() ไม่ได้ ("Unexpected end of JSON input")
  let local;
  try {
    local = await query(
      `SELECT name, category FROM food_reference WHERE barcode = $1 LIMIT 1`,
      [code]
    );
  } catch (err) {
    console.error("[barcode-lookup] เช็คฐานข้อมูลตัวเองไม่สำเร็จ:", err);
    return Response.json(
      { error: "เชื่อมต่อฐานข้อมูลไม่ได้ ลองรัน migration supabase/migrations/0007_barcode.sql กับฐานจริงหรือยัง?" },
      { status: 500 }
    );
  }
  if (local.rows.length > 0) {
    return Response.json({ name: local.rows[0].name, category: local.rows[0].category, source: "local" });
  }

  // 2) ไม่เจอในฐานเราเอง → ลองถาม Open Food Facts (สาธารณะ ฟรี ไม่ต้อง key)
  let product = null;
  try {
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`, {
      headers: { "User-Agent": "PantryMind/1.0 (household food-waste app)" },
    });
    if (r.ok) {
      const data = await r.json();
      if (data.status === 1 && data.product) product = data.product;
    }
  } catch (err) {
    console.error("[barcode-lookup] เรียก Open Food Facts ไม่สำเร็จ:", err);
    // ออกเน็ตไม่ได้/ฐานข้อมูลนอกล่ม ไม่ถือเป็น error ร้ายแรง — ปล่อยให้ตกไป "ไม่เจอ" ข้างล่างแทน
  }

  if (!product) {
    return Response.json({ error: NOT_FOUND_MSG }, { status: 404 });
  }

  const name = (product.product_name_th || product.product_name || "").trim();
  if (!name) {
    return Response.json({ error: NOT_FOUND_MSG }, { status: 404 });
  }

  const guessed = guessCategory(product);
  const category = CATEGORIES.includes(guessed) ? guessed : null;

  // เขียนกลับเข้า food_reference ไว้ใช้ครั้งหน้า (upsert ด้วยชื่อ — ถ้าชื่อนี้มีอยู่แล้วแค่ผูกบาร์โค้ดเพิ่ม
  // เข้าไป, ถ้ายังไม่มีเลยสร้างแถวใหม่แบบไม่รู้อายุการเก็บ — /api/expiry-estimate จะใช้ path B ปกติ
  // ตอนถัดไปที่เจอชื่อนี้ผ่านฟอร์ม add-item) — พังก็ไม่เป็นไร ไม่ block การ prefill ฟอร์มของ user
  try {
    await query(
      `INSERT INTO food_reference (name, category, barcode)
       VALUES ($1, $2, $3)
       ON CONFLICT (name) DO UPDATE SET barcode = EXCLUDED.barcode WHERE food_reference.barcode IS NULL`,
      [name, category || "อื่นๆ", code]
    );
  } catch (err) {
    console.error("[barcode-lookup] เขียนกลับ food_reference ไม่สำเร็จ (ไม่กระทบผลลัพธ์ที่ส่งกลับ):", err);
  }

  return Response.json({ name, category, source: "openfoodfacts" });
}
