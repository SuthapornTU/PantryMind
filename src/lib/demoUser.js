// src/lib/demoUser.js
//
// TODO(auth): ยังไม่ได้ต่อ Supabase Auth จริง (ดู docs/ARCHITECTURE.md หัวข้อ 7 —
// ตัดสินใจแล้วว่าใช้ Supabase Auth แบบ Email/Password + Google OAuth) ตอนนี้ทุก query
// ที่ต้องใช้ user_id ใช้ค่าคงที่นี้ไปก่อนเพื่อให้ core CRUD (pantry items + dashboard,
// ลำดับ build ข้อ 1 ใน ARCHITECTURE.md) ทำงาน/เทสได้จริงโดยไม่ต้องรอ Auth เสร็จ
//
// เมื่อเชื่อม Supabase Auth แล้ว: แทนที่ทุกจุดที่ import DEMO_USER_ID ด้วยการอ่าน user_id จริง
// จาก session (เช่น `const { data: { session } } = await supabase.auth.getSession()`)
// และพิจารณาย้าย users.id จาก SERIAL เป็น UUID อ้างอิง auth.users(id) ตามที่โน้ตไว้ใน
// supabase/migrations/0001_init.sql

export const DEMO_USER_ID = 1;
