// /api/stats/waste-history?months=6
// ยอดรวมมูลค่าของที่ทิ้งย้อนหลังหลายเดือน สำหรับปุ่ม "เปรียบเทียบ" + บอกว่าเดือนนี้สูง/ต่ำกว่า
// ค่าเฉลี่ยกี่บาท — arithmetic ธรรมดาจากตัวเลขที่ query มาแล้ว ไม่มี AI/ML
import { getWasteHistory } from "@/lib/wasteStats";
import { DEMO_USER_ID } from "@/lib/demoUser";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const months = Math.min(12, Math.max(2, parseInt(searchParams.get("months"), 10) || 6));

  const history = await getWasteHistory(DEMO_USER_ID, months);
  const current = history[history.length - 1]?.amount || 0;
  const previous = history.slice(0, -1);
  const averagePrevious =
    previous.length > 0 ? previous.reduce((sum, m) => sum + m.amount, 0) / previous.length : 0;

  return Response.json({
    history,
    currentTotal: current,
    averagePreviousMonths: Math.round(averagePrevious),
    diffFromAverage: Math.round(current - averagePrevious),
  });
}
