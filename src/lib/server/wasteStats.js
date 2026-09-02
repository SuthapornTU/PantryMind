// src/lib/wasteStats.js — สถิติของที่ทิ้ง (event_type='expired_unwanted' ใน item_events)
// SQL aggregation ล้วนๆ ไม่มีจุดไหนใช้ AI/ML ตัดสินใจอะไรทั้งสิ้น

import { query } from "./db";
import { monthRange } from "../shared/monthUtils";

// item_events เก็บแค่ item_name (ไม่มี item_id) ถ้า JOIN ตรงๆ กับ pi.name แล้ว user เคยเพิ่ม
// ของชื่อเดียวกันหลายครั้ง (ราคาไม่เท่ากัน) จะ fan-out ทำให้ยอดพองเกินจริง — ที่นี่ใช้ LATERAL join
// เลือกแค่แถว pantry_items ล่าสุด (added_at DESC) ต่อ 1 event แทน แม่นยำกว่า JOIN ตรงๆ
const WASTE_EVENTS_WITH_ITEM = `
  FROM item_events ie
  LEFT JOIN LATERAL (
    SELECT category, name, price_per_unit, quantity
    FROM pantry_items
    WHERE user_id = ie.user_id AND name = ie.item_name
    ORDER BY added_at DESC
    LIMIT 1
  ) pi ON true
  WHERE ie.user_id = $1 AND ie.event_type = 'expired_unwanted'
    AND ie.created_at >= $2 AND ie.created_at < $3
`;

// view: "category" (default) | "item"
export async function getWasteBreakdown(userId, monthStr, view) {
  const { start, end } = monthRange(monthStr);
  const groupExpr =
    view === "item" ? "COALESCE(pi.name, ie.item_name)" : "COALESCE(pi.category, 'อื่นๆ')";

  const result = await query(
    `SELECT ${groupExpr} AS label,
            SUM(COALESCE(pi.price_per_unit, 0) * COALESCE(pi.quantity, 1)) AS amount,
            COUNT(*) AS count
     ${WASTE_EVENTS_WITH_ITEM}
     GROUP BY label
     ORDER BY amount DESC`,
    [userId, start, end]
  );

  const breakdown = result.rows.map((r) => ({
    label: r.label,
    amount: Number(r.amount) || 0,
    count: Number(r.count) || 0,
  }));
  const total = breakdown.reduce((sum, r) => sum + r.amount, 0);
  return { month: monthStr, view: view === "item" ? "item" : "category", total, breakdown };
}

// ยอดรวมมูลค่าของที่ทิ้งรายเดือน ย้อนหลัง monthsBack เดือน (รวมเดือนปัจจุบัน) — สำหรับกราฟแท่งเปรียบเทียบ
export async function getWasteHistory(userId, monthsBack) {
  const now = new Date();
  const months = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }

  const { start: earliestStart } = monthRange(months[0]);
  const result = await query(
    `SELECT to_char(date_trunc('month', ie.created_at), 'YYYY-MM') AS month,
            SUM(COALESCE(pi.price_per_unit, 0) * COALESCE(pi.quantity, 1)) AS amount
     FROM item_events ie
     LEFT JOIN LATERAL (
       SELECT price_per_unit, quantity
       FROM pantry_items
       WHERE user_id = ie.user_id AND name = ie.item_name
       ORDER BY added_at DESC
       LIMIT 1
     ) pi ON true
     WHERE ie.user_id = $1 AND ie.event_type = 'expired_unwanted'
       AND ie.created_at >= $2
     GROUP BY month`,
    [userId, earliestStart]
  );

  const byMonth = new Map(result.rows.map((r) => [r.month, Number(r.amount) || 0]));
  return months.map((month) => ({ month, amount: byMonth.get(month) || 0 }));
}
