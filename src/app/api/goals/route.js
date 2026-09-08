// /api/goals — เป้าหมายรายเดือนที่ผู้ใช้ตั้งเอง (ดู TASK_D_GOALS.md)
// GET  -> เป้าเดือนปัจจุบัน (ถ้ามี) + ยอดที่ใช้ไปแล้วของเดือนนี้ + ยอดเดือนที่แล้ว (ทั้ง 2 metric ไว้
//         แนะนำตัวเลขตอนตั้งเป้า) + ผลของเป้าเดือนที่แล้ว (ถ้าเคยตั้งไว้ ไว้โชว์สรุปสิ้นเดือนแบบ D4)
// POST -> สร้าง/แก้เป้าของเดือนปัจจุบัน (upsert ด้วย user_id + start_date)
//
// user_id มาจาก getCurrentUserId() เท่านั้น (ดู TASK_E_AUTH.md E6)
import { getCurrentUserId } from "@/lib/server/currentUser";
import { getUsedAmount, getGoalForMonth, upsertGoal } from "@/lib/server/goals";
import { getWasteBreakdown, getWasteUnitsTotal } from "@/lib/server/wasteStats";
import { currentMonthStr, shiftMonth } from "@/lib/shared/monthUtils";

function serializeGoal(row) {
  if (!row) return null;
  return {
    id: row.id,
    metric: row.metric,
    targetValue: Number(row.target_value),
    startDate: row.start_date,
    endDate: row.end_date,
  };
}

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "ยังไม่ได้เข้าสู่ระบบ" }, { status: 401 });

  const monthStr = currentMonthStr();
  const lastMonthStr = shiftMonth(monthStr, -1);

  const goalRow = await getGoalForMonth(userId, monthStr);
  const usedSoFar = goalRow ? await getUsedAmount(userId, monthStr, goalRow.metric) : null;

  // ยอดเดือนที่แล้วทั้ง 2 metric ไว้แนะนำตัวเลขตอนตั้งเป้าใหม่ (D2) ไม่ว่าจะเลือก baht หรือ count
  const lastMonthBaht = (await getWasteBreakdown(userId, lastMonthStr, "category")).total;
  const lastMonthCount = await getWasteUnitsTotal(userId, lastMonthStr);

  // ผลของเป้าเดือนที่แล้ว (ถ้าเคยตั้งไว้) — ใช้ทำสรุปสิ้นเดือนแบบ D4 ตอนยังไม่ได้ตั้งเป้าเดือนนี้
  const previousGoalRow = await getGoalForMonth(userId, lastMonthStr);
  const previousGoal = previousGoalRow
    ? {
        metric: previousGoalRow.metric,
        targetValue: Number(previousGoalRow.target_value),
        actual: previousGoalRow.metric === "count" ? lastMonthCount : lastMonthBaht,
      }
    : null;

  return Response.json({
    month: monthStr,
    goal: serializeGoal(goalRow),
    usedSoFar,
    lastMonth: { baht: lastMonthBaht, count: lastMonthCount },
    previousGoal,
  });
}

export async function POST(req) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "ยังไม่ได้เข้าสู่ระบบ" }, { status: 401 });

  const body = await req.json();
  const metric = body.metric;
  const targetValue = Number(body.targetValue);

  if (metric !== "baht" && metric !== "count") {
    return Response.json({ error: "metric ต้องเป็น baht หรือ count เท่านั้น" }, { status: 400 });
  }
  if (!Number.isFinite(targetValue) || targetValue <= 0) {
    return Response.json({ error: "targetValue ต้องเป็นตัวเลขมากกว่า 0" }, { status: 400 });
  }

  const goalRow = await upsertGoal(userId, metric, targetValue);
  return Response.json({ goal: serializeGoal(goalRow) }, { status: 201 });
}
