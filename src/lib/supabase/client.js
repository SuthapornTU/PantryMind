// src/lib/supabase/client.js — Supabase client ฝั่ง browser (client component เท่านั้น)
// ใช้ createBrowserClient จาก @supabase/ssr (เก็บ session เป็นคุกกี้ ไม่ใช่ localStorage) ตามที่
// TASK_E_AUTH.md E2 บังคับไว้ — เหตุผล: Safari บน iPhone ลบข้อมูลที่ localStorage เขียนไว้ถ้าไม่เปิดเว็บ
// 7 วัน แอปนี้เป็นแอปที่เว้นสัปดาห์นึงเป็นเรื่องปกติ ข้อมูล user จะหายทั้งก้อนถ้าใช้ localStorage
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
