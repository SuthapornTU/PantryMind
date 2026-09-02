// src/lib/db.js
// Postgres connection ไปที่ Supabase โดยตรง (ใช้ raw SQL เพราะบาง query เช่น waste_rate,
// streak, recipe matching % ใช้ window function/FILTER ที่เขียนด้วย Supabase JS query builder
// ตรงๆ ได้ยาก — ใช้ raw SQL ผ่าน `pg` แทน ส่วน Supabase Auth/Storage จะใช้ @supabase/supabase-js แยกต่างหาก)
//
// ห้าม import ไฟล์นี้จาก client component — ใช้ได้เฉพาะใน API routes / server components เท่านั้น

import { Pool } from "pg";

let pool;

function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        "DATABASE_URL ยังไม่ได้ตั้งค่า — คัดลอก ENV_TEMPLATE.txt เป็น .env.local แล้วใส่ " +
          "connection string ของ Supabase (Project Settings → Database → Connection string → URI, " +
          "โหมด 'Transaction' หรือ 'Session' ก็ได้)"
      );
    }
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // Supabase ใช้ self-signed chain บน pooler บางโหมด — ปิด strict verify ตามคำแนะนำของ Supabase
      ssl: { rejectUnauthorized: false },
      max: 5,
    });
  }
  return pool;
}

export function query(text, params) {
  return getPool().query(text, params);
}
