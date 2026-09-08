// /api/stats/waste?month=YYYY-MM&view=category|item
// โดนัทชาร์ตสัดส่วนมูลค่าของที่ทิ้งของเดือนที่เลือก — SQL aggregation ล้วนๆ (ดู src/lib/wasteStats.js)
// user_id มาจาก getCurrentUserId() เท่านั้น (ดู TASK_E_AUTH.md E6)
import { getWasteBreakdown } from "@/lib/server/wasteStats";
import { currentMonthStr } from "@/lib/shared/monthUtils";
import { getCurrentUserId } from "@/lib/server/currentUser";

export async function GET(req) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "ยังไม่ได้เข้าสู่ระบบ" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month") || currentMonthStr();
  const view = searchParams.get("view") === "item" ? "item" : "category";

  const data = await getWasteBreakdown(userId, month, view);
  return Response.json(data);
}
