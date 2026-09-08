// src/lib/server/recipeAI.js — แนะนำเมนูจากของใกล้หมดอายุด้วย Gemini
// ตัดสินใจออกแบบล็อกแล้ว (ดู RECIPE_TASK.md): ไม่ทำ base_ingredient/จับคู่จาก DB — ส่งชื่อดิบจาก
// pantry_items ไปให้ AI ตีความเอง (AI อ่านชื่อแบบใบเสร็จ เช่น "สันนอกหมูสดสไลด์" เข้าใจอยู่แล้ว)
// ห้ามเก็บผลลัพธ์เมนูลง database ใดๆ (ชุดวัตถุดิบไม่ซ้ำกันเลย เก็บไปก็โตไม่มีที่สิ้นสุดโดยแทบไม่ได้
// ใช้ซ้ำ) — เจนเสร็จแล้วส่งให้ UI แล้วจบ ถ้าจะกันกดซ้ำแล้วยิงซ้ำให้เก็บผลไว้ใน React state ของหน้าเอง
import { query } from "./db";

const MODEL = "gemini-3.5-flash-lite"; // ยืนยันแล้วว่ามีจริงใน v1beta/models (ดูรายงานท้ายงาน)

// ของใกล้หมดอายุ (used_at ยังว่าง, เหลือไม่เกิน 5 วัน) เอามาสุด 8 อันดับแรกเรียงตามวันหมดอายุ
export async function nearExpiryItems(userId) {
  const result = await query(
    `SELECT id, name, expiry_date, (expiry_date - CURRENT_DATE) AS days_left
     FROM pantry_items
     WHERE user_id = $1 AND used_at IS NULL AND expiry_date <= CURRENT_DATE + 5
     ORDER BY expiry_date ASC
     LIMIT 8`,
    [userId]
  );
  return result.rows.map((r) => ({
    id: r.id,
    name: r.name,
    expiry_date: r.expiry_date,
    days_left: Number(r.days_left),
  }));
}

const RECIPE_RESPONSE_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: {
      name: { type: "string" },
      time_minutes: { type: "number" },
      uses: { type: "array", items: { type: "string" } },
      extra_needed: { type: "array", items: { type: "string" } },
      steps: { type: "array", items: { type: "string" } },
    },
    required: ["name", "time_minutes", "uses", "extra_needed", "steps"],
  },
};

// เรียก Gemini ขอ 3 เมนู — บังคับ JSON ด้วย responseMimeType + responseSchema (ห้าม parse ข้อความดิบเอง)
// AI พังต้อง throw ออกไปให้ผู้เรียก (route.js) catch แล้วคืน error แบบไม่ทำหน้าพัง — ไม่ fallback เงียบๆ ที่นี่
export async function generateRecipes(names) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("ยังไม่ได้ตั้งค่า GEMINI_API_KEY");
  }

  const prompt = `นี่คือรายชื่อวัตถุดิบที่ใกล้หมดอายุในตู้เย็น (บางชื่ออาจเป็นชื่อสินค้าบนใบเสร็จ เช่น
"สันนอกหมูสดสไลด์" ให้ตีความว่าเป็นวัตถุดิบอะไรเอง): ${names.join(", ")}

ช่วยแนะนำเมนูอาหารไทยที่คนทั่วไปทำกินเองที่บ้านได้ 3 เมนู (ไม่ใช่เมนูร้านอาหาร) โดย:
- ใช้วัตถุดิบที่ใกล้หมดอายุในลิสต์นี้ให้มากที่สุดเท่าที่จะทำได้
- ถ้ารายการไหนไม่ใช่วัตถุดิบทำอาหาร (เช่น น้ำอัดลม ขนมกรุบกรอบ) ให้ข้ามไปเลย ห้ามเอามาใส่ในเมนู
- ถ้าวัตถุดิบที่ใช้ได้จริงมีน้อยเกินกว่าจะทำเมนูอะไรได้เลย ให้ตอบเป็น array ว่าง []

สำหรับแต่ละเมนู ตอบ:
- name: ชื่อเมนู
- time_minutes: เวลาที่ใช้ทำโดยประมาณ (นาที)
- uses: ของจากลิสต์ที่ส่งไปที่เมนูนี้ใช้ (ต้องเป็นชื่อจากลิสต์ที่ส่งไปเป๊ะๆ ห้ามแก้คำ)
- extra_needed: ของที่ต้องหาซื้อเพิ่ม (ไม่ต้องใส่เครื่องปรุงพื้นฐานอย่างน้ำปลา/น้ำตาล/น้ำมันพืช)
- steps: วิธีทำ 3-6 ขั้นตอน เป็นภาษาไทยแบบบ้านๆ ทำจริงได้`;

  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: RECIPE_RESPONSE_SCHEMA,
        },
      }),
    }
  );

  const data = await r.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error(
      `Gemini ไม่ส่ง text กลับมา status: ${r.status} response: ${JSON.stringify(data)}`
    );
  }

  const recipes = JSON.parse(text);
  if (!Array.isArray(recipes)) {
    throw new Error("Gemini ตอบกลับมาไม่ใช่ array");
  }
  return recipes;
}
