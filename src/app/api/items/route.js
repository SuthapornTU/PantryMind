// /api/items — CRUD หลักของ pantry_items
// GET  -> รายการของที่ยังอยู่ในตู้ (used_at IS NULL) เรียงตามวันหมดอายุ
// POST -> เพิ่มของใหม่ + insert item_events(added) + เขียนกลับ food_reference ถ้าเป็น Path B
//
// user_id มาจาก getCurrentUserId() (อ่าน session cookie ฝั่ง server) เท่านั้น ห้ามรับจาก client
// เด็ดขาด (ดู TASK_E_AUTH.md E6 — RLS ปิดอยู่ทั้ง 13 ตาราง + ต่อ DB ตรงด้วย pg bypass RLS หมด
// ถ้า API เชื่อ user_id ที่ client ส่งมา ใครก็เปลี่ยนเลขแล้วอ่าน/แก้ตู้เย็นคนอื่นได้ทันที)
import { query } from "@/lib/server/db";
import { maybeWriteBackReference } from "@/lib/server/expiryEstimate";
import { getCurrentUserId } from "@/lib/server/currentUser";

export async function GET(req) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "ยังไม่ได้เข้าสู่ระบบ" }, { status: 401 });

  const nearExpiryDays = new URL(req.url).searchParams.get("nearExpiryDays");

  const conditions = ["user_id = $1", "used_at IS NULL"];
  const params = [userId];

  if (nearExpiryDays) {
    conditions.push(`expiry_date <= (CURRENT_DATE + $2::int)`);
    params.push(parseInt(nearExpiryDays, 10));
  }

  const result = await query(
    `SELECT id, name, category, storage_location, expiry_date, quantity, price_per_unit, added_at,
            used_count, wasted_count
     FROM pantry_items
     WHERE ${conditions.join(" AND ")}
     ORDER BY expiry_date ASC`,
    params
  );
  return Response.json({ items: result.rows });
}

export async function POST(req) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "ยังไม่ได้เข้าสู่ระบบ" }, { status: 401 });

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
      userId,
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
    [userId, name.trim()]
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
