"use client";

// แถบชวนเพิ่ม PantryMind ลงหน้าจอโฮม (ดู TASK_E_AUTH.md E8) — โผล่เมื่อมีของในตู้เย็นตั้งแต่ 3 ชิ้น
// ขึ้นไป "และ" ไม่ใช่ครั้งแรกที่เปิดแอป (เช็คด้วย localStorage flag — ครั้งแรกสุดแค่จำไว้เฉยๆ ไม่โชว์)
// เหตุผลที่ต้องชวนครั้งเดียวนี้: iPhone ต้องติดตั้งก่อนถึงจะรับ push ได้ + แอปที่ติดตั้งแล้วไม่โดนกฎลบ
// ข้อมูลของ Safari หลัง 7 วันไม่เปิด (คุกกี้/localStorage ที่ signInAnonymously ใช้อยู่ ถ้าเป็นแท็บ
// เบราว์เซอร์ธรรมดาจะโดนลบ ทำให้ตู้เย็นหายทั้งก้อน — ดู TASK_E_AUTH.md E2/E9)
import { useEffect, useState } from "react";

const VISITED_KEY = "pantrymind_visited_before";
const DISMISSED_KEY = "pantrymind_a2hs_dismissed";

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export default function AddToHomeScreenPrompt({ itemCount }) {
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    try {
      const visitedBefore = localStorage.getItem(VISITED_KEY) === "1";
      const dismissed = localStorage.getItem(DISMISSED_KEY) === "1";
      if (!visitedBefore) {
        localStorage.setItem(VISITED_KEY, "1");
        return; // ครั้งแรกที่เปิด — จำไว้อย่างเดียว ยังไม่โชว์
      }
      setIos(isIOS());
      setVisible(!dismissed && itemCount >= 3);
    } catch {
      // localStorage ใช้ไม่ได้ (private mode บางเบราว์เซอร์) — เงียบไว้ ไม่โชว์แถบเลยดีกว่าพัง
    }
  }, [itemCount]);

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // เงียบไว้เหมือนกัน
    }
  }

  if (!visible) return null;

  return (
    <div className="mx-4 mb-4 rounded-2xl bg-white dark:bg-zinc-800 shadow-sm p-3.5 flex items-start gap-3">
      <span className="text-2xl leading-none shrink-0">📱</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
          เพิ่ม PantryMind ลงหน้าจอโฮม
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
          เพื่อรับการแจ้งเตือน และไม่ให้ข้อมูลหาย
        </p>
        {ios && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5">
            แตะปุ่ม แชร์ (□↑) ด้านล่าง แล้วเลือก &quot;เพิ่มไปยังหน้าจอโฮม&quot;
          </p>
        )}
      </div>
      <button
        type="button"
        aria-label="ปิด"
        onClick={dismiss}
        className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"
      >
        ×
      </button>
    </div>
  );
}
