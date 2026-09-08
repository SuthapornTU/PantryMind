-- scripts/cleanup-anon.sql — ล้างบัญชี anonymous ที่ทิ้งค้างไว้นาน (ดู TASK_E_AUTH.md E10)
-- รันเดือนละครั้ง (มือ หรือ cron ภายนอกยิง SQL นี้ผ่าน Supabase) — ลบบัญชี anonymous ที่สร้างมาเกิน
-- 30 วันแล้ว (คนที่เปิดแอปแล้วไม่กลับมาอีกเลย ไม่ใช่ผู้ใช้จริงที่ยังใช้งานต่อเนื่อง)
--
-- หมายเหตุ: ลบจาก auth.users จะ cascade ไปลบแถวใน public.users ที่ auth_user_id ตรงกันด้วยหรือไม่
-- ขึ้นอยู่กับว่า public.users.auth_user_id มี FK ผูกกับ auth.users(id) แบบ ON DELETE CASCADE หรือเปล่า
-- (migration 0006 ใส่แค่ UNIQUE ไม่ได้ใส่ FK ไว้ ถ้าต้องการให้ public.users ลบตามด้วยอัตโนมัติ ให้เพิ่ม
-- FK constraint นั้นแยกต่างหาก มิเช่นนั้นแถว public.users + pantry_items ของบัญชีผีจะค้างอยู่ต่อไป
-- แค่ auth.users หายไป — ตรวจสอบก่อนรันจริงว่าต้องการผลแบบไหน)
delete from auth.users
where is_anonymous is true and created_at < now() - interval '30 days';
