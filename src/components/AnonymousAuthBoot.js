"use client";

// เริ่มใช้งานครั้งแรกแบบไม่มีหน้าล็อกอินเลย (ดู TASK_E_AUTH.md E7) — mount ไว้ที่ root layout
// ทุกหน้า เช็คว่ามี session อยู่แล้วหรือยัง ถ้ายังไม่มีเรียก signInAnonymously() แล้ว refresh หน้า
// ให้ Server Component (เช่น src/app/page.js) อ่าน session cookie ใหม่ได้ทันที
// ไม่มีหน้าล็อกอิน ไม่มีปุ่ม ไม่มีข้อความอะไรทั้งนั้นตอนสำเร็จ — user ไม่ต้องรู้ว่าเกิดอะไรขึ้น
// ถ้าสร้าง session ไม่สำเร็จ (เช่นโดน rate limit) → ข้อความไทย + ปุ่มลองใหม่ ห้ามเงียบแล้วปล่อยผ่าน
// เด็ดขาด (ห้ามตกกลับไปใช้ DEMO_USER_ID เพราะจะกลายเป็นเห็นข้อมูลคนอื่น — ดู src/lib/server/demoUser.js)
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AnonymousAuthBoot() {
  const router = useRouter();
  const [error, setError] = useState(null);
  const [retrying, setRetrying] = useState(false);

  async function ensureSession() {
    setError(null);
    setRetrying(true);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) return; // มี session อยู่แล้ว (เปิดแอปซ้ำ) ไม่ต้องทำอะไร

      const { error: signInError } = await supabase.auth.signInAnonymously();
      if (signInError) throw signInError;

      // ทำให้ Server Component ที่อ่าน cookie ไปแล้ว (ตอนยังไม่มี session) รันใหม่ด้วย session ที่เพิ่งได้
      router.refresh();
    } catch (err) {
      const isRateLimit = err?.status === 429 || /rate limit/i.test(err?.message || "");
      setError(
        isRateLimit
          ? "ตอนนี้มีคนเข้าใช้งานพร้อมกันเยอะ ลองใหม่อีกครั้งในอีกสักครู่นะ"
          : "เริ่มต้นใช้งานไม่สำเร็จ ลองใหม่อีกครั้งนะ"
      );
    } finally {
      setRetrying(false);
    }
  }

  useEffect(() => {
    ensureSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!error) return null; // ปกติ (สำเร็จ/มี session อยู่แล้ว) ไม่โชว์อะไรเลย

  return (
    <div className="fixed inset-0 z-[999] bg-black/50 flex items-center justify-center px-6">
      <div className="w-full max-w-xs rounded-2xl bg-white dark:bg-zinc-800 shadow-lg p-5 flex flex-col items-center gap-3 text-center">
        <p className="text-sm text-zinc-700 dark:text-zinc-300">{error}</p>
        <button
          type="button"
          onClick={ensureSession}
          disabled={retrying}
          className="rounded-full bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white px-5 py-2 text-sm font-medium"
        >
          {retrying ? "กำลังลองใหม่..." : "ลองใหม่"}
        </button>
      </div>
    </div>
  );
}
