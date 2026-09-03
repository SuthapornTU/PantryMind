-- PantryMind — เพิ่มคอลัมน์เก็บ "สัดส่วนที่เสีย" + "เหตุผลที่ทิ้ง" ใน item_events
-- ใส่ค่าเฉพาะตอน event_type = 'expired_unwanted' เท่านั้น (added/used ปล่อยเป็น NULL ทั้งหมด)
-- มาจากป็อปอัพจัดการของหมดอายุ (src/components/ResolveExpiredPopup.js) และ cron fallback
-- (ดู src/app/api/items/[id]/resolve/route.js และ src/app/api/cron/resolve-stale-items/route.js)

ALTER TABLE item_events
  ADD COLUMN IF NOT EXISTS waste_fraction NUMERIC,          -- สัดส่วนที่ "เสีย" (1 / 0.75 / 0.5 / 0.25)
  ADD COLUMN IF NOT EXISTS waste_reason_category TEXT,      -- หนึ่งใน WASTE_REASON_CATEGORIES (src/lib/constants.js)
  ADD COLUMN IF NOT EXISTS waste_reason_text TEXT;           -- ข้อความดิบที่ user พิมพ์เอง (ว่างถ้าเลือกปุ่มลัด)

-- กันค่าหลุดช่วง/หลุด event_type โดยไม่ตั้งใจ (0 ไม่มีความหมาย เพราะแปลว่า "ใช้หมดไม่ได้ทิ้งอะไร" —
-- กรณีนั้นควรเป็น event 'used' ไม่ใช่ 'expired_unwanted' อยู่แล้ว จึงไม่อนุญาตค่า 0 ในคอลัมน์นี้)
-- หมายเหตุ: PostgreSQL ไม่รองรับ ADD CONSTRAINT IF NOT EXISTS ตรงๆ — ใช้ DO block เช็คก่อนเองแทน
-- เพื่อให้รัน migration นี้ซ้ำได้อย่างปลอดภัยเหมือนไฟล์ 0001 (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'item_events_waste_fraction_range'
  ) THEN
    ALTER TABLE item_events
      ADD CONSTRAINT item_events_waste_fraction_range
        CHECK (waste_fraction IS NULL OR waste_fraction IN (0.25, 0.5, 0.75, 1));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'item_events_waste_fields_only_on_expired'
  ) THEN
    ALTER TABLE item_events
      ADD CONSTRAINT item_events_waste_fields_only_on_expired
        CHECK (
          event_type = 'expired_unwanted'
          OR (waste_fraction IS NULL AND waste_reason_category IS NULL AND waste_reason_text IS NULL)
        );
  END IF;
END $$;
