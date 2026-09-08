-- PantryMind — เป้าหมายรายเดือนที่ผู้ใช้ตั้งเอง (ดู TASK_D_GOALS.md) ตาราง goals มีอยู่แล้วแต่ยังไม่มี
-- โค้ดไหนใช้เลยและมี 0 แถว ปรับโครงได้อิสระ — target_baht เดิมปล่อยไว้เฉยๆ (ไม่ลบคอลัมน์) แต่ต้องเปิด
-- ให้เป็น NULL ได้ (เดิม NOT NULL) เพราะของใหม่ทั้งหมดใช้ metric + target_value แทนแล้ว
ALTER TABLE goals ALTER COLUMN target_baht DROP NOT NULL;

ALTER TABLE goals ADD COLUMN IF NOT EXISTS metric text NOT NULL DEFAULT 'baht';
ALTER TABLE goals ADD COLUMN IF NOT EXISTS target_value numeric;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now();

ALTER TABLE goals DROP CONSTRAINT IF EXISTS goals_metric_check;
ALTER TABLE goals ADD CONSTRAINT goals_metric_check CHECK (metric IN ('baht','count'));

-- 1 user มีเป้าได้ 1 อันต่อ 1 เดือน — start_date ใช้วันที่ 1 ของเดือนนั้นเสมอ (ดู /api/goals)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_goal_user_month ON goals(user_id, start_date);
