// middleware.js — refresh Supabase session token ทุก request (ตามแนวทางมาตรฐานของ @supabase/ssr)
// ต้องมีไฟล์นี้เพราะ server component อ่าน cookie ได้อย่างเดียว เขียนไม่ได้ (ดู src/lib/supabase/server.js)
// ถ้าไม่มี middleware ตัวนี้ session ที่ auto-refresh จะไม่ถูกเขียนกลับเป็นคุกกี้ใหม่ แล้ว user จะหลุด
// session บ่อยๆ ทั้งที่ยัง valid อยู่ (ดู TASK_E_AUTH.md E2)
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

export async function middleware(request) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // ต้องเรียกก่อนโค้ดอื่นทุกครั้ง — ทริกเกอร์ให้ Supabase refresh session token ถ้าใกล้หมดอายุ
  // (ห้ามลบบรรทัดนี้แม้จะดูเหมือนไม่ได้ใช้ผลลัพธ์ — ผลข้างเคียงคือการ refresh คุกกี้)
  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
