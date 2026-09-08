// src/lib/constants.js — ค่าคงที่ที่ใช้ร่วมกันระหว่างฟอร์ม/API (หมวดหมู่ + ที่เก็บ)

export const CATEGORIES = [
  "นม/ไข่",
  "เนื้อสัตว์",
  "ผัก/ผลไม้",
  "เบเกอรี่",
  "ของแห้ง/เครื่องปรุง",
  "เครื่องดื่ม",
  "อื่นๆ",
];

// ที่เก็บ default ต่อหมวดหมู่ — ใช้ตอนสแกนใบเสร็จเพื่อเดาที่เก็บล่วงหน้าให้แต่ละรายการ
// (ก่อนเรียก /api/expiry-estimate เพื่อเช็ค Path A/B) — user ยังเปลี่ยนที่เก็บเองได้เสมอในหน้ารีวิว
export const CATEGORY_DEFAULT_STORAGE = {
  "นม/ไข่": "fridge",
  "เนื้อสัตว์": "fridge",
  "ผัก/ผลไม้": "fridge",
  "เบเกอรี่": "pantry",
  "ของแห้ง/เครื่องปรุง": "pantry",
  "เครื่องดื่ม": "fridge",
  "อื่นๆ": "fridge",
};

// ตัวเลือกเหตุผลที่ทิ้งของ — ใช้ในป็อปอัพจัดการของหมดอายุ (ResolveExpiredPopup) และเป็นลิสต์ที่
// /api/classify-waste-reason บังคับให้ AI ตอบได้แค่ค่าในนี้เท่านั้น "อื่นๆ" เป็น catch-all เผื่อ
// ข้อความที่ user พิมพ์เองไม่เข้าหมวดไหนเลย
export const WASTE_REASON_CATEGORIES = ["ซื้อเยอะไป", "ลืมกิน", "ไม่ชอบ", "อื่นๆ"];

export const STORAGE_LOCATIONS = [
  { value: "fridge", label: "ตู้เย็น" },
  { value: "freezer", label: "ช่องแช่แข็ง" },
  { value: "pantry", label: "ที่เก็บแห้ง" },
];

export function storageLabel(value) {
  return STORAGE_LOCATIONS.find((s) => s.value === value)?.label || value;
}

// เกณฑ์ "ใกล้หมดอายุ" — เลข 3 วันตัวเดียวกับที่หน้า Home (src/lib/server/dashboard.js) และภารกิจ
// (src/lib/server/missions.js: NEAR_EXPIRY_DAYS) ใช้อยู่แล้ว แยกมาไว้ในไฟล์ client-safe นี้ต่างหาก
// เพราะสองไฟล์นั้น import "pg" (server-only) — ห้าม import ตรงจาก client component
export const NEAR_EXPIRY_DAYS = 3;
