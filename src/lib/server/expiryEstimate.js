// src/lib/expiryEstimate.js
// วันหมดอายุอัตโนมัติแบบ rule-based lookup table + UX 2-path (auto-fill / quick-pick)
// ใช้ query() ของเราเอง (src/lib/db.js) ต่อฐานข้อมูลตรงๆ

import { query } from "./db";

const DEFAULT_FALLBACK_DAYS = 7; // ใช้เมื่อไม่เจอใน food_reference และเรียก LLM ไม่ได้ (ไม่มี GEMINI_API_KEY หรือ API ล่ม)

async function findFoodReference(foodName) {
  const ref = await query(
    `SELECT * FROM food_reference WHERE name = $1 OR $1 = ANY(aliases) LIMIT 1`,
    [foodName]
  );
  return ref.rows[0] || null;
}

function pickDaysByStorage(row, storageLocation) {
  return storageLocation === "freezer"
    ? row.shelf_life_freezer_days
    : storageLocation === "pantry"
    ? row.shelf_life_pantry_days
    : row.shelf_life_fridge_days;
}

// เรียก LLM แค่ "ครั้งเดียว" ตอนเจอของใหม่ที่ไม่มีใน food_reference เลย (ไม่ใช่ทุกครั้งที่ add item)
// ถ้าไม่มี GEMINI_API_KEY (ยังไม่ได้ตั้งค่า) ให้ fallback เป็นค่า default แทนที่จะพัง
async function askLLMForShelfLife(foodName, category, storageLocation) {
  if (!process.env.GEMINI_API_KEY) {
    console.warn(
      `[expiryEstimate] ไม่พบ GEMINI_API_KEY — ใช้ default ${DEFAULT_FALLBACK_DAYS} วันสำหรับ "${foodName}" ไปก่อน (ตั้งค่า .env.local เพื่อให้ระบบถามจาก AI แทน)`
    );
    return DEFAULT_FALLBACK_DAYS;
  }

  try {
    const prompt = `อาหารไทยชื่อ "${foodName}" (หมวดหมู่: ${category || "ไม่ทราบ"}) เก็บใน${
      storageLocation === "freezer" ? "ช่องแช่แข็ง" : storageLocation === "pantry" ? "ที่เก็บแห้ง" : "ตู้เย็น"
    }ได้กี่วันก่อนหมดอายุ/เสีย ตอบเป็นตัวเลขจำนวนวันเท่านั้น ห้ามมีข้อความอื่น เช่น "7"`;

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );
    const data = await r.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const days = parseInt(text.match(/\d+/)?.[0], 10);
    return Number.isFinite(days) && days > 0 ? days : DEFAULT_FALLBACK_DAYS;
  } catch (err) {
    console.error("[expiryEstimate] เรียก Gemini ไม่สำเร็จ:", err);
    return DEFAULT_FALLBACK_DAYS;
  }
}

// ใช้ตอน "บันทึกจริง" — คืนค่าเป็น Date ของวันหมดอายุ พร้อม cache ผลลัพธ์ลง food_reference
// ถ้าเป็นของใหม่ที่ไม่เคยเจอ (ครั้งต่อไปจะเจอผ่าน findFoodReference แทน ไม่ต้องเรียก LLM ซ้ำ)
export async function estimateExpiryDate({ foodName, category, storageLocation }) {
  const row = await findFoodReference(foodName);
  let days = row ? pickDaysByStorage(row, storageLocation) : null;

  if (!days) {
    days = await askLLMForShelfLife(foodName, category, storageLocation);
    await query(
      `INSERT INTO food_reference (name, category, shelf_life_fridge_days)
       VALUES ($1, $2, $3) ON CONFLICT (name) DO NOTHING`,
      [foodName, category || "อื่นๆ", days]
    );
  }

  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + days);
  return expiryDate;
}

// ใช้ตอน "โชว์ฟอร์ม" — บอกฝั่ง UI ว่าควรเป็น Path A (auto-fill) หรือ Path B (quick-pick)
// ไม่เรียก LLM ตรงนี้ (เรียกเฉพาะตอนบันทึกจริงถ้าจำเป็น เพื่อไม่ให้ทุกครั้งที่พิมพ์ชื่อยิง AI)
export async function resolveExpiryUI({ foodName, storageLocation }) {
  const row = await findFoodReference(foodName);

  if (row) {
    const days = pickDaysByStorage(row, storageLocation);
    if (days) {
      return {
        mode: "auto-fill",
        defaultDays: days,
        category: row.category,
        writeBackToReference: false,
      };
    }
    // เจอชื่อในตารางแต่ไม่มีค่าของที่เก็บนี้ (เช่น เจอแค่ shelf_life_fridge_days แต่ user เลือก freezer)
    return {
      mode: "quick-pick",
      options: [3, 7, 15, "custom"],
      category: row.category,
      writeBackToReference: true,
    };
  }

  return {
    mode: "quick-pick",
    options: [3, 7, 15, "custom"],
    category: null,
    writeBackToReference: true,
  };
}

// Path B (หรือ escape-hatch จาก Path A) เขียนกลับ food_reference — เรียกตอน user ยืนยันบันทึก item จริง
// isEscapeHatch = true → ห้ามเขียนกลับ (กรณีเฉพาะของชิ้นนั้น ไม่ใช่ค่าอ้างอิงทั่วไป)
export async function maybeWriteBackReference({ foodName, category, storageLocation, days, isEscapeHatch }) {
  if (isEscapeHatch) return;

  const column =
    storageLocation === "freezer"
      ? "shelf_life_freezer_days"
      : storageLocation === "pantry"
      ? "shelf_life_pantry_days"
      : "shelf_life_fridge_days";

  await query(
    `INSERT INTO food_reference (name, category, ${column}) VALUES ($1, $2, $3)
     ON CONFLICT (name) DO UPDATE SET ${column} = EXCLUDED.${column},
       category = COALESCE(food_reference.category, EXCLUDED.category)`,
    [foodName, category || "อื่นๆ", days]
  );
}
