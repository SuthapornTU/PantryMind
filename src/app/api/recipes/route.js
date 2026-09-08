// POST /api/recipes — แนะนำเมนูจากของใกล้หมดอายุ (ฟีเจอร์พรีเมียม เปิดฟรีในเดโมนี้ ดู RECIPE_TASK.md)
// ห้ามเก็บผลลัพธ์ลง database — เจนใหม่จาก Gemini ทุกครั้งที่เรียก แล้วส่งให้ UI ตรงๆ เลย (ถ้าจะกันยิงซ้ำ
// ให้ฝั่ง React เก็บผลไว้ใน state ของหน้าเอง ไม่ใช่หน้าที่ backend) — ปุ่ม "คิดเมนูใหม่" ฝั่ง UI ก็แค่
// เรียก endpoint นี้ซ้ำเฉยๆ ไม่มีอะไรให้ "force ข้าม" อีกต่อไป
// AI พังต้องไม่ทำให้หน้าพัง — catch แล้วคืน { error, recipes: [] } พร้อม status 200 เสมอ
// user_id มาจาก getCurrentUserId() เท่านั้น (ดู TASK_E_AUTH.md E6)
import { getCurrentUserId } from "@/lib/server/currentUser";
import { nearExpiryItems, generateRecipes } from "@/lib/server/recipeAI";

export async function POST() {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "ยังไม่ได้เข้าสู่ระบบ" }, { status: 401 });

  const items = await nearExpiryItems(userId);
  if (items.length === 0) {
    return Response.json({ items: [], recipes: [], reason: "no_items" });
  }

  try {
    const recipes = await generateRecipes(items.map((i) => i.name));
    return Response.json({ items, recipes });
  } catch (err) {
    console.error("[api/recipes] เรียก Gemini ไม่สำเร็จ:", err);
    return Response.json({ items, error: "คิดเมนูไม่สำเร็จ ลองใหม่อีกทีนะ", recipes: [] });
  }
}
