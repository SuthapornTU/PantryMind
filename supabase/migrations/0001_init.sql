-- PantryMind — Initial schema
-- รวมทุกตารางตาม docs/ARCHITECTURE.md หัวข้อ 7 และ docs/RULE_BASED_IMPLEMENTATION.md
-- สร้างไว้ล่วงหน้าทั้งหมดเพื่อให้ฟีเจอร์ต่อไปเพิ่มได้โดยไม่ต้อง migrate ใหม่บ่อยๆ
-- แต่โค้ด API/หน้าเว็บในรอบนี้ (Core CRUD, ลำดับ build ข้อ 1 ใน ARCHITECTURE.md) ใช้แค่
-- users, pantry_items, item_events, food_reference เท่านั้น — ตารางที่เหลือ (shopping_list,
-- goals, missions*, barcode_map, user_devices, recipes*) รอ implement ตามลำดับ build ข้อ 3-8
--
-- หมายเหตุ: users.id เป็น SERIAL ชั่วคราว (ยังไม่ได้ต่อ Supabase Auth จริง — ดู TODO(auth)
-- ใน src/lib/demoUser.js) เมื่อเชื่อม Supabase Auth แล้วให้พิจารณาย้ายเป็น UUID
-- อ้างอิง auth.users(id) แทน แล้ว migrate ข้อมูลเดิม

-- ============ Users (ชั่วคราว ก่อนต่อ Supabase Auth) ============
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE,
  created_at TIMESTAMP DEFAULT now()
);

-- demo user สำหรับตอนที่ยังไม่มีระบบ login จริง (ดู src/lib/demoUser.js)
INSERT INTO users (id, email) VALUES (1, 'demo@pantrymind.local')
  ON CONFLICT (id) DO NOTHING;
SELECT setval('users_id_seq', GREATEST((SELECT MAX(id) FROM users), 1));

-- ============ food_reference (lookup table วันหมดอายุ) ============
CREATE TABLE IF NOT EXISTS food_reference (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE, -- UNIQUE เพิ่มจากเอกสารต้นฉบับ เพื่อให้ ON CONFLICT (name) ใช้ upsert ตอน Path B เขียนกลับได้
  aliases TEXT[],
  category TEXT NOT NULL,
  icon TEXT,
  shelf_life_fridge_days INT,
  shelf_life_freezer_days INT,
  shelf_life_pantry_days INT
);

INSERT INTO food_reference (name, category, shelf_life_fridge_days, shelf_life_freezer_days, shelf_life_pantry_days) VALUES
('ไข่ไก่',       'นม/ไข่',   28,  NULL, NULL),
('นมสด',        'นม/ไข่',   7,   90,   NULL),
('เนื้อหมู',      'เนื้อสัตว์', 4,   120,  NULL),
('เนื้อไก่',      'เนื้อสัตว์', 2,   270,  NULL),
('ปลา',         'เนื้อสัตว์', 2,   180,  NULL),
('ผักกาดขาว',    'ผัก/ผลไม้', 10,  NULL, NULL),
('คะน้า',        'ผัก/ผลไม้', 7,   NULL, NULL),
('แตงกวา',       'ผัก/ผลไม้', 7,   NULL, NULL),
('มะเขือเทศ',     'ผัก/ผลไม้', 7,   NULL, NULL),
('ขนมปัง',       'เบเกอรี่',  10,  30,   5),
('ไส้กรอก',      'เนื้อสัตว์', 7,   60,   NULL)
ON CONFLICT (name) DO NOTHING;
-- เป้าหมาย ~50-100 รายการก่อน pilot จริง (ดู docs/PROJECT_CONTEXT.md ข้อ 9.3) — เพิ่มได้เรื่อยๆ

-- ============ pantry_items ============
CREATE TABLE IF NOT EXISTS pantry_items (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  storage_location TEXT NOT NULL CHECK (storage_location IN ('fridge','freezer','pantry')),
  expiry_date DATE NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  price_per_unit NUMERIC,
  added_at TIMESTAMP DEFAULT now(),
  used_at TIMESTAMP,          -- เพิ่มจากเอกสารต้นฉบับ: mark ว่ากด "ใช้แล้ว" เมื่อไหร่ (NULL = ยังอยู่ในตู้)
  notified_at TIMESTAMP       -- กันส่ง push notification ซ้ำวันเดียวกัน (ใช้ตอน build ข้อ 6)
);

CREATE INDEX IF NOT EXISTS idx_pantry_items_user_expiry ON pantry_items (user_id, expiry_date);

-- ============ item_events (สำหรับ nudge + personalization, build ข้อ 4) ============
CREATE TABLE IF NOT EXISTS item_events (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  item_name TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('added','used','expired_unwanted')),
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_item_events_user_item ON item_events (user_id, item_name);

-- ============ barcode_map (build ข้อ 3) ============
CREATE TABLE IF NOT EXISTS barcode_map (
  barcode TEXT PRIMARY KEY,
  name TEXT,
  category TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- ============ shopping_list (build ข้อ 4) ============
CREATE TABLE IF NOT EXISTS shopping_list (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  item_name TEXT NOT NULL,
  quantity NUMERIC DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','checked')),
  created_at TIMESTAMP DEFAULT now()
);

-- ============ goals (build ข้อ 7) ============
CREATE TABLE IF NOT EXISTS goals (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  target_baht NUMERIC NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL
);

-- ============ missions + tree gamification (build ข้อ 7) ============
CREATE TABLE IF NOT EXISTS mission_templates (
  id SERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE, -- เช่น 'use_near_expiry_items', 'check_pantry_before_buying'
  description TEXT NOT NULL,
  unit TEXT
);

INSERT INTO mission_templates (key, description, unit) VALUES
('use_near_expiry_items', 'ใช้ของใกล้หมดอายุ', 'ชิ้น'),
('check_pantry_before_buying', 'เช็คตู้ก่อนซื้อ', 'ครั้ง'),
('log_items_daily_streak', 'บันทึกของทุกวันติดต่อกัน', 'วัน'),
('cook_from_suggested_recipe', 'ทำเมนูจากของที่มี', 'ครั้ง'),
('heed_shopping_nudge', 'ฟังคำเตือน nudge', 'ครั้ง')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS missions (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  template_id INT NOT NULL REFERENCES mission_templates(id),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  target NUMERIC NOT NULL,
  progress NUMERIC NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (user_id, template_id, date)
);

CREATE TABLE IF NOT EXISTS tree_progress (
  user_id INT PRIMARY KEY REFERENCES users(id),
  level INT NOT NULL DEFAULT 1,
  water_drops INT NOT NULL DEFAULT 0
);

-- ============ user_devices (push notification, build ข้อ 6) ============
CREATE TABLE IF NOT EXISTS user_devices (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  fcm_token TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE (user_id, fcm_token)
);

-- ============ recipes (recipe suggestion, build ข้อ 8) ============
CREATE TABLE IF NOT EXISTS recipes (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  instructions TEXT
);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
  recipe_id INT REFERENCES recipes(id),
  ingredient_name TEXT NOT NULL,
  PRIMARY KEY (recipe_id, ingredient_name)
);

INSERT INTO recipes (id, name) VALUES
  (1, 'ผัดกะเพราไข่ดาว'), (2, 'ไข่เจียว'), (3, 'ต้มจืดผักกาดขาว')
ON CONFLICT (id) DO NOTHING;
SELECT setval('recipes_id_seq', GREATEST((SELECT MAX(id) FROM recipes), 1));

INSERT INTO recipe_ingredients (recipe_id, ingredient_name) VALUES
(1, 'เนื้อหมู'), (1, 'ไข่ไก่'), (1, 'กะเพรา'),
(2, 'ไข่ไก่'),
(3, 'ผักกาดขาว'), (3, 'เนื้อหมู')
ON CONFLICT DO NOTHING;
-- เป้าหมาย ~30-50 เมนูก่อน pilot จริง (ดู docs/PROJECT_CONTEXT.md ข้อ 9.3)
