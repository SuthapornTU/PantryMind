-- PantryMind — แก้โครงสร้างข้อมูลรองรับการคิดเงินที่ถูกต้อง (ดู TASK_A_DATA.md)
-- ชิ้นที่กินแล้ว / ทิ้งแล้ว / เศษของชิ้นที่เปิดค้างอยู่
ALTER TABLE pantry_items ADD COLUMN IF NOT EXISTS used_count   integer NOT NULL DEFAULT 0;
ALTER TABLE pantry_items ADD COLUMN IF NOT EXISTS wasted_count numeric NOT NULL DEFAULT 0;
-- สัดส่วนที่ "ใช้ไปแล้ว" ของชิ้นที่เปิดค้างอยู่ (0..1) · NULL = ไม่มีชิ้นไหนเปิดค้าง
ALTER TABLE pantry_items ADD COLUMN IF NOT EXISTS open_fraction numeric;

-- ผูก event เข้ากับแถวที่มันเกิดจริง (เดิมเก็บแค่ item_name แล้วต้องเดาว่ามาจากแถวไหน — ดู A3)
ALTER TABLE item_events ADD COLUMN IF NOT EXISTS item_id      integer REFERENCES pantry_items(id);
-- จำนวนชิ้นที่ทิ้ง (เช่น 2.25 แพ็ค) — ไม่ใช่สัดส่วนแบบ waste_fraction เดิม (ดู A2)
-- เก็บ waste_fraction เดิมไว้ อย่าลบ (มีข้อมูลเก่า 51 แถว) ของใหม่เขียนลง wasted_units เท่านั้น
ALTER TABLE item_events ADD COLUMN IF NOT EXISTS wasted_units numeric;

-- constraint เดิมบังคับ waste_fraction ให้เป็น 0.25/0.5/0.75/1 เท่านั้น ใช้กับ wasted_units ไม่ได้ (ตัด)
ALTER TABLE item_events DROP CONSTRAINT IF EXISTS item_events_waste_fraction_range;
-- constraint นี้ต้องรู้จัก wasted_units ด้วย ไม่งั้น insert ไม่ผ่าน
ALTER TABLE item_events DROP CONSTRAINT IF EXISTS item_events_waste_fields_only_on_expired;
ALTER TABLE item_events ADD CONSTRAINT item_events_waste_fields_only_on_expired
  CHECK (event_type = 'expired_unwanted'
         OR (waste_fraction IS NULL AND wasted_units IS NULL
             AND waste_reason_category IS NULL AND waste_reason_text IS NULL));

CREATE INDEX IF NOT EXISTS idx_item_events_item_id ON item_events(item_id);
CREATE INDEX IF NOT EXISTS idx_pantry_items_user_name ON pantry_items(user_id, name);
