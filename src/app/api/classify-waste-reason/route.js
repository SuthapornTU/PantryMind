// POST /api/classify-waste-reason — จัดข้อความ "เหตุผลที่ทิ้ง" ที่ user พิมพ์เอง ให้เข้าหนึ่งใน
// WASTE_REASON_CATEGORIES เท่านั้น เรียก Gemini เฉพาะตอนพิมพ์เอง (ปุ่มลัดไม่เรียกเลย) — AI ทำหน้าที่
// "จัดหมวด" ข้อความสั้นๆ เท่านั้น ไม่มีรูปภาพ pattern การเรียก Gemini เดียวกับ askLLMForShelfLife ใน
// src/lib/server/expiryEstimate.js — ถ้าไม่มี key หรือเรียกพัง fallback เป็น "อื่นๆ" เสมอ ไม่ทำให้
// หน้าป็อปอัพพัง
import { WASTE_REASON_CATEGORIES } from "@/lib/shared/constants";

const FALLBACK_CATEGORY = "อื่นๆ";

export async function POST(req) {
  const { text } = await req.json();

  if (!text?.trim()) {
    return Response.json({ error: "ต้องระบุ text" }, { status: 400 });
  }

  if (!process.env.GEMINI_API_KEY) {
    console.warn("[classify-waste-reason] ไม่พบ GEMINI_API_KEY — ใช้ default อื่นๆ ไปก่อน");
    return Response.json({ category: FALLBACK_CATEGORY });
  }

  try {
    const prompt = `ข้อความนี้คือเหตุผลที่ user ทิ้งของในตู้กับข้าว: "${text.trim()}"
จัดข้อความนี้เข้าหนึ่งในหมวดต่อไปนี้เท่านั้น: ${WASTE_REASON_CATEGORIES.join(", ")}
ตอบชื่อหมวดเท่านั้น ห้ามมีข้อความอื่น`;

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );
    const data = await r.json();
    const answer = (data.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();

    // ห้ามตอบนอกลิสต์เด็ดขาด — ไม่ตรงเป๊ะ fallback เป็น "อื่นๆ"
    const category = WASTE_REASON_CATEGORIES.find((c) => answer.includes(c)) || FALLBACK_CATEGORY;
    return Response.json({ category });
  } catch (err) {
    console.error("[classify-waste-reason] เรียก Gemini ไม่สำเร็จ:", err);
    return Response.json({ category: FALLBACK_CATEGORY });
  }
}
