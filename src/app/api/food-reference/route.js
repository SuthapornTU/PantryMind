// GET /api/food-reference?q=... — ค้นหาใน food_reference สำหรับ autocomplete ตอนพิมพ์ชื่อของ
// (ใช้โชว์ปุ่มเลือกไวในฟอร์มเพิ่มสินค้า) — ไม่ใส่ q มาเลย คืนลิสต์เต็มเรียงตามหมวดหมู่ (สำหรับหน้า
// เลือกจากลิสต์ src/app/add-item/browse/page.js ที่โชว์ของทั้งหมดแยกตามหมวดหมู่ตั้งแต่เปิดหน้า)
// ผู้เรียกเดิม (add-item/page.js) ไม่เคยเรียกตอน q ว่างอยู่แล้ว (เช็ค name.trim() ก่อนเสมอ) จึงไม่กระทบ
import { query } from "@/lib/db";

export async function GET(req) {
  const q = new URL(req.url).searchParams.get("q")?.trim();

  const result = q
    ? await query(
        `SELECT name, category, icon FROM food_reference
         WHERE name ILIKE $1 OR $2 = ANY(aliases)
         ORDER BY name ASC LIMIT 8`,
        [`%${q}%`, q]
      )
    : await query(`SELECT name, category, icon FROM food_reference ORDER BY category ASC, name ASC`);

  return Response.json({ items: result.rows });
}
