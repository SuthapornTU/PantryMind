-- PantryMind — เร่งความเร็ว autocomplete ตอนพิมพ์ชื่อของ (GET /api/food-reference?q=...)
-- ปัญหาเดิม: query ใช้ "name ILIKE '%...%'" (wildcard นำหน้า) ซึ่ง B-tree index ปกติช่วยอะไรไม่ได้เลย
-- ต้อง sequential scan ทั้งตารางทุกครั้งที่พิมพ์ 1 ตัวอักษร — ยิ่งตาราง food_reference โตขึ้นเรื่อยๆ
-- (ตอนนี้มีการเขียนกลับอัตโนมัติจากทั้งสแกนบาร์โค้ดและสแกนใบเสร็จ — ดู /api/barcode-lookup,
-- /api/receipt-scan) ยิ่งช้าลงเรื่อยๆ ตามจำนวนแถว
--
-- แก้ด้วย pg_trgm (trigram index) — Postgres extension มาตรฐาน เปิดใช้ได้ฟรีบน Supabase ทุก plan
-- ทำให้ ILIKE '%คำค้น%' ใช้ index ได้จริง (เร็วขึ้นมากโดยเฉพาะตารางที่ยังจะโตต่อไปเรื่อยๆ)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_food_reference_name_trgm
  ON food_reference USING gin (name gin_trgm_ops);
