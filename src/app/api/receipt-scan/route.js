// POST /api/receipt-scan — แปลง "รูปใบเสร็จ → รายการสินค้าหลายชิ้น" ด้วย Gemini vision (multimodal)
// AI ใช้แค่ "แกะรายการ" เท่านั้น ห้ามตัดสินใจ/บันทึกอะไรแทนคน — ผลลัพธ์จากตรงนี้ต้องผ่านหน้า
// /add-item/receipt ให้ user ติ๊ก/แก้ไข/ยืนยันทีละรายการก่อนเขียนลง pantry_items จริงเสมอ
// (ไม่มีจุดไหน insert ตรงนี้เลย) — pattern การเรียก Gemini เดียวกับ src/app/api/vision-identify/route.js
import { CATEGORIES, CATEGORY_DEFAULT_STORAGE } from "@/lib/shared/constants";
import { resolveExpiryUI } from "@/lib/server/expiryEstimate";

const GENERIC_ERROR = "อ่านใบเสร็จไม่ออก ลองถ่ายใหม่หรือเพิ่มของทีละชิ้นแทนนะ";

export async function POST(req) {
  if (!process.env.GEMINI_API_KEY) {
    return Response.json(
      { error: "ยังไม่ได้ตั้งค่า AI สำหรับอ่านใบเสร็จ ลองเพิ่มของทีละชิ้นแทนนะ" },
      { status: 400 }
    );
  }

  const formData = await req.formData();
  const file = formData.get("image");
  if (!file || typeof file === "string") {
    return Response.json({ error: "ไม่พบไฟล์รูปภาพ" }, { status: 400 });
  }

  const imageBase64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const prompt = `นี่คือรูปใบเสร็จซื้อของ ให้แกะรายการสินค้าที่เป็นอาหาร/ของใช้ในครัวออกมาเท่านั้น (ห้ามเอา VAT, ส่วนลด, ยอดรวม, ชื่อร้าน, ค่าถุง มาด้วย) ตอบเป็น JSON array เท่านั้น ห้ามมีข้อความอื่น รูปแบบ: [{"name": "ชื่อภาษาไทยสั้นๆ", "category": "หนึ่งในนี้เท่านั้น: ${CATEGORIES.join(
    ", "
  )}", "quantity": ตัวเลขจำนวนชิ้น (ถ้าอ่านไม่ได้ให้ใส่ 1 — สำคัญ: quantity คือจำนวนชิ้น/แพ็คที่ซื้อ ไม่ใช่น้ำหนักหรือปริมาตร เช่น "หมูสับ 0.5 กก." หรือ "น้ำมันพืช 1 ลิตร" ให้ตอบ quantity เป็น 1 เสมอ ห้ามเอาตัวเลขน้ำหนัก/ปริมาตรมาใส่), "line_total_price": ราคารวมของบรรทัดนั้นตามที่พิมพ์บนใบเสร็จ ไม่ใช่ราคาต่อหน่วย (ถ้าอ่านไม่ได้ให้ใส่ null)}]`;

  let text = "";
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }, { inlineData: { mimeType: file.type, data: imageBase64 } }],
            },
          ],
        }),
      }
    );
    const data = await r.json();
    text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (!text) {
      console.error("[receipt-scan] Gemini ไม่ส่ง text กลับมา status:", r.status, "response:", JSON.stringify(data));
    }
  } catch (err) {
    console.error("[receipt-scan] เรียก Gemini ไม่สำเร็จ:", err);
    return Response.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  let parsed;
  try {
    const match = text.match(/\[[\s\S]*\]/);
    parsed = JSON.parse(match ? match[0] : text);
  } catch {
    return Response.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    return Response.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  // เช็ค Path A/B ล่วงหน้าให้แต่ละรายการเลย (ใช้ resolveExpiryUI ตัวเดียวกับ /api/expiry-estimate
  // ไม่เขียน logic ใหม่) โดยใช้ที่เก็บ default ตามหมวดหมู่ที่ AI ทายมา — user เปลี่ยนที่เก็บได้ในหน้ารีวิว
  // ซึ่งจะเรียก /api/expiry-estimate ซ้ำฝั่ง client อยู่แล้วตอนนั้น
  const items = [];
  for (const raw of parsed) {
    const name = typeof raw?.name === "string" ? raw.name.trim() : "";
    if (!name) continue;

    const category = CATEGORIES.includes(raw.category) ? raw.category : "อื่นๆ";
    // กันฝั่ง server เผื่อ AI ยังเผลอตอบน้ำหนัก/ปริมาตรมาเป็น quantity (เช่น 0.5 จาก "หมูสับ 0.5 กก.")
    // ทั้งที่ prompt สั่งห้ามแล้ว — ปัดเป็นจำนวนเต็มที่ใกล้ที่สุดและอย่างน้อย 1 เสมอ (ดู A6 ใน TASK_A_DATA.md)
    const quantityNum = Number(raw.quantity);
    const quantity = Number.isFinite(quantityNum) && quantityNum > 0 ? Math.max(1, Math.round(quantityNum)) : 1;
    const defaultStorage = CATEGORY_DEFAULT_STORAGE[category] || "fridge";

    // rule-based ล้วนๆ (arithmetic ธรรมดา ไม่ใช้ AI) — Gemini แค่อ่านราคารวมของบรรทัดตามที่พิมพ์บน
    // ใบเสร็จมาให้ (line_total_price) แปลงเป็นราคา/หน่วยเองตรงนี้เพื่อให้เข้ากับ schema pantry_items
    const lineTotalPriceNum = Number(raw.line_total_price);
    const lineTotalPrice =
      raw.line_total_price != null && Number.isFinite(lineTotalPriceNum) ? lineTotalPriceNum : null;
    const pricePerUnit = lineTotalPrice !== null ? lineTotalPrice / quantity : null;

    const expiryUI = await resolveExpiryUI({ foodName: name, storageLocation: defaultStorage });

    items.push({
      name,
      category,
      quantity,
      pricePerUnit,
      defaultStorage,
      expiryMode: expiryUI.mode,
      defaultDays: expiryUI.mode === "auto-fill" ? expiryUI.defaultDays : null,
      writeBackToReference: expiryUI.writeBackToReference,
    });
  }

  if (items.length === 0) {
    return Response.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  return Response.json({ items });
}
