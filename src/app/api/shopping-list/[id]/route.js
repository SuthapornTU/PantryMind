// /api/shopping-list/[id]
// PATCH { action: "toggle_status" } -> สลับ pending <-> checked ไปกลับได้ (ดู C1/C5 ใน
// TASK_C_SHOPPING.md — เดิมมีแค่ทางเดียว "bought" ทำให้กดผิดแล้วแก้กลับไม่ได้ต้องลบทิ้งอย่างเดียว)
// เขียนลง status='checked' (ไม่ใช่ 'bought') เพราะตาราง shopping_list ที่มีอยู่จริงมี CHECK
// constraint อนุญาตแค่ 'pending'/'checked' เท่านั้น
//
// user_id มาจาก getCurrentUserId() เท่านั้น (ดู TASK_E_AUTH.md E6)
import { query } from "@/lib/server/db";
import { getCurrentUserId } from "@/lib/server/currentUser";

export async function PATCH(req, { params }) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "ยังไม่ได้เข้าสู่ระบบ" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  if (body.action !== "toggle_status") {
    return Response.json({ error: "ไม่รู้จัก action นี้" }, { status: 400 });
  }

  const result = await query(
    `UPDATE shopping_list
     SET status = CASE WHEN status = 'pending' THEN 'checked' ELSE 'pending' END
     WHERE id = $1 AND user_id = $2
     RETURNING id, status`,
    [id, userId]
  );
  if (result.rows.length === 0) {
    return Response.json({ error: "ไม่พบรายการนี้" }, { status: 404 });
  }
  return Response.json({ item: result.rows[0] });
}

export async function DELETE(req, { params }) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "ยังไม่ได้เข้าสู่ระบบ" }, { status: 401 });

  const { id } = await params;
  const result = await query(
    `DELETE FROM shopping_list WHERE id = $1 AND user_id = $2 RETURNING id`,
    [id, userId]
  );
  if (result.rows.length === 0) {
    return Response.json({ error: "ไม่พบรายการนี้" }, { status: 404 });
  }
  return Response.json({ ok: true });
}
