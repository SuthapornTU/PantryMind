-- PantryMind — ผูก auth.users (Supabase Auth, UUID) เข้ากับ users (integer) ที่มีอยู่แล้ว (ดู
-- TASK_E_AUTH.md E4) ห้ามแปลง users.id เป็น UUID เพราะมี 7 ตารางอ้างอิงอยู่ (จะพังหมด) ใช้คอลัมน์
-- auth_user_id เป็นตัวเชื่อมแทน — users.id = 1 (ทดสอบ) และ = 2 (บัญชีเดโม) ที่มีอยู่แล้วห้ามลบ
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE;
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON users(auth_user_id);
