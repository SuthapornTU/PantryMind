// src/lib/server/goals.js — เป้าหมายรายเดือนที่ผู้ใช้ตั้งเอง (ดู TASK_D_GOALS.md)
// ต่างจากภารกิจรายวันเดิม (missions.js) โดยสิ้นเชิง: ผู้ใช้ตั้งเอง ไม่ใช่ระบบแจก, รายเดือนไม่ใช่รายวัน,
// เลือกได้แค่ 2 รูปแบบที่วัดผลได้ (บาท/ชิ้น) ห้ามพิมพ์อิสระ — ไม่แตะ mission_templates/missions เลย
import { query } from "./db";
import { getWasteBreakdown, getWasteUnitsTotal } from "./wasteStats";
import { currentMonthStr, monthRange } from "../shared/monthUtils";

// ยอดที่ "ใช้ไปแล้ว" ต้องมาจาก wasteStats ตัวเดิมเท่านั้น (ห้ามเขียนสูตรคิดเงินใหม่ — ดู D6) —
// metric='baht' ใช้ total จาก getWasteBreakdown ตรงๆ, metric='count' ใช้ getWasteUnitsTotal
// (นับจำนวนชิ้น ไม่ใช่บาท แต่ใช้ join/สูตรนับหน่วยเดียวกับ wasteStats ไม่ได้คิดเองใหม่)
export async function getUsedAmount(userId, monthStr, metric) {
  if (metric === "count") return getWasteUnitsTotal(userId, monthStr);
  const breakdown = await getWasteBreakdown(userId, monthStr, "category");
  return breakdown.total;
}

export async function getGoalForMonth(userId, monthStr) {
  const { start } = monthRange(monthStr);
  const result = await query(
    `SELECT id, metric, target_value, start_date, end_date FROM goals WHERE user_id = $1 AND start_date = $2`,
    [userId, start]
  );
  return result.rows[0] || null;
}

// upsert ด้วย user_id + start_date (unique index จาก migration 0005) — ตั้งเป้าซ้ำเดือนเดิมเลยเป็น
// การ "แก้" ไม่ใช่สร้างแถวใหม่ซ้อนกัน (ดูรายงานข้อ 1 ใน TASK_D_GOALS.md)
export async function upsertGoal(userId, metric, targetValue) {
  const monthStr = currentMonthStr();
  const { start, end } = monthRange(monthStr);
  // end จาก monthRange คือวันที่ 1 ของเดือนถัดไป (ขอบเขตแบบ exclusive ใช้กับ WHERE created_at < end)
  // แต่ end_date ในตาราง goals ควรเป็นวันสุดท้ายจริงของเดือนนั้น (เผื่อมีใครอ่านคอลัมน์นี้ตรงๆ ทีหลัง)
  const endDate = new Date(end);
  endDate.setUTCDate(endDate.getUTCDate() - 1);

  const result = await query(
    `INSERT INTO goals (user_id, metric, target_value, start_date, end_date)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, start_date) DO UPDATE SET
       metric = EXCLUDED.metric,
       target_value = EXCLUDED.target_value
     RETURNING id, metric, target_value, start_date, end_date`,
    [userId, metric, targetValue, start, endDate.toISOString().slice(0, 10)]
  );
  return result.rows[0];
}
