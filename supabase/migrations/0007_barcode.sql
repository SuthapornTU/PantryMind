-- PantryMind — เพิ่มการสแกนบาร์โค้ดสินค้า (ต่อจาก tab "สแกนบาร์โค้ด" ที่เตรียมไว้ใน
-- src/app/add-item/camera/page.js แต่ยัง disable อยู่) — เก็บเลขบาร์โค้ด (EAN/UPC) คู่กับชื่อ/หมวดหมู่
-- ใน food_reference เดิม เพื่อให้สแกนซ้ำครั้งหน้าเจอทันทีโดยไม่ต้องเรียก API ภายนอกอีก
-- (ดู src/app/api/barcode-lookup/route.js — เช็คคอลัมน์นี้ก่อนเสมอ ก่อนจะ fallback ไป Open Food Facts)
ALTER TABLE food_reference ADD COLUMN IF NOT EXISTS barcode TEXT;

-- กันบาร์โค้ดซ้ำ (1 บาร์โค้ด ผูกกับสินค้าเดียว) แต่ยอมให้เป็น NULL ได้หลายแถว (ของเดิมที่ seed ไว้
-- ไม่มีบาร์โค้ด) — Postgres unique index ไม่นับ NULL ว่าซ้ำกันอยู่แล้ว จึงไม่ต้องกรอง WHERE เพิ่ม
CREATE UNIQUE INDEX IF NOT EXISTS uniq_food_reference_barcode ON food_reference(barcode);
