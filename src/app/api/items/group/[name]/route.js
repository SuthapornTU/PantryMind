// GET /api/items/group/[name] — ทุกแถวของชื่อนี้ที่ยังอยู่ในตู้ (used_at IS NULL) สำหรับหน้ากลุ่ม
// /items/[name] (ดู B2/B5 ใน TASK_B_UI.md) พร้อม "คงเหลือของแถว" ที่คำนวณให้แล้ว
// (quantity − used_count − wasted_count) เรียงตามวันหมดอายุ ด่วนสุดอยู่บน (ล็อตเก่าไม่ถูกกลบ)
//
// user_id มาจาก getCurrentUserId() เท่านั้น (ดู TASK_E_AUTH.md E6)
import { query } from "@/lib/server/db";
import { getCurrentUserId } from "@/lib/server/currentUser";

export async function GET(req, { params }) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "ยังไม่ได้เข้าสู่ระบบ" }, { status: 401 });

  const { name } = await params;
  const storage = new URL(req.url).searchParams.get("storage");

  const conditions = ["user_id = $1", "used_at IS NULL", "name = $2"];
  const values = [userId, decodeURIComponent(name)];
  if (storage) {
    conditions.push(`storage_location = $3`);
    values.push(storage);
  }

  const result = await query(
    `SELECT id, name, category, storage_location, expiry_date, quantity, price_per_unit,
            used_count, wasted_count, open_fraction,
            (quantity - used_count - wasted_count) AS remaining
     FROM pantry_items
     WHERE ${conditions.join(" AND ")}
     ORDER BY expiry_date ASC`,
    values
  );

  const rows = result.rows
    .map((r) => ({ ...r, remaining: Number(r.remaining) }))
    .filter((r) => r.remaining > 0);

  const totalRemaining = rows.reduce((sum, r) => sum + r.remaining, 0);

  return Response.json({ name: decodeURIComponent(name), rows, totalRemaining });
}
