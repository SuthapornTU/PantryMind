// src/lib/wasteStats.js — สถิติของที่ทิ้ง (event_type='expired_unwanted' ใน item_events)
// SQL aggregation ล้วนๆ ไม่มีจุดไหนใช้ AI/ML ตัดสินใจอะไรทั้งสิ้น

import { query } from "./db";
import { monthRange } from "../shared/monthUtils";

// item_events.item_id ผูกกับแถว pantry_items ที่เหตุการณ์นั้นเกิดจริง (เพิ่มมาใน migration 0004) —
// ถ้ามี item_id ให้ JOIN ตรงๆ เท่านั้น (แม่นยำ 100%) ถ้าเป็น NULL (ข้อมูลเก่าก่อนมีคอลัมน์นี้) ค่อย
// fallback ไปเดาจากชื่อ+เวลาเพิ่มล่าสุด (ของเดิม เผื่อกรณีของหมดอายุจริงๆ คือของเก่า ไม่ใช่ของที่เพิ่ง
// ซื้อมาใหม่ชื่อเดียวกัน — เคยผิดเพราะหยิบราคาของใหม่มาคิดแทน ดู A3 ใน TASK_A_DATA.md)
const WASTE_EVENTS_WITH_ITEM = `
  FROM item_events ie
  LEFT JOIN LATERAL (
    SELECT category, name, price_per_unit, quantity
    FROM pantry_items
    WHERE (ie.item_id IS NOT NULL AND id = ie.item_id)
       OR (ie.item_id IS NULL AND user_id = ie.user_id AND name = ie.item_name)
    ORDER BY added_at DESC
    LIMIT 1
  ) pi ON true
  WHERE ie.user_id = $1 AND ie.event_type = 'expired_unwanted'
    AND ie.created_at >= $2 AND ie.created_at < $3
`;

// สูตรมูลค่าที่ทิ้ง — wasted_units (จำนวนชิ้นจริงที่ทิ้ง เช่น 2.25 แพ็ค) มาก่อนเสมอถ้ามี ห้ามคูณ
// quantity ซ้ำเพราะมันคือจำนวนชิ้นสุดท้ายแล้ว ถ้าไม่มี (ข้อมูลเก่าก่อนมีคอลัมน์นี้) ค่อย fallback ไปคูณ
// quantity * waste_fraction (สัดส่วนของทั้งหมด) แบบเดิม — ดู A2 ใน TASK_A_DATA.md
const WASTE_AMOUNT_EXPR =
  "COALESCE(pi.price_per_unit, 0) * COALESCE(ie.wasted_units, COALESCE(pi.quantity, 1) * COALESCE(ie.waste_fraction, 1))";

// view: "category" (default) | "item"
export async function getWasteBreakdown(userId, monthStr, view) {
  const { start, end } = monthRange(monthStr);
  const groupExpr =
    view === "item" ? "COALESCE(pi.name, ie.item_name)" : "COALESCE(pi.category, 'อื่นๆ')";

  const result = await query(
    `SELECT ${groupExpr} AS label,
            SUM(${WASTE_AMOUNT_EXPR}) AS amount,
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
            SUM(${WASTE_AMOUNT_EXPR}) AS amount
     FROM item_events ie
     LEFT JOIN LATERAL (
       SELECT price_per_unit, quantity
       FROM pantry_items
       WHERE (ie.item_id IS NOT NULL AND id = ie.item_id)
          OR (ie.item_id IS NULL AND user_id = ie.user_id AND name = ie.item_name)
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

// จำนวน "ชิ้น" ที่ทิ้งทั้งเดือน (ไม่ใช่บาท) — สำหรับเป้าหมายแบบ metric='count' (ดู TASK_D_GOALS.md
// D6: "ห้ามเขียนสูตรคิดเงินใหม่") ใช้ join เดิม (WASTE_EVENTS_WITH_ITEM) แค่ไม่คูณราคาเข้าไปเท่านั้น
// สูตรนับหน่วยเดียวกับ WASTE_AMOUNT_EXPR (wasted_units ก่อนเสมอ ไม่งั้น fallback quantity*waste_fraction)
export async function getWasteUnitsTotal(userId, monthStr) {
  const { start, end } = monthRange(monthStr);
  const result = await query(
    `SELECT SUM(COALESCE(ie.wasted_units, COALESCE(pi.quantity, 1) * COALESCE(ie.waste_fraction, 1))) AS units
     ${WASTE_EVENTS_WITH_ITEM}`,
    [userId, start, end]
  );
  return Number(result.rows[0]?.units) || 0;
}
