// /api/shopping-list — Core CRUD ของ shopping_list
// GET  -> คืนทั้ง 2 สถานะ (pending + checked ดู C5 ใน TASK_C_SHOPPING.md — เดิมกรองมาแค่ pending
//         ทำให้ติ๊กว่าซื้อแล้วเหมือนของหายไปเลยทั้งที่ status='checked' เก็บไว้ใน DB อยู่แล้ว)
//         เรียง pending มาก่อนเสมอ (ใหม่สุดก่อน) แล้วตามด้วย checked (ใหม่สุดก่อน) — ฝั่ง UI
//         (src/app/shopping/page.js) จะแยกวาดเป็น 2 ส่วนเองจาก status ที่ส่งมา
//         พร้อมเช็คว่ามีของชื่อเดียวกันในตู้อยู่แล้วไหม + nudge เตือนถ้าของชิ้นนี้มักถูกทิ้งบ่อย
//         (ดู src/lib/server/nudge.js)
// POST -> เพิ่มรายการใหม่ลง shopping list พร้อม nudge ของรายการที่เพิ่งเพิ่มกลับไปทันที
//
// user_id มาจาก getCurrentUserId() เท่านั้น (ดู TASK_E_AUTH.md E6)
import { query } from "@/lib/server/db";
import { getCurrentUserId } from "@/lib/server/currentUser";
import { checkNudge } from "@/lib/server/nudge";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "ยังไม่ได้เข้าสู่ระบบ" }, { status: 401 });

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
     WHERE sl.user_id = $1
     ORDER BY (sl.status = 'checked') ASC, sl.created_at DESC`,
    [userId]
  );

  const items = await Promise.all(
    result.rows.map(async (row) => ({
      ...row,
      nudge: await checkNudge(userId, row.item_name),
    }))
  );

  return Response.json({ items });
}

export async function POST(req) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "ยังไม่ได้เข้าสู่ระบบ" }, { status: 401 });

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
    [userId, name, quantity || 1]
  );

  const nudge = await checkNudge(userId, name);

  return Response.json({ item: inserted.rows[0], nudge }, { status: 201 });
}
