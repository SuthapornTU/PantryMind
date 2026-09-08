// /api/items/[id]
// GET -> ข้อมูลแถวเดียว (ใช้โหลดค่าเดิมเข้าฟอร์มแก้ไขที่ /add-item?id=.. ดู B3 ใน TASK_B_UI.md)
// PATCH { action: "used" } -> mark ว่า "ใช้แล้ว" + insert item_events(used)
// PATCH { action: "consume_one" } -> ชิ้นเดียวจากแถว "กินหมดแล้ว" (used_count + 1) ดู B5 ใน TASK_B_UI.md
//   ถ้าคงเหลือหลังบวกแล้วเหลือ 0 ให้ปิดแถว (used_at) ไปด้วยเลย ไม่ต้องรอ action อื่น
// PATCH { name?, category?, storageLocation?, expiryDate?, quantity?, pricePerUnit? } -> แก้ไขข้อมูล
// DELETE -> ลบรายการทิ้ง (สำหรับกรณีกรอกผิด/ลบเอง ไม่ log item_events เพราะไม่ใช่ used/expired_unwanted จริง)
//
// user_id มาจาก getCurrentUserId() เท่านั้น (ดู TASK_E_AUTH.md E6) ทุก query รวม UPDATE/DELETE
// ต้องมี WHERE user_id = $userId เสมอ กัน user คนอื่นแก้/ลบของที่ไม่ใช่ของตัวเองผ่าน id เดา
import { query } from "@/lib/server/db";
import { getCurrentUserId } from "@/lib/server/currentUser";
import { daysUntil, ensureTodayMissions, incrementMissionProgress } from "@/lib/server/missions";

export async function GET(req, { params }) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "ยังไม่ได้เข้าสู่ระบบ" }, { status: 401 });

  const { id } = await params;
  const result = await query(
    `SELECT id, name, category, storage_location, expiry_date, quantity, price_per_unit,
            used_count, wasted_count, open_fraction
     FROM pantry_items
     WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  if (result.rows.length === 0) {
    return Response.json({ error: "ไม่พบรายการนี้" }, { status: 404 });
  }
  return Response.json({ item: result.rows[0] });
}

export async function PATCH(req, { params }) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "ยังไม่ได้เข้าสู่ระบบ" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  if (body.action === "consume_one") {
    // เขียนเป็น query เดียว atomic — เช็ค used_at ในเงื่อนไข CASE ตรงๆ แทนการ SELECT ก่อนแล้วค่อย UPDATE
    // เพื่อกัน race condition ระหว่างสองคำขอพร้อมกัน (กดรัวๆ)
    const result = await query(
      `UPDATE pantry_items
       SET used_count = used_count + 1,
           used_at = CASE
             WHEN quantity - (used_count + 1) - wasted_count <= 0 THEN now()
             ELSE used_at
           END
       WHERE id = $1 AND user_id = $2 AND used_at IS NULL
         AND (quantity - used_count - wasted_count) > 0
       RETURNING id, name, quantity, used_count, wasted_count, used_at`,
      [id, userId]
    );
    if (result.rows.length === 0) {
      return Response.json({ error: "ไม่พบรายการนี้ หรือของหมดแล้ว" }, { status: 404 });
    }
    return Response.json({ item: result.rows[0] });
  }

  if (body.action === "used") {
    const result = await query(
      `UPDATE pantry_items SET used_at = now() WHERE id = $1 AND user_id = $2 RETURNING name, expiry_date`,
      [id, userId]
    );
    if (result.rows.length === 0) {
      return Response.json({ error: "ไม่พบรายการนี้" }, { status: 404 });
    }
    const item = result.rows[0];
    await query(
      `INSERT INTO item_events (user_id, item_name, event_type) VALUES ($1, $2, 'used')`,
      [userId, item.name]
    );

    // ภารกิจ "ใช้ของใกล้หมดอายุ" — นับเฉพาะของที่เหลืออายุ <= 3 วัน (เกณฑ์เดียวกับการ์ดสีแดงในหน้า Home)
    if (daysUntil(item.expiry_date) <= 3) {
      await ensureTodayMissions(userId);
      await incrementMissionProgress(userId, "use_near_expiry_items", 1);
    }

    return Response.json({ ok: true });
  }

  const fields = {
    name: "name",
    category: "category",
    storageLocation: "storage_location",
    expiryDate: "expiry_date",
    quantity: "quantity",
    pricePerUnit: "price_per_unit",
  };
  const sets = [];
  const values = [];
  for (const [bodyKey, column] of Object.entries(fields)) {
    if (body[bodyKey] !== undefined) {
      values.push(body[bodyKey]);
      sets.push(`${column} = $${values.length}`);
    }
  }
  if (sets.length === 0) {
    return Response.json({ error: "ไม่มีข้อมูลให้แก้ไข" }, { status: 400 });
  }
  values.push(id, userId);
  const result = await query(
    `UPDATE pantry_items SET ${sets.join(", ")}
     WHERE id = $${values.length - 1} AND user_id = $${values.length}
     RETURNING id, name, category, storage_location, expiry_date, quantity, price_per_unit`,
    values
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
    `DELETE FROM pantry_items WHERE id = $1 AND user_id = $2 RETURNING id`,
    [id, userId]
  );
  if (result.rows.length === 0) {
    return Response.json({ error: "ไม่พบรายการนี้" }, { status: 404 });
  }
  return Response.json({ ok: true });
}
