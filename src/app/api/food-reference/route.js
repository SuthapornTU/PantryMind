// GET /api/food-reference?q=... — ค้นหาใน food_reference สำหรับ autocomplete ตอนพิมพ์ชื่อของ
// (ใช้โชว์ปุ่มเลือกไวในฟอร์มเพิ่มสินค้า ตาม docs/ARCHITECTURE.md หัวข้อ 4)
import { query } from "@/lib/db";

export async function GET(req) {
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q) return Response.json({ items: [] });

  const result = await query(
    `SELECT name, category, icon FROM food_reference
     WHERE name ILIKE $1 OR $2 = ANY(aliases)
     ORDER BY name ASC LIMIT 8`,
    [`%${q}%`, q]
  );
  return Response.json({ items: result.rows });
}
