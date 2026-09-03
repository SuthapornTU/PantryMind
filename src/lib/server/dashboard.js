// src/lib/server/dashboard.js
// Data-fetching for the home dashboard. Backend-only: talks to the DB.
// The page component (src/app/page.js) just calls getDashboardData() and renders.
import { query } from "./db";
import { DEMO_USER_ID } from "./demoUser";

export function daysUntil(dateStr) {
  const diff = new Date(dateStr) - new Date(new Date().toDateString());
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

export async function getDashboardData() {
  const result = await query(
    `SELECT id, name, category, storage_location, expiry_date, quantity
     FROM pantry_items
     WHERE user_id = $1 AND used_at IS NULL
     ORDER BY expiry_date ASC
     LIMIT 12`,
    [DEMO_USER_ID]
  );
  const all = result.rows;
  const nearExpiry = all.filter((item) => daysUntil(item.expiry_date) <= 3);
  const nearExpiryIds = new Set(nearExpiry.map((i) => i.id));
  const others = all.filter((item) => !nearExpiryIds.has(item.id)).slice(0, 6);
  return { nearExpiry, others };
}

// ของที่หมดอายุไปแล้วแต่ยังไม่เคยถูก resolve เลย (used_at ว่าง) — ใช้ป้อนเข้า
// ResolveExpiredPopup ตอนเปิดหน้าแรก ให้ user เคลียร์ทีละรายการ
export async function getExpiredUnresolvedItems() {
  const result = await query(
    `SELECT id, name, expiry_date
     FROM pantry_items
     WHERE user_id = $1 AND used_at IS NULL AND expiry_date < CURRENT_DATE
     ORDER BY expiry_date ASC`,
    [DEMO_USER_ID]
  );
  return result.rows;
}
