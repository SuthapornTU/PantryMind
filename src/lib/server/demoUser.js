// src/lib/demoUser.js
//
// TODO(auth): ยังไม่ได้ต่อ Supabase Auth จริง (ตัดสินใจแล้วว่าจะใช้ Supabase Auth แบบ
// Email/Password + Google OAuth) ตอนนี้ทุก query ที่ต้องใช้ user_id ใช้ค่าคงที่นี้ไปก่อน
// เพื่อให้ core CRUD (pantry items + dashboard) ทำงาน/เทสได้จริงโดยไม่ต้องรอ Auth เสร็จ
//
// เมื่อเชื่อม Supabase Auth แล้ว: แทนที่ทุกจุดที่ import DEMO_USER_ID ด้วยการอ่าน user_id จริง
// จาก session (เช่น `const { data: { session } } = await supabase.auth.getSession()`)
// และพิจารณาย้าย users.id จาก SERIAL เป็น UUID อ้างอิง auth.users(id)

export const DEMO_USER_ID = 1;
