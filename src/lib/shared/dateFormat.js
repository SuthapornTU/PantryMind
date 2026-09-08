// src/lib/shared/dateFormat.js
// จัดรูปแบบวันที่สำหรับแสดงผล (frontend-only, ไม่แตะ backend)

// วันหมดอายุแบบ DD/MM/YY ปี พ.ศ. (เช่น 2026-09-10 -> "10/09/69")
export function formatExpiryDateBE(dateStr) {
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const beYear = d.getFullYear() + 543;
  const yy = String(beYear).slice(-2);
  return `${day}/${month}/${yy}`;
}
