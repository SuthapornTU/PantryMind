// POST /api/vision-identify — แปลง "รูปภาพ → ชื่อ+หมวดหมู่" ด้วย Gemini vision (multimodal)
// AI ใช้แค่ "เดา" เท่านั้น ห้ามตัดสินใจ/บันทึกอะไรแทนคน — ผลลัพธ์จากตรงนี้ต้องผ่านฟอร์ม
// add-item ให้ user เห็น/แก้ไข/กดยืนยันเองเสมอก่อนเขียนลง pantry_items จริง (ไม่มีจุดไหน
// insert ตรงนี้เลย) — ดู pattern การเรียก Gemini + fallback เมื่อไม่มี key ใน src/lib/expiryEstimate.js
import { CATEGORIES } from "@/lib/constants";

const GENERIC_ERROR = "ทายรูปนี้ไม่ออก ลองถ่ายใหม่หรือพิมพ์ชื่อเองก่อนนะ";

export async function POST(req) {
  if (!process.env.GEMINI_API_KEY) {
    return Response.json(
      { error: "ยังไม่ได้ตั้งค่า AI สำหรับทายรูปภาพ ลองพิมพ์ชื่อเองก่อนนะ" },
      { status: 400 }
    );
  }

  const formData = await req.formData();
  const file = formData.get("image");
  if (!file || typeof file === "string") {
    return Response.json({ error: "ไม่พบไฟล์รูปภาพ" }, { status: 400 });
  }

  const imageBase64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const prompt = `นี่คือรูปอาหารหรือวัตถุดิบ 1 ชิ้น บอกชื่อภาษาไทยและหมวดหมู่ ตอบเป็น JSON เท่านั้น
ห้ามมีข้อความอื่นนอกเหนือจาก JSON: {"name": "ชื่อภาษาไทยสั้นๆ", "category": "หนึ่งในรายการนี้เท่านั้น: ${CATEGORIES.join(
    ", "
  )}"}`;

  let text = "";
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }, { inlineData: { mimeType: file.type, data: imageBase64 } }],
            },
          ],
        }),
      }
    );
    const data = await r.json();
    text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (!text) {
      // เช็คชั่วคราว: Gemini ไม่ส่ง text กลับมา — log ทั้ง response ดูสาเหตุจริง (API key ผิด/โมเดลผิด/โควต้าหมด ฯลฯ)
      console.error("[vision-identify] Gemini ไม่ส่ง text กลับมา status:", r.status, "response:", JSON.stringify(data));
    }
  } catch (err) {
    console.error("[vision-identify] เรียก Gemini ไม่สำเร็จ:", err);
    return Response.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  let result;
  try {
    const match = text.match(/\{[\s\S]*\}/);
    result = JSON.parse(match ? match[0] : text);
  } catch {
    return Response.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  if (!result?.name) {
    return Response.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  // ห้ามทายหมวดนอกลิสต์ที่ฟอร์ม/DB รองรับ — ไม่ตรงเป๊ะ fallback เป็น "อื่นๆ" เสมอ
  const category = CATEGORIES.includes(result.category) ? result.category : "อื่นๆ";

  return Response.json({ name: result.name, category });
}
