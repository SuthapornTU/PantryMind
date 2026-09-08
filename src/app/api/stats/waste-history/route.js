// /api/stats/waste-history?months=6
// ยอดรวมมูลค่าของที่ทิ้งย้อนหลังหลายเดือน สำหรับปุ่ม "เปรียบเทียบ" + บอกว่าเดือนนี้สูง/ต่ำกว่า
// ค่าเฉลี่ยกี่บาท — arithmetic ธรรมดาจากตัวเลขที่ query มาแล้ว ไม่มี AI/ML
// user_id มาจาก getCurrentUserId() เท่านั้น (ดู TASK_E_AUTH.md E6)
import { getWasteHistory } from "@/lib/server/wasteStats";
import { getCurrentUserId } from "@/lib/server/currentUser";

export async function GET(req) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "ยังไม่ได้เข้าสู่ระบบ" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const months = Math.min(12, Math.max(2, parseInt(searchParams.get("months"), 10) || 6));

  const history = await getWasteHistory(userId, months);
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
