// GET /api/cron/resolve-stale-items — safety net เท่านั้น ไม่ใช่ทางหลัก
// ทางหลักให้ user จัดการเองผ่าน ResolveExpiredPopup (src/components/ResolveExpiredPopup.js) ตอนเปิดแอป
// ตัวนี้จับเฉพาะของที่ "หมดอายุเกิน 7 วันแล้ว" ยังไม่เคย resolve เลย (เช่น user ไม่เปิดแอปมานาน) —
// ไม่ auto-resolve ตั้งแต่วันแรกที่หมดอายุแบบที่ RULE_BASED_IMPLEMENTATION.md ข้อ 4.1 เขียนไว้เดิม
// เพราะจะชนกับป็อปอัพที่อยากให้ user เลือกเอง (ใช้แล้ว/ปล่อยให้เสีย + สัดส่วน + เหตุผล) ก่อนเสมอ
// ของที่โดน auto-resolve ตรงนี้ไม่มีทางรู้สัดส่วน/เหตุผลจริงแล้ว จึงใส่ default แบบระบุชัดว่าเป็น
// การเดา (waste_fraction = 1 คือ "ทิ้งทั้งหมด", waste_reason_category = "อื่นๆ") กันสถิติขาดหายไปเฉยๆ
//
// รันด้วย cron ภายนอก (เช่น Vercel Cron ยิง GET มาตามตารางเวลา) เพราะโปรเจกต์นี้ไม่มีระบบ cron ในตัว
// (ไม่มี supabase/functions เลย — ทุกอย่างในโปรเจกต์นี้เป็น Next.js API Route หมด ต่างจากตัวอย่างเดิม
// ในเอกสารที่แนะนำ Supabase Scheduled Edge Function) — ก่อนขึ้น production จริงควรใส่การยืนยันตัวตน
// (เช่นเช็ค header secret) กันคนนอกยิงมาป่วนได้ ตอนนี้ยังไม่มีเพราะทั้งแอปยังไม่มีระบบ auth เลย
import { query } from "@/lib/server/db";
import { DEMO_USER_ID } from "@/lib/server/demoUser";

export async function GET() {
  const stale = await query(
    `SELECT id, name FROM pantry_items
     WHERE user_id = $1 AND used_at IS NULL AND expiry_date < (CURRENT_DATE - INTERVAL '7 days')`,
    [DEMO_USER_ID]
  );

  for (const item of stale.rows) {
    await query(`UPDATE pantry_items SET used_at = now() WHERE id = $1`, [item.id]);
    await query(
      `INSERT INTO item_events (user_id, item_name, event_type, waste_fraction, waste_reason_category)
       VALUES ($1, $2, 'expired_unwanted', 1, 'อื่นๆ')`,
      [DEMO_USER_ID, item.name]
    );
  }

  return Response.json({ resolved: stale.rows.length });
}
