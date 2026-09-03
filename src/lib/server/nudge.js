// src/lib/server/nudge.js
// เตือน "มักถูกทิ้งบ่อย" ตอนเพิ่มของลง shopping list — rule-based ล้วนๆ จาก item_events
// (waste_rate = wasted_count / added_count, ต้อง >= 50% และเพิ่งถูกทิ้งใน 30 วันล่าสุดด้วย)
// ข้อความเตือนแทรกเหตุผลที่ถูกทิ้งบ่อยที่สุดของของชิ้นนั้น (waste_reason_category จาก
// ResolveExpiredPopup/cron fallback) แทนคำว่า "ลืมกิน" ที่เคยฮาร์ดโค้ดไว้ในเอกสารต้นฉบับ
import { query } from "./db";

const WASTE_RATE_THRESHOLD = 0.5;
const RECENT_DAYS = 30;

export async function checkNudge(userId, itemName) {
  const stats = await query(
    `SELECT
       COUNT(*) FILTER (WHERE event_type = 'added') AS added_count,
       COUNT(*) FILTER (WHERE event_type = 'expired_unwanted') AS wasted_count,
       MAX(created_at) FILTER (WHERE event_type = 'expired_unwanted') AS last_wasted_at
     FROM item_events
     WHERE user_id = $1 AND item_name = $2`,
    [userId, itemName]
  );

  const row = stats.rows[0];
  const addedCount = Number(row?.added_count) || 0;
  const wastedCount = Number(row?.wasted_count) || 0;
  if (addedCount === 0 || wastedCount === 0) return null;

  const wasteRate = wastedCount / addedCount;
  const recentlyWasted =
    row.last_wasted_at &&
    Date.now() - new Date(row.last_wasted_at).getTime() < RECENT_DAYS * 24 * 60 * 60 * 1000;

  if (wasteRate < WASTE_RATE_THRESHOLD || !recentlyWasted) return null;

  // เหตุผลที่ถูกทิ้งบ่อยที่สุดของของชิ้นนี้ (จากทั้ง ResolveExpiredPopup ที่ user เลือก/พิมพ์เอง
  // และ cron fallback ที่ default เป็น "อื่นๆ") — ไม่มีข้อมูลเหตุผลเก็บไว้เลยก็ยังเตือนได้ แค่เป็น
  // ข้อความทั่วไปแทน
  const reasonResult = await query(
    `SELECT waste_reason_category
     FROM item_events
     WHERE user_id = $1 AND item_name = $2 AND event_type = 'expired_unwanted'
       AND waste_reason_category IS NOT NULL
     GROUP BY waste_reason_category
     ORDER BY COUNT(*) DESC
     LIMIT 1`,
    [userId, itemName]
  );
  const topReason = reasonResult.rows[0]?.waste_reason_category;

  return topReason
    ? `ครั้งที่แล้วของนี้ถูกทิ้งเพราะ "${topReason}" ครั้งนี้จะจัดการทันไหม?`
    : `ก่อนหน้านี้คุณเคยทิ้ง "${itemName}" ไปหลายครั้งแล้ว ครั้งนี้จะกินทันไหม?`;
}
