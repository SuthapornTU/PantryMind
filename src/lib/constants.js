// src/lib/constants.js — ค่าคงที่ที่ใช้ร่วมกันระหว่างฟอร์ม/API (หมวดหมู่ + ที่เก็บ)
// อิงตาม docs/ARCHITECTURE.md หัวข้อ 4 (Data Entry Fields)

export const CATEGORIES = [
  "นม/ไข่",
  "เนื้อสัตว์",
  "ผัก/ผลไม้",
  "เบเกอรี่",
  "ของแห้ง/เครื่องปรุง",
  "เครื่องดื่ม",
  "อื่นๆ",
];

export const STORAGE_LOCATIONS = [
  { value: "fridge", label: "ตู้เย็น" },
  { value: "freezer", label: "ช่องแช่แข็ง" },
  { value: "pantry", label: "ที่เก็บแห้ง" },
];

export function storageLabel(value) {
  return STORAGE_LOCATIONS.find((s) => s.value === value)?.label || value;
}
