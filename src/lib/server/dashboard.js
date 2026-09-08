// src/lib/server/dashboard.js
// Data-fetching for the home dashboard. Backend-only: talks to the DB.
// The page component (src/app/page.js) just calls getDashboardData() and renders.
// รับ userId เข้ามาเป็น param เสมอ (มาจาก getCurrentUserId() ที่ page.js เรียกไว้แล้ว) — ห้าม import
// DEMO_USER_ID ในไฟล์นี้เด็ดขาด (ดู TASK_E_AUTH.md E5/E6)
import { query } from "./db";

export function daysUntil(dateStr) {
  const diff = new Date(dateStr) - new Date(new Date().toDateString());
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

// รวมของชื่อเดียวกันเป็น "กลุ่ม" เดียว (ข้ามวันหมดอายุด้วย — ไข่ซื้อจันทร์ + ไข่ซื้อพุธ = กลุ่มเดียว)
// ตาม TASK_B_UI.md B1: การ์ดกลุ่มโชว์จำนวนชิ้นคงเหลือ "รวมทั้งกลุ่ม" แต่ตัดสินใจโซนใกล้หมดอายุด้วย
// "วันหมดอายุที่ด่วนที่สุดในกลุ่ม" เท่านั้น (ห้ามใช้ล่าสุด/ค่าเฉลี่ย เพราะจะกลบล็อตเก่าที่ใกล้เสียแล้ว)
function groupByName(rows) {
  const groups = new Map();
  for (const row of rows) {
    const remaining = Number(row.quantity) - Number(row.used_count || 0) - Number(row.wasted_count || 0);
    if (remaining <= 0) continue;
    const g = groups.get(row.name);
    if (!g) {
      groups.set(row.name, {
        name: row.name,
        category: row.category,
        remaining,
        earliestExpiry: row.expiry_date,
        // เก็บ id ของแถวที่หมดอายุเร็วสุดไว้เผื่อกลุ่มมีของเหลือชิ้นเดียว (ข้ามหน้ากลางไปหน้าแก้ไขได้ตรงๆ)
        soleItemId: row.id,
        rowCount: 1,
      });
    } else {
      g.remaining += remaining;
      g.rowCount += 1;
      if (new Date(row.expiry_date) < new Date(g.earliestExpiry)) {
        g.earliestExpiry = row.expiry_date;
        g.category = row.category;
      }
      g.soleItemId = row.id; // จะใช้จริงเฉพาะตอน remaining รวม = 1 (แปลว่ามีแถวเดียวที่เหลืออยู่แล้ว)
    }
  }
  return [...groups.values()];
}

export async function getDashboardData(userId) {
  const result = await query(
    `SELECT id, name, category, storage_location, expiry_date, quantity, used_count, wasted_count
     FROM pantry_items
     WHERE user_id = $1 AND used_at IS NULL
     ORDER BY expiry_date ASC`,
    [userId]
  );
  const groups = groupByName(result.rows);
  const nearExpiry = groups
    .filter((g) => daysUntil(g.earliestExpiry) <= 3)
    .sort((a, b) => new Date(a.earliestExpiry) - new Date(b.earliestExpiry));
  const nearExpiryNames = new Set(nearExpiry.map((g) => g.name));
  const others = groups
    .filter((g) => !nearExpiryNames.has(g.name))
    .sort((a, b) => new Date(a.earliestExpiry) - new Date(b.earliestExpiry))
    .slice(0, 6);
  // ผลรวมชิ้นทั้งหมด (ไม่ตัดที่ 6 เหมือน others) — ใช้เช็คเงื่อนไข "มีของ >= 3 ชิ้น" ของแถบชวนเพิ่ม
  // ลงหน้าจอโฮม (ดู TASK_E_AUTH.md E8) นับจาก others ที่ถูก slice ไปแล้วจะได้ตัวเลขต่ำกว่าจริง
  const totalItemCount = groups.reduce((sum, g) => sum + g.remaining, 0);
  return { nearExpiry, others, totalItemCount };
}

// ของที่หมดอายุไปแล้วแต่ยังไม่เคยถูก resolve เลย (used_at ว่าง) — ใช้ป้อนเข้า
// ResolveExpiredPopup ตอนเปิดหน้าแรก ให้ user เคลียร์ทีละรายการ
// ดึง quantity/price_per_unit/used_count/wasted_count มาด้วย ให้ WasteResolveForm (component เดียว
// ที่ใช้ร่วมกับปุ่ม 🗑 ใน B2) มีข้อมูลพอจะคำนวณคงเหลือของแถว + สร้างตัวเลือกทีละชิ้นได้ (ดู B4)
export async function getExpiredUnresolvedItems(userId) {
  const result = await query(
    `SELECT id, name, expiry_date, quantity, price_per_unit, used_count, wasted_count
     FROM pantry_items
     WHERE user_id = $1 AND used_at IS NULL AND expiry_date < CURRENT_DATE
     ORDER BY expiry_date ASC`,
    [userId]
  );
  return result.rows;
}
