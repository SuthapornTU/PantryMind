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

export const STORAGE_LOCATIONS = [
  { value: "fridge", label: "ตู้เย็น" },
  { value: "freezer", label: "ช่องแช่แข็ง" },
  { value: "pantry", label: "ที่เก็บแห้ง" },
];

export function storageLabel(value) {
  return STORAGE_LOCATIONS.find((s) => s.value === value)?.label || value;
}
