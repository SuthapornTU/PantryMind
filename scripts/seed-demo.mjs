// scripts/seed-demo.mjs — ใส่ราคาสมจริง + ประวัติของที่ทิ้งย้อนหลัง 2 เดือนให้ user_id=2 (บัญชีเดโม)
// เท่านั้น (ห้ามแตะ user_id=1 ซึ่งเป็นบัญชีทดสอบจริง — ดู D7 ใน TASK_D_GOALS.md)
//
// เหตุผล: ข้อมูลจริงตอนนี้ user_id=2 ทิ้งแค่ ~35 บาท/เดือน (เพราะของหลายชิ้นไม่มีราคา/ไม่มีแถว
// pantry_items ให้ join เจอราคาแล้ว) ตั้งเป้า 250 บาทแล้วผ่านตั้งแต่วันแรก ฟีเจอร์ "เป้าหมายของฉัน"
// จะดูไม่ออกเลยตอนสาธิต — สคริปต์นี้ทำให้ยอดขึ้นมาราว 300-400 บาท/เดือน ย้อนหลัง 2 เดือน (เดือนก่อน
// เดือนปัจจุบันทั้งคู่) โดยสร้างแถว pantry_items "ปิดแล้ว" (used_at ตั้งไว้) ของแต่ละเดือนเอง ผูก
// item_events(item_id=...) แบบใหม่ตาม TASK_A_DATA.md A3/A4 (ไม่ใช้ waste_fraction แบบเก่า)
//
// รันซ้ำได้ปลอดภัย (idempotent) — เช็คด้วย (user_id, name, added_at) ก่อน insert ทุกครั้ง ถ้าเจอแล้ว
// ข้าม ไม่สร้างซ้ำ
//
// รัน: node scripts/seed-demo.mjs (ต้องมี .env.local ตั้ง DATABASE_URL ไว้แล้ว)
import { readFileSync, existsSync } from "node:fs";
import { Pool } from "pg";

function loadEnvLocal() {
  if (!existsSync(".env.local")) return;
  const text = readFileSync(".env.local", "utf-8");
  for (const line of text.split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
loadEnvLocal();

const DEMO_USER_ID = 2; // ห้ามใช้ 1 เด็ดขาด — นั่นคือบัญชีทดสอบจริง

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// ราคาสมจริงตามที่ TASK_D_GOALS.md ให้ตัวอย่างไว้ (ผัก 40 / เนื้อหมู 120 / นม 60 / ไข่ 6 ฟอง 45 = 7.5/ฟอง)
const REALISTIC_PRICES = {
  "ผักกาดขาว": 40,
  "เนื้อหมู": 120,
  "นมสด": 60,
  "ไข่ไก่": 7.5,
};

// ประวัติของที่ทิ้งย้อนหลัง 2 เดือน (เดือนก่อนหน้าเดือนปัจจุบันทั้งคู่) รวมกันเดือนละ ~350 บาท
// (อยู่ในช่วง 300-400 ที่ต้องการ) — แต่ละแถวคือ 1 "ล็อต" ที่ปิดไปแล้ว (used_at ตั้งไว้)
function buildMonthPlan(monthsAgo) {
  const now = new Date();
  const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo, 5));
  const addedAt = base.toISOString().slice(0, 10);
  const wastedAt = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 10));

  return [
    { name: "ผักกาดขาว", category: "ผัก/ผลไม้", storage: "fridge", quantity: 3, wastedUnits: 2 },
    { name: "เนื้อหมู", category: "เนื้อสัตว์", storage: "fridge", quantity: 2, wastedUnits: 1.5 },
    { name: "นมสด", category: "นม/ไข่", storage: "fridge", quantity: 1, wastedUnits: 1 },
    { name: "ไข่ไก่", category: "นม/ไข่", storage: "fridge", quantity: 6, wastedUnits: 4 },
  ].map((row) => ({ ...row, addedAt, wastedAt, price: REALISTIC_PRICES[row.name] }));
}

async function upsertRealisticPriceOnActiveItems() {
  // อัปเดตของที่ยังอยู่ในตู้ (used_at IS NULL) ของ user_id=2 ให้มีราคาสมจริงด้วย เผื่อสาธิตหน้าอื่น
  // (หน้าแรก/รายการของ) ไม่ใช่แค่ตัวเลขสถิติย้อนหลังอย่างเดียว
  for (const [name, price] of Object.entries(REALISTIC_PRICES)) {
    const result = await pool.query(
      `UPDATE pantry_items SET price_per_unit = $1
       WHERE user_id = $2 AND name = $3 AND used_at IS NULL`,
      [price, DEMO_USER_ID, name]
    );
    if (result.rowCount > 0) {
      console.log(`อัปเดตราคาของที่ยังอยู่ในตู้ "${name}" เป็น ${price} บาท/หน่วย (${result.rowCount} แถว)`);
    }
  }
}

async function seedMonthHistory(monthsAgo) {
  const plan = buildMonthPlan(monthsAgo);
  let monthTotal = 0;

  for (const row of plan) {
    const existing = await pool.query(
      `SELECT id FROM pantry_items WHERE user_id = $1 AND name = $2 AND added_at = $3`,
      [DEMO_USER_ID, row.name, row.addedAt]
    );
    if (existing.rows.length > 0) {
      console.log(`ข้าม "${row.name}" (${row.addedAt}) — มีอยู่แล้ว`);
      monthTotal += row.price * row.wastedUnits;
      continue;
    }

    const inserted = await pool.query(
      `INSERT INTO pantry_items
         (user_id, name, category, storage_location, expiry_date, quantity, price_per_unit,
          added_at, used_at, wasted_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        DEMO_USER_ID,
        row.name,
        row.category,
        row.storage,
        row.wastedAt.toISOString().slice(0, 10),
        row.quantity,
        row.price,
        row.addedAt,
        row.wastedAt,
        row.wastedUnits,
      ]
    );
    const itemId = inserted.rows[0].id;

    await pool.query(
      `INSERT INTO item_events (user_id, item_id, item_name, event_type, wasted_units, waste_reason_category, created_at)
       VALUES ($1, $2, $3, 'expired_unwanted', $4, 'อื่นๆ', $5)`,
      [DEMO_USER_ID, itemId, row.name, row.wastedUnits, row.wastedAt]
    );

    console.log(`เพิ่มประวัติ "${row.name}" ทิ้ง ${row.wastedUnits} หน่วย × ${row.price} บาท = ${row.wastedUnits * row.price} บาท (${row.addedAt})`);
    monthTotal += row.price * row.wastedUnits;
  }

  return monthTotal;
}

async function main() {
  console.log(`Seeding ข้อมูลเดโมให้ user_id = ${DEMO_USER_ID} เท่านั้น (ไม่แตะ user_id = 1)`);

  await upsertRealisticPriceOnActiveItems();

  const lastMonthTotal = await seedMonthHistory(1);
  const twoMonthsAgoTotal = await seedMonthHistory(2);

  console.log(`\nยอดทิ้งเดือนที่แล้ว (จำลอง): ${lastMonthTotal} บาท`);
  console.log(`ยอดทิ้งสองเดือนก่อน (จำลอง): ${twoMonthsAgoTotal} บาท`);
  console.log("เสร็จแล้ว");

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
