// GET /api/cron/resolve-stale-items — safety net เท่านั้น ไม่ใช่ทางหลัก
// ทางหลักให้ user จัดการเองผ่าน ResolveExpiredPopup (src/components/ResolveExpiredPopup.js) ตอนเปิดแอป
// ตัวนี้จับเฉพาะของที่ "หมดอายุเกิน 7 วันแล้ว" ยังไม่เคย resolve เลย (เช่น user ไม่เปิดแอปมานาน) —
// ไม่ auto-resolve ตั้งแต่วันแรกที่หมดอายุแบบที่ RULE_BASED_IMPLEMENTATION.md ข้อ 4.1 เขียนไว้เดิม
// เพราะจะชนกับป็อปอัพที่อยากให้ user เลือกเอง (ใช้แล้ว/ปล่อยให้เสีย + สัดส่วน + เหตุผล) ก่อนเสมอ
// ของที่โดน auto-resolve ตรงนี้ไม่มีทางรู้สัดส่วน/เหตุผลจริงแล้ว จึงใส่ default แบบระบุชัดว่าเป็น
// การเดา (wasted_units = quantity ทั้งหมด คือ "ทิ้งหมดทั้งแถว", waste_reason_category = "อื่นๆ")
// กันสถิติขาดหายไปเฉยๆ
//
// ⚠️ ข้อยกเว้นของ TASK_E_AUTH.md E5 ("แทนที่ DEMO_USER_ID ทุกจุดด้วย getCurrentUserId()"): endpoint
// นี้ถูก cron ภายนอกยิงมาแบบไม่มี session cookie เลย (ไม่ใช่ request จาก browser ของ user คนไหน)
// getCurrentUserId() จะได้ null เสมอ จึงเรียกไม่ได้ — แก้โดยตัดเงื่อนไข WHERE user_id ออกแทน ให้ทำงาน
// ข้ามทุก user ในระบบทีเดียว (ถูกต้องกว่าเดิมที่ hardcode DEMO_USER_ID=1 เพราะตอนนี้มีหลาย user จริงแล้ว)
//
// รันด้วย cron ภายนอก (เช่น Vercel Cron ยิง GET มาตามตารางเวลา) เพราะโปรเจกต์นี้ไม่มีระบบ cron ในตัว
// (ไม่มี supabase/functions เลย — ทุกอย่างในโปรเจกต์นี้เป็น Next.js API Route หมด ต่างจากตัวอย่างเดิม
// ในเอกสารที่แนะนำ Supabase Scheduled Edge Function) — ก่อนขึ้น production จริงควรใส่การยืนยันตัวตน
// (เช่นเช็ค header secret) กันคนนอกยิงมาป่วนได้ ตอนนี้ยังไม่มีเพราะยังไม่มี secret ที่ตกลงกันไว้
import { query } from "@/lib/server/db";

export async function GET() {
  const stale = await query(
    `SELECT id, user_id, name, quantity FROM pantry_items
     WHERE used_at IS NULL AND expiry_date < (CURRENT_DATE - INTERVAL '7 days')`
  );

  for (const item of stale.rows) {
    await query(`UPDATE pantry_items SET used_at = now() WHERE id = $1`, [item.id]);
    // ผูก item_id ตรงๆ (ไม่ใช่แค่ item_name) และเขียน wasted_units = quantity ทั้งหมด (ทิ้งหมดทั้งแถว)
    // แทน waste_fraction เดิม — ให้สอดคล้องกับ A2/A3 ใน TASK_A_DATA.md (ของใหม่ทั้งหมดใช้ wasted_units)
    await query(
      `INSERT INTO item_events (user_id, item_id, item_name, event_type, wasted_units, waste_reason_category)
       VALUES ($1, $2, $3, 'expired_unwanted', $4, 'อื่นๆ')`,
      [item.user_id, item.id, item.name, Number(item.quantity || 1)]
    );
  }

  return Response.json({ resolved: stale.rows.length });
}
