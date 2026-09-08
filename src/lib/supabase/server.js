// src/lib/supabase/server.js — Supabase client ฝั่ง server (Server Component / Route Handler เท่านั้น
// ห้าม import จาก client component) อ่าน/เขียนคุกกี้ผ่าน next/headers cookies() ตามแนวทางมาตรฐานของ
// @supabase/ssr — ใช้โดย src/lib/server/currentUser.js เป็นหลัก (ดู TASK_E_AUTH.md E2/E5)
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // เรียกจาก Server Component (ไม่ใช่ Route Handler/Server Action) เซ็ตคุกกี้ตรงๆ ไม่ได้
          // เงียบไว้ได้ — middleware.js เป็นตัวที่ refresh session token ให้จริงๆ อยู่แล้ว
        }
      },
    },
  });
}
