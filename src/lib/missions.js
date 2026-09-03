// src/lib/missions.js
// ภารกิจรายวัน (missions) + ต้นไม้ (tree_progress) — rule-based ล้วนๆ ไม่มี AI เข้ามาเกี่ยวข้องเลย
// อิงตาม docs/RULE_BASED_IMPLEMENTATION.md ข้อ 4.2 (สูตร personalize target) และ
// docs/ARCHITECTURE.md ข้อ 3 (5 แบบภารกิจ + tree leveling ทุก 6 หยด)
//
// สร้างภารกิจแบบ "lazy" — ไม่มี cron แยก แค่พอมีคนเรียก ensureTodayMissions() (ตอนเปิดหน้า/ตอน
// action ที่เกี่ยวข้องเกิดขึ้น) แล้วยังไม่มีแถวของวันนี้ ค่อยสร้างตอนนั้น ง่ายกว่าและพอสำหรับ demo

import { query } from "./db";

// เกณฑ์ "ใกล้หมดอายุ" ใช้ตัวเดียวกับที่หน้า Home (src/app/page.js) ใช้โชว์การ์ดสีแดงอยู่แล้ว
const NEAR_EXPIRY_DAYS = 3;
// level up ทุกกี่หยด (ดู docs/ARCHITECTURE.md ข้อ 3: "ทุก 6 หยด")
const DROPS_PER_LEVEL = 6;

export function daysUntil(dateStr) {
  const diff = new Date(dateStr) - new Date(new Date().toDateString());
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

// ===== 1) ตั้งเป้าภารกิจรายวัน (personalize) — โค้ดเดียวกับ RULE_BASED_IMPLEMENTATION.md ข้อ 4.2 =====
// ภารกิจ "ปริมาณ" (use_near_expiry_items) scale ตามค่าเฉลี่ยพฤติกรรมจริงของ user
// ภารกิจที่เหลือเป็น binary (ทำ/ไม่ทำ) target คงที่ = 1 เสมอ
async function getTodayMissionTarget(userId, templateKey) {
  if (templateKey === "use_near_expiry_items") {
    const avg = await query(
      `SELECT AVG(daily_count) AS avg_count FROM (
         SELECT DATE(created_at) AS d, COUNT(*) AS daily_count
         FROM item_events
         WHERE user_id = $1 AND event_type = 'added'
           AND created_at > now() - interval '28 days'
         GROUP BY DATE(created_at)
       ) sub`,
      [userId]
    );
    const avgPerDay = Number(avg.rows[0]?.avg_count) || 3; // default ถ้ายังไม่มีประวัติ
    return Math.max(1, Math.round(avgPerDay * 0.6)); // ตั้งเป้าต่ำกว่าพฤติกรรมจริงเล็กน้อย
  }
  // check_pantry_before_buying, log_items_daily_streak, cook_from_suggested_recipe, heed_shopping_nudge
  return 1;
}

// personalize ของภารกิจ "เช็คตู้ก่อนซื้อ" — ยังไม่ต่อเข้า UI เพราะหน้า shopping list ยังไม่ถูกสร้าง
// (เตรียมไว้ล่วงหน้าตามที่ออกแบบใน RULE_BASED_IMPLEMENTATION.md ข้อ 4.2 เพื่อให้พร้อมต่อทันทีที่มีหน้านั้น)
export async function shouldShowCheckPantryMission(userId) {
  const pattern = await query(
    `SELECT EXTRACT(DOW FROM created_at) AS day_of_week, COUNT(*) AS cnt
     FROM shopping_list
     WHERE user_id = $1 AND created_at > now() - interval '28 days'
     GROUP BY day_of_week`,
    [userId]
  );
  if (pattern.rows.length === 0) return true;
  const today = new Date().getDay();
  return pattern.rows.some((r) => Number(r.day_of_week) === today);
}

// นับ streak วันติดต่อกันที่มีการ added/used อย่างน้อย 1 ครั้ง
//
// หมายเหตุแก้บั๊ก: สูตร gaps-and-islands ต้นฉบับใน RULE_BASED_IMPLEMENTATION.md ข้อ 4.2 ใช้
// `d - ROW_NUMBER() OVER (ORDER BY d DESC)` ซึ่งทดสอบกับข้อมูลจริงแล้วนับ streak ผิด (2 วัน
// ติดกันกลับนับได้ 1) เพราะเรียง DESC แล้วลบ row_number ทำให้ grp ไม่คงที่ในแต่ละช่วงติดกัน —
// แก้เป็นเรียง ASC แล้วลบ row_number แทน (grp คงที่จริงสำหรับวันที่ติดกัน) ตรวจยืนยันกับฐานข้อมูล
// จริงแล้วว่าได้ผลลัพธ์ถูกต้อง
async function getStreakCount(userId) {
  const result = await query(
    `WITH daily AS (
       SELECT DISTINCT DATE(created_at) AS d FROM item_events
       WHERE user_id = $1 AND event_type IN ('added','used')
         AND DATE(created_at) <= CURRENT_DATE
     ),
     streak AS (
       SELECT d, d - (ROW_NUMBER() OVER (ORDER BY d ASC))::int AS grp
       FROM daily
     )
     SELECT COUNT(*) AS streak_days FROM streak
     WHERE grp = (SELECT grp FROM streak ORDER BY d DESC LIMIT 1)`,
    [userId]
  );
  return Number(result.rows[0]?.streak_days) || 0;
}

// ===== 2) สร้างแถวภารกิจของวันนี้ถ้ายังไม่มี (เรียกได้ซ้ำๆ ปลอดภัย — กัน duplicate ด้วย UNIQUE constraint) =====
export async function ensureTodayMissions(userId) {
  const templates = await query(`SELECT id, key FROM mission_templates ORDER BY id`);
  for (const t of templates.rows) {
    const target = await getTodayMissionTarget(userId, t.key);
    await query(
      `INSERT INTO missions (user_id, template_id, date, target)
       VALUES ($1, $2, CURRENT_DATE, $3)
       ON CONFLICT (user_id, template_id, date) DO NOTHING`,
      [userId, t.id, target]
    );
  }
  // streak ไม่ใช่ภารกิจแบบ +1 ทีละ event — เป็นค่าที่ต้อง "sync" ใหม่ทุกครั้งจาก event log จริง
  await syncStreakMission(userId);
}

async function syncStreakMission(userId) {
  const row = await query(
    `SELECT m.id, m.target, m.completed FROM missions m
     JOIN mission_templates mt ON mt.id = m.template_id
     WHERE m.user_id = $1 AND m.date = CURRENT_DATE AND mt.key = 'log_items_daily_streak'`,
    [userId]
  );
  const mission = row.rows[0];
  if (!mission) return; // ยังไม่ได้ ensure แถวมิชชันไว้ก่อน (ไม่ควรเกิดถ้าเรียกผ่าน ensureTodayMissions)

  const streak = await getStreakCount(userId);
  const completedNow = streak >= mission.target;
  await query(`UPDATE missions SET progress = $1, completed = $2 WHERE id = $3`, [
    Math.min(streak, mission.target),
    completedNow,
    mission.id,
  ]);
  if (completedNow && !mission.completed) {
    await bumpTree(userId); // เพิ่งสำเร็จครั้งแรกของวันนี้ — ให้หยดน้ำ 1 หยด
  }
}

// ===== 3) เพิ่ม progress ให้ภารกิจแบบ event-driven (เช่น กด "ใช้แล้ว" กับของใกล้หมดอายุ) =====
// WHERE m.completed = false กันไม่ให้บวกซ้ำ/บวกเกิน + ทำให้รู้ได้จาก RETURNING ว่า "เพิ่งสำเร็จรอบนี้" หรือเปล่า
export async function incrementMissionProgress(userId, templateKey, amount = 1) {
  const result = await query(
    `UPDATE missions m
     SET progress = LEAST(m.target, m.progress + $1),
         completed = (m.progress + $1) >= m.target
     FROM mission_templates mt
     WHERE mt.id = m.template_id AND mt.key = $2
       AND m.user_id = $3 AND m.date = CURRENT_DATE
       AND m.completed = false
     RETURNING m.completed`,
    [amount, templateKey, userId]
  );
  if (result.rows[0]?.completed) {
    await bumpTree(userId);
  }
}

// ===== 4) ต้นไม้ — water_drops += 1 ทุกครั้งที่มีภารกิจ "เพิ่งสำเร็จ" ครั้งแรกของวัน, level up ทุก 6 หยด =====
async function bumpTree(userId) {
  await query(
    `INSERT INTO tree_progress (user_id, level, water_drops)
     VALUES ($1, 1, 1)
     ON CONFLICT (user_id) DO UPDATE
       SET water_drops = tree_progress.water_drops + 1,
           level = (tree_progress.water_drops + 1) / $2 + 1`,
    [userId, DROPS_PER_LEVEL]
  );
}

export { NEAR_EXPIRY_DAYS };
