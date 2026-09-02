// /api/shopping-list — Core CRUD ของ shopping_list
// GET  -> รายการที่ status='pending' เรียงล่าสุดก่อน พร้อมเช็คว่ามีของชื่อเดียวกันในตู้อยู่แล้วไหม
// POST -> เพิ่มรายการใหม่ลง shopping list
import { query } from "@/lib/db";
import { DEMO_USER_ID } from "@/lib/demoUser";

export async function GET() {
  const result = await query(
    `SELECT sl.id, sl.item_name, sl.quantity, sl.status, sl.created_at,
            COALESCE(pi.already_have, false) AS already_have,
            COALESCE(pi.already_have_quantity, 0) AS already_have_quantity
     FROM shopping_list sl
     LEFT JOIN LATERAL (
       SELECT (COUNT(*) > 0) AS already_have, COALESCE(SUM(quantity), 0) AS already_have_quantity
       FROM pantry_items
       WHERE user_id = sl.user_id AND used_at IS NULL AND lower(name) = lower(sl.item_name)
     ) pi ON true
     WHERE sl.user_id = $1 AND sl.status = 'pending'
     ORDER BY sl.created_at DESC`,
    [DEMO_USER_ID]
  );
  return Response.json({ items: result.rows });
}

export async function POST(req) {
  const body = await req.json();
  const { itemName, quantity } = body;

  if (!itemName?.trim()) {
    return Response.json({ error: "ต้องระบุ itemName" }, { status: 400 });
  }

  const inserted = await query(
    `INSERT INTO shopping_list (user_id, item_name, quantity)
     VALUES ($1, $2, $3)
     RETURNING id, item_name, quantity, status, created_at`,
    [DEMO_USER_ID, itemName.trim(), quantity || 1]
  );

  return Response.json({ item: inserted.rows[0] }, { status: 201 });
}
