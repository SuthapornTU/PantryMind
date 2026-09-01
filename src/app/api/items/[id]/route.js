// /api/items/[id]
// PATCH { action: "used" } -> mark ว่า "ใช้แล้ว" + insert item_events(used)
// PATCH { name?, category?, storageLocation?, expiryDate?, quantity?, pricePerUnit? } -> แก้ไขข้อมูล
// DELETE -> ลบรายการทิ้ง (สำหรับกรณีกรอกผิด/ลบเอง ไม่ log item_events เพราะไม่ใช่ used/expired_unwanted จริง)
import { query } from "@/lib/db";
import { DEMO_USER_ID } from "@/lib/demoUser";

export async function PATCH(req, { params }) {
  const { id } = await params;
  const body = await req.json();

  if (body.action === "used") {
    const result = await query(
      `UPDATE pantry_items SET used_at = now() WHERE id = $1 AND user_id = $2 RETURNING name`,
      [id, DEMO_USER_ID]
    );
    if (result.rows.length === 0) {
      return Response.json({ error: "ไม่พบรายการนี้" }, { status: 404 });
    }
    await query(
      `INSERT INTO item_events (user_id, item_name, event_type) VALUES ($1, $2, 'used')`,
      [DEMO_USER_ID, result.rows[0].name]
    );
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
  values.push(id, DEMO_USER_ID);
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
  const { id } = await params;
  const result = await query(
    `DELETE FROM pantry_items WHERE id = $1 AND user_id = $2 RETURNING id`,
    [id, DEMO_USER_ID]
  );
  if (result.rows.length === 0) {
    return Response.json({ error: "ไม่พบรายการนี้" }, { status: 404 });
  }
  return Response.json({ ok: true });
}
