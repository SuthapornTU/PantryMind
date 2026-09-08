// POST /api/items/[id]/resolve — "ปล่อยให้เสีย" จาก WasteResolveForm (ใช้ร่วมกันทั้งป็อปอัพหน้าแรก
// และปุ่ม 🗑 ในหน้ากลุ่ม /items/[name] — ดู B4 ใน TASK_B_UI.md)
// รับ { usedCount?, wastedUnits, wasteReasonCategory, wasteReasonText, pricePerUnit? }
// - usedCount: ค่า used_count ใหม่ทั้งแถว (จากตัวนับ "กินหมดไปแล้วกี่ชิ้น") ไม่ส่งมา = ไม่เปลี่ยน
// - wastedUnits: จำนวนชิ้น (เช่น 2.25) ที่ทิ้งรอบนี้ ไม่ใช่ wasteFraction แบบเดิมอีกต่อไป (B4 ข้อสำคัญ
//   ที่ลืมง่าย) รับค่า 0 ถึง "คงเหลือหลังหักตัวนับ" แทนการเช็ค VALID_FRACTIONS แบบเดิม
// - pricePerUnit: กรอกราคาย้อนหลังตรงนี้ได้เลยถ้าแถวนี้ไม่มีราคา (price_per_unit IS NULL) — ไม่บังคับ
//   wasteReasonText เป็น raw text ที่ user พิมพ์เอง (ว่าง/null ถ้าเลือกปุ่มลัด), wasteReasonCategory
// มาจาก /api/classify-waste-reason (ถ้าพิมพ์เอง) หรือเลือกตรงๆ จากปุ่มลัด (ไม่เรียก AI) — ถามครั้งเดียว
// ต่อการบันทึกหนึ่งครั้ง ไม่ถามรายชิ้น
//
// UPDATE pantry_items + INSERT item_events ต้องสำเร็จ "พร้อมกัน" เท่านั้น (ครอบ transaction ผ่าน
// withTransaction) ไม่งั้นถ้า INSERT พังกลางทางหลัง UPDATE สำเร็จแล้ว ของจะหายจาก "รายการอาหารทั้งหมด"
// แต่ไม่มีบันทึกว่าทิ้งเลย เงินหายจากสถิติแบบเงียบๆ (ดู A4 ใน TASK_A_DATA.md)
//
// user_id มาจาก getCurrentUserId() เท่านั้น (ดู TASK_E_AUTH.md E6) — WHERE user_id = $userId
// กันคนอื่นทิ้งของในตู้เย็นเราผ่านการเดา id
import { withTransaction } from "@/lib/server/db";
import { getCurrentUserId } from "@/lib/server/currentUser";
import { WASTE_REASON_CATEGORIES } from "@/lib/shared/constants";

// เผื่อ floating point คลาดเคลื่อนเล็กน้อย (เช่น 2.9999999998) ให้ถือว่า "หมดแถวแล้ว"
const REMAINING_EPSILON = 0.0001;

// ใช้แยกจาก error ทั่วไปเพื่อให้ withTransaction rollback ได้ปกติ (throw ออกจาก callback เสมอ)
// แต่ route ยังคืน 4xx (ไม่ใช่ 500) ให้ฝั่ง UI แยกแยะ "ข้อมูลผิด/ไม่เจอแถว" ออกจาก "DB พังจริง" ได้
class ClientError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function POST(req, { params }) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "ยังไม่ได้เข้าสู่ระบบ" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const wastedUnits = Number(body.wastedUnits);
  const { wasteReasonCategory, wasteReasonText } = body;
  const usedCountInput = body.usedCount !== undefined ? Number(body.usedCount) : null;
  const pricePerUnitInput =
    body.pricePerUnit !== undefined && body.pricePerUnit !== null && body.pricePerUnit !== ""
      ? Number(body.pricePerUnit)
      : null;

  if (!Number.isFinite(wastedUnits) || wastedUnits < 0) {
    return Response.json({ error: "wastedUnits ต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป" }, { status: 400 });
  }
  if (!WASTE_REASON_CATEGORIES.includes(wasteReasonCategory)) {
    return Response.json({ error: "wasteReasonCategory ไม่ถูกต้อง" }, { status: 400 });
  }
  if (pricePerUnitInput !== null && (!Number.isFinite(pricePerUnitInput) || pricePerUnitInput < 0)) {
    return Response.json({ error: "pricePerUnit ต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป" }, { status: 400 });
  }

  try {
    const item = await withTransaction(async (client) => {
      const rowResult = await client.query(
        `SELECT id, name, quantity, used_count, wasted_count, (expiry_date < CURRENT_DATE) AS is_expired
         FROM pantry_items WHERE id = $1 AND user_id = $2 AND used_at IS NULL FOR UPDATE`,
        [id, userId]
      );
      if (rowResult.rows.length === 0) {
        throw new ClientError("ไม่พบรายการนี้ หรือถูกจัดการไปแล้ว", 404);
      }
      const row = rowResult.rows[0];
      const quantity = Number(row.quantity);
      const oldUsedCount = Number(row.used_count);
      const oldWastedCount = Number(row.wasted_count);

      const newUsedCount = usedCountInput !== null ? usedCountInput : oldUsedCount;
      if (!Number.isFinite(newUsedCount) || newUsedCount < oldUsedCount) {
        throw new ClientError("usedCount ต้องไม่น้อยกว่าค่าที่กินไปแล้วเดิม", 400);
      }

      const remainingAfterUsed = quantity - newUsedCount - oldWastedCount;
      if (wastedUnits > remainingAfterUsed + REMAINING_EPSILON) {
        throw new ClientError("wastedUnits เกินจำนวนคงเหลือของแถวนี้", 400);
      }

      let finalWastedCount = oldWastedCount + wastedUnits;
      let finalRemaining = quantity - newUsedCount - finalWastedCount;

      // ของที่หมดอายุไปแล้วจริง (expiry_date < CURRENT_DATE) ไม่มี state "เปิดใช้ต่อ" ที่สมเหตุสมผล
      // อีกแล้ว — เศษที่เหลือจากการตอบทีละชิ้นแบบไม่เต็ม (เช่น ตอบรวมได้ 4.75 จาก 5 ชิ้น เพราะมีชิ้น
      // เดียวที่ตอบแบบ partial) ต้องถูกนับรวมเป็น "ทิ้งไปด้วย" ทันที ไม่งั้น finalRemaining จะไม่เป็น 0
      // used_at เลยไม่ถูกเซ็ต แถวเลยยังโผล่ซ้ำใน getExpiredUnresolvedItems() ทั้งที่ user กด "ยืนยัน"
      // ไปแล้ว (เก็บเป็น open_fraction ได้เฉพาะของที่ "ยังไม่หมดอายุ" เท่านั้น — ดู 🗑 ใน B2/TASK_B_UI.md
      // ที่ใช้ resolve ทิ้งของก่อนหมดอายุตั้งใจ กรณีนั้นยังมี state เปิดใช้ต่อที่สมเหตุสมผลอยู่จริง)
      let extraWastedFromExpiredLeftover = 0;
      if (row.is_expired && finalRemaining > REMAINING_EPSILON) {
        extraWastedFromExpiredLeftover = finalRemaining;
        finalWastedCount += extraWastedFromExpiredLeftover;
        finalRemaining = 0;
      }

      const isFullyResolved = finalRemaining <= REMAINING_EPSILON;
      // เศษที่เหลือหลังปัดนี้คือ "ชิ้นที่กำลังเปิดใช้อยู่" (ดูนิยาม open_fraction ใน TASK_A_DATA.md A1)
      // สัดส่วนที่ "ใช้ไปแล้ว" ของชิ้นนั้น = 1 − เศษที่เหลือ (เศษ 0.4 คงเหลือ = ใช้ไปแล้ว 60%) — เกิดได้
      // เฉพาะของที่ยังไม่หมดอายุเท่านั้น (ของหมดอายุถูกพับเข้า wasted_count ไปหมดแล้วด้านบน)
      const fractionalRemainder = isFullyResolved ? 0 : finalRemaining - Math.floor(finalRemaining);
      const newOpenFraction = !isFullyResolved && fractionalRemainder > REMAINING_EPSILON ? 1 - fractionalRemainder : null;

      const sets = ["used_count = $1", "wasted_count = $2", "open_fraction = $3"];
      const values = [newUsedCount, finalWastedCount, newOpenFraction];
      if (isFullyResolved) sets.push("used_at = now()");
      if (pricePerUnitInput !== null) {
        values.push(pricePerUnitInput);
        sets.push(`price_per_unit = $${values.length}`);
      }
      values.push(id, userId);

      const updated = await client.query(
        `UPDATE pantry_items SET ${sets.join(", ")}
         WHERE id = $${values.length - 1} AND user_id = $${values.length}
         RETURNING id, name, quantity, used_count, wasted_count, open_fraction, price_per_unit, used_at`,
        values
      );

      // บันทึก event เฉพาะตอนมีอะไรถูก "ทิ้งจริง" รอบนี้ (wastedUnits > 0) — ถ้าผู้ใช้เลื่อนตัวนับ
      // "กินหมดไปแล้ว" อย่างเดียวโดยไม่มีการทิ้งอะไรเลย ไม่ควรมี item_events(expired_unwanted) ว่างๆ
      // รวมเศษที่พับเข้ามาจากของหมดอายุ (extraWastedFromExpiredLeftover) เข้าไปด้วย ไม่งั้นเงินส่วนนั้น
      // จะหายจากสถิติเงียบๆ ทั้งที่ตอนนี้แถวถูกปิดเป็น "ทิ้งแล้ว" เต็มจำนวนจริง
      const totalWastedThisRound = wastedUnits + extraWastedFromExpiredLeftover;
      if (totalWastedThisRound > 0) {
        await client.query(
          `INSERT INTO item_events (user_id, item_id, item_name, event_type, wasted_units, waste_reason_category, waste_reason_text)
           VALUES ($1, $2, $3, 'expired_unwanted', $4, $5, $6)`,
          [userId, row.id, row.name, totalWastedThisRound, wasteReasonCategory, wasteReasonText?.trim() || null]
        );
      }

      return updated.rows[0];
    });
    return Response.json({ ok: true, item });
  } catch (err) {
    if (err instanceof ClientError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
