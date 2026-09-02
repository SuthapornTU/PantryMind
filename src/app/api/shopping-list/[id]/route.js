// /api/shopping-list/[id]
// PATCH { action: "bought" } -> mark ว่า "ซื้อแล้ว" — ไม่แตะ item_events/pantry_items
// เขียนลง status='checked' (ไม่ใช่ 'bought') เพราะตาราง shopping_list ที่มีอยู่จริงมี CHECK
// constraint อนุญาตแค่ 'pending'/'checked' เท่านั้น — action ฝั่ง API ยังคงชื่อ "bought" ตามที่ตกลง
// ไว้ (ความหมายเดียวกัน แค่ค่าที่เขียนจริงลง DB ต่างจากชื่อ action)
import { query } from "@/lib/server/db";
import { DEMO_USER_ID } from "@/lib/server/demoUser";

export async function PATCH(req, { params }) {
  const { id } = await params;
  const body = await req.json();

  if (body.action !== "bought") {
    return Response.json({ error: "ไม่รู้จัก action นี้" }, { status: 400 });
  }

  const result = await query(
    `UPDATE shopping_list SET status = 'checked' WHERE id = $1 AND user_id = $2 RETURNING id`,
    [id, DEMO_USER_ID]
  );
  if (result.rows.length === 0) {
    return Response.json({ error: "ไม่พบรายการนี้" }, { status: 404 });
  }
  return Response.json({ ok: true });
}

export async function DELETE(req, { params }) {
  const { id } = await params;
  const result = await query(
    `DELETE FROM shopping_list WHERE id = $1 AND user_id = $2 RETURNING id`,
    [id, DEMO_USER_ID]
  );
  if (result.rows.length === 0) {
    return Response.json({ error: "ไม่พบรายการนี้" }, { status: 404 });
  }
  return Response.json({ ok: true });
}
