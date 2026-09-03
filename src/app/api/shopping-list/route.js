// /api/shopping-list — Core CRUD ของ shopping_list
// GET  -> รายการที่ status='pending' เรียงล่าสุดก่อน พร้อมเช็คว่ามีของชื่อเดียวกันในตู้อยู่แล้วไหม
//         + nudge เตือนถ้าของชิ้นนี้มักถูกทิ้งบ่อย (ดู src/lib/server/nudge.js)
// POST -> เพิ่มรายการใหม่ลง shopping list พร้อม nudge ของรายการที่เพิ่งเพิ่มกลับไปทันที
import { query } from "@/lib/server/db";
import { DEMO_USER_ID } from "@/lib/server/demoUser";
import { checkNudge } from "@/lib/server/nudge";

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

  const items = await Promise.all(
    result.rows.map(async (row) => ({
      ...row,
      nudge: await checkNudge(DEMO_USER_ID, row.item_name),
    }))
  );

  return Response.json({ items });
}

export async function POST(req) {
  const body = await req.json();
  const { itemName, quantity } = body;

  if (!itemName?.trim()) {
    return Response.json({ error: "ต้องระบุ itemName" }, { status: 400 });
  }

  const name = itemName.trim();
  const inserted = await query(
    `INSERT INTO shopping_list (user_id, item_name, quantity)
     VALUES ($1, $2, $3)
     RETURNING id, item_name, quantity, status, created_at`,
    [DEMO_USER_ID, name, quantity || 1]
  );

  const nudge = await checkNudge(DEMO_USER_ID, name);

  return Response.json({ item: inserted.rows[0], nudge }, { status: 201 });
}
