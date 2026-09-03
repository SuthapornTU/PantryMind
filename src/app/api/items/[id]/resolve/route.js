// POST /api/items/[id]/resolve — "ปล่อยให้เสีย" จากป็อปอัพจัดการของหมดอายุ
// (แยกจาก PATCH /api/items/[id] เดิมเพราะ logic ต่างกันพอสมควร: ปิด used_at + log
// item_events(expired_unwanted) พร้อม waste_fraction/เหตุผล ไม่ใช่แค่ mark ว่าใช้แล้วเฉยๆ)
// รับ { wasteFraction, wasteReasonCategory, wasteReasonText } — wasteReasonText เป็น raw text
// ที่ user พิมพ์เอง (ว่าง/null ถ้าเลือกปุ่มลัด), wasteReasonCategory มาจาก /api/classify-waste-reason
// (ถ้าพิมพ์เอง) หรือเลือกตรงๆ จากปุ่มลัด (ไม่เรียก AI)
import { query } from "@/lib/server/db";
import { DEMO_USER_ID } from "@/lib/server/demoUser";
import { WASTE_REASON_CATEGORIES } from "@/lib/shared/constants";

const VALID_FRACTIONS = [0.25, 0.5, 0.75, 1];

export async function POST(req, { params }) {
  const { id } = await params;
  const body = await req.json();
  const wasteFraction = Number(body.wasteFraction);
  const { wasteReasonCategory, wasteReasonText } = body;

  if (!VALID_FRACTIONS.includes(wasteFraction)) {
    return Response.json({ error: "wasteFraction ต้องเป็น 0.25, 0.5, 0.75 หรือ 1" }, { status: 400 });
  }
  if (!WASTE_REASON_CATEGORIES.includes(wasteReasonCategory)) {
    return Response.json({ error: "wasteReasonCategory ไม่ถูกต้อง" }, { status: 400 });
  }

  const result = await query(
    `UPDATE pantry_items SET used_at = now() WHERE id = $1 AND user_id = $2 AND used_at IS NULL RETURNING name`,
    [id, DEMO_USER_ID]
  );
  if (result.rows.length === 0) {
    return Response.json({ error: "ไม่พบรายการนี้ หรือถูกจัดการไปแล้ว" }, { status: 404 });
  }

  await query(
    `INSERT INTO item_events (user_id, item_name, event_type, waste_fraction, waste_reason_category, waste_reason_text)
     VALUES ($1, $2, 'expired_unwanted', $3, $4, $5)`,
    [DEMO_USER_ID, result.rows[0].name, wasteFraction, wasteReasonCategory, wasteReasonText?.trim() || null]
  );

  return Response.json({ ok: true });
}
