// /api/missions
// GET -> ensure ว่ามีภารกิจของวันนี้ครบ 5 แบบแล้ว (สร้างให้ถ้ายังไม่มี) + คืนภารกิจวันนี้ + ต้นไม้
import { query } from "@/lib/db";
import { DEMO_USER_ID } from "@/lib/demoUser";
import { ensureTodayMissions } from "@/lib/missions";

export async function GET() {
  await ensureTodayMissions(DEMO_USER_ID);

  const missions = await query(
    `SELECT m.id, mt.key, mt.description, mt.unit, m.target, m.progress, m.completed
     FROM missions m
     JOIN mission_templates mt ON mt.id = m.template_id
     WHERE m.user_id = $1 AND m.date = CURRENT_DATE
     ORDER BY mt.id`,
    [DEMO_USER_ID]
  );

  const tree = await query(
    `SELECT level, water_drops FROM tree_progress WHERE user_id = $1`,
    [DEMO_USER_ID]
  );

  return Response.json({
    missions: missions.rows,
    tree: tree.rows[0] || { level: 1, water_drops: 0 },
  });
}
