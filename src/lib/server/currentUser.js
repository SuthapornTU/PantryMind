// src/lib/server/currentUser.js — หัวใจของระบบผู้ใช้ anonymous-first (ดู TASK_E_AUTH.md E5)
// เรียกได้จาก Server Component / Route Handler เท่านั้น (ใช้ cookies() ผ่าน src/lib/supabase/server.js)
//
// ทุก query ที่แตะข้อมูลผู้ใช้ต้องเอา user_id (integer, ตาราง public.users) มาจากฟังก์ชันนี้เท่านั้น
// ห้ามรับ user_id จาก client (body/query/header) เด็ดขาด — ดู E6: RLS ปิดอยู่ทั้ง 13 ตาราง +
// ต่อ DB ตรงด้วย pg (bypass RLS) แปลว่าไม่มีตาข่ายรองรับชั้นที่สองเลยถ้า API เชื่อ client
import { query } from "./db";
import { createClient } from "../supabase/server";

// คืน integer user_id (public.users.id) ของคนที่ล็อกอินอยู่ตอนนี้ หรือ null ถ้ายังไม่มี session เลย
// (เช่น เพิ่งเปิดแอปครั้งแรกก่อนที่ signInAnonymously() ฝั่ง client จะทำงาน — ดู E7) ฝั่ง client ต้อง
// เรียก signInAnonymously() แล้ว reload ใหม่เมื่อเจอ null ไม่ใช่ fallback ไป DEMO_USER_ID เด็ดขาด
export async function getCurrentUserId() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  const existing = await query(`SELECT id FROM users WHERE auth_user_id = $1`, [authUser.id]);
  if (existing.rows.length > 0) return existing.rows[0].id;

  // ครั้งแรกของ auth user คนนี้ — สร้างแถว users ใหม่ กัน race condition (สอง request พร้อมกันตอน
  // เพิ่งสร้างบัญชี anonymous) ด้วย ON CONFLICT DO NOTHING แล้ว select ซ้ำแทนการเชื่อ RETURNING เฉยๆ
  await query(
    `INSERT INTO users (auth_user_id, email) VALUES ($1, $2) ON CONFLICT (auth_user_id) DO NOTHING`,
    [authUser.id, authUser.email || null]
  );
  const inserted = await query(`SELECT id FROM users WHERE auth_user_id = $1`, [authUser.id]);
  return inserted.rows[0]?.id ?? null;
}
