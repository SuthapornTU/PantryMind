// src/lib/monthUtils.js — ฟังก์ชันจัดการ "เดือน" แบบ pure (ไม่แตะ DB) ใช้ได้ทั้ง client/server
// แยกออกจาก src/lib/wasteStats.js เพราะไฟล์นั้น import "pg" (server-only) — หน้า stats เป็น
// client component ถ้า import wasteStats.js ตรงๆ จะดึง Node module เข้า client bundle ไปด้วย

const THAI_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

export function currentMonthStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function shiftMonth(monthStr, delta) {
  const [y, m] = monthStr.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// ช่วงวันที่ [start, end) ของเดือนนั้น สำหรับใช้เป็นเงื่อนไข WHERE created_at >= start AND < end
export function monthRange(monthStr) {
  const [y, m] = monthStr.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

// "ส.ค. 69" — เดือนย่อไทย + ปี พ.ศ. 2 หลักท้าย
export function thaiMonthLabel(monthStr) {
  const [y, m] = monthStr.split("-").map(Number);
  const buddhistYear = y + 543;
  return `${THAI_MONTHS_SHORT[m - 1]} ${String(buddhistYear).slice(-2)}`;
}

export function isCurrentMonth(monthStr) {
  return monthStr === currentMonthStr();
}
