// GET /api/shopping-list/search?q=... — autocomplete สำหรับหน้าเพิ่มของลง shopping list
// คู่ขนานกับ /api/food-reference (ไม่แก้ไฟล์เดิม เพราะเดิมใช้กับฟอร์มเพิ่มของเข้าตู้) แต่เพิ่มการเช็ค
// pantry_items ว่าของที่ค้นเจอมีอยู่ในตู้แล้วกี่ชิ้น (used_at IS NULL) — SQL ล้วนๆ ไม่มี AI
//
// user_id มาจาก getCurrentUserId() เท่านั้น (ดู TASK_E_AUTH.md E6) — food_reference เป็นข้อมูลกลาง
// ไม่ผูก user แต่ already_have_quantity ต้องเช็คเทียบกับตู้เย็นของ user ที่ล็อกอินอยู่เท่านั้น
import { query } from "@/lib/server/db";
import { getCurrentUserId } from "@/lib/server/currentUser";

export async function GET(req) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "ยังไม่ได้เข้าสู่ระบบ" }, { status: 401 });

  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q) return Response.json({ items: [] });

  const result = await query(
    `SELECT fr.name, fr.category, fr.icon,
            COALESCE(pi.already_have_quantity, 0) AS already_have_quantity
     FROM food_reference fr
     LEFT JOIN LATERAL (
       SELECT SUM(quantity) AS already_have_quantity
       FROM pantry_items
       WHERE user_id = $3 AND used_at IS NULL AND lower(name) = lower(fr.name)
     ) pi ON true
     WHERE fr.name ILIKE $1 OR $2 = ANY(fr.aliases)
     ORDER BY fr.name ASC LIMIT 8`,
    [`%${q}%`, q, userId]
  );
  return Response.json({ items: result.rows });
}
