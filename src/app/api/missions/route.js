// /api/missions
// GET -> ensure ว่ามีภารกิจของวันนี้ครบ 5 แบบแล้ว (สร้างให้ถ้ายังไม่มี) + คืนภารกิจวันนี้ + ต้นไม้
//
// user_id มาจาก getCurrentUserId() เท่านั้น (ดู TASK_E_AUTH.md E6)
import { query } from "@/lib/server/db";
import { getCurrentUserId } from "@/lib/server/currentUser";
import { ensureTodayMissions } from "@/lib/server/missions";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "ยังไม่ได้เข้าสู่ระบบ" }, { status: 401 });

  await ensureTodayMissions(userId);

  const missions = await query(
    `SELECT m.id, mt.key, mt.description, mt.unit, m.target, m.progress, m.completed
     FROM missions m
     JOIN mission_templates mt ON mt.id = m.template_id
     WHERE m.user_id = $1 AND m.date = CURRENT_DATE
     ORDER BY mt.id`,
    [userId]
  );

  const tree = await query(
    `SELECT level, water_drops FROM tree_progress WHERE user_id = $1`,
    [userId]
  );

  return Response.json({
    missions: missions.rows,
    tree: tree.rows[0] || { level: 1, water_drops: 0 },
  });
}
