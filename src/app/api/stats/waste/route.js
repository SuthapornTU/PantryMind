// /api/stats/waste?month=YYYY-MM&view=category|item
// โดนัทชาร์ตสัดส่วนมูลค่าของที่ทิ้งของเดือนที่เลือก — SQL aggregation ล้วนๆ (ดู src/lib/wasteStats.js)
import { getWasteBreakdown } from "@/lib/server/wasteStats";
import { currentMonthStr } from "@/lib/shared/monthUtils";
import { DEMO_USER_ID } from "@/lib/server/demoUser";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month") || currentMonthStr();
  const view = searchParams.get("view") === "item" ? "item" : "category";

  const data = await getWasteBreakdown(DEMO_USER_ID, month, view);
  return Response.json(data);
}
