// /api/items — CRUD หลักของ pantry_items
// GET  -> รายการของที่ยังอยู่ในตู้ (used_at IS NULL) เรียงตามวันหมดอายุ
// POST -> เพิ่มของใหม่ + insert item_events(added) + เขียนกลับ food_reference ถ้าเป็น Path B
import { query } from "@/lib/server/db";
import { maybeWriteBackReference } from "@/lib/server/expiryEstimate";
import { DEMO_USER_ID } from "@/lib/server/demoUser"; // TODO(auth): แทนที่ด้วย user_id จริงตอนต่อ Supabase Auth

export async function GET(req) {
  const nearExpiryDays = new URL(req.url).searchParams.get("nearExpiryDays");

  const conditions = ["user_id = $1", "used_at IS NULL"];
  const params = [DEMO_USER_ID];

  if (nearExpiryDays) {
    conditions.push(`expiry_date <= (CURRENT_DATE + $2::int)`);
    params.push(parseInt(nearExpiryDays, 10));
  }

  const result = await query(
    `SELECT id, name, category, storage_location, expiry_date, quantity, price_per_unit, added_at
     FROM pantry_items
     WHERE ${conditions.join(" AND ")}
     ORDER BY expiry_date ASC`,
    params
  );
  return Response.json({ items: result.rows });
}

export async function POST(req) {
  const body = await req.json();
  const {
    name,
    category,
    storageLocation,
    quantity,
    pricePerUnit,
    expiryDate,
    days, // จำนวนวันที่ใช้จริง (สำหรับเขียนกลับ food_reference ตอน Path B)
    writeBack, // true เฉพาะตอน Path B ปกติ — false ถ้ามาจาก Path A หรือ escape-hatch
  } = body;

  if (!name?.trim() || !category || !storageLocation || !expiryDate) {
    return Response.json(
      { error: "ต้องระบุ name, category, storageLocation, expiryDate" },
      { status: 400 }
    );
  }

  const inserted = await query(
    `INSERT INTO pantry_items (user_id, name, category, storage_location, expiry_date, quantity, price_per_unit)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, name, category, storage_location, expiry_date, quantity, price_per_unit, added_at`,
    [
      DEMO_USER_ID,
      name.trim(),
      category,
      storageLocation,
      expiryDate,
      quantity || 1,
      pricePerUnit ?? null,
    ]
  );

  await query(
    `INSERT INTO item_events (user_id, item_name, event_type) VALUES ($1, $2, 'added')`,
    [DEMO_USER_ID, name.trim()]
  );

  if (writeBack && days) {
    await maybeWriteBackReference({
      foodName: name.trim(),
      category,
      storageLocation,
      days,
      isEscapeHatch: false,
    });
  }

  return Response.json({ item: inserted.rows[0] }, { status: 201 });
}
