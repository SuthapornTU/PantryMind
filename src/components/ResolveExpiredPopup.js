"use client";

// ป็อปอัพจัดการของหมดอายุที่ยังไม่ resolve — เด้งทีละรายการตอนเปิดแอป (รายการมาจาก
// getExpiredUnresolvedItems() ใน src/lib/server/dashboard.js, ส่งเข้ามาทาง prop จาก src/app/page.js)
// "ใช้แล้ว" เรียก endpoint เดิม PATCH /api/items/[id] (action: "used") ไม่เขียน logic ใหม่
// "ปล่อยให้เสีย" ใช้ WasteResolveForm (component เดียวกับปุ่ม 🗑 ในหน้ากลุ่ม /items/[name] — ดู B4
// ใน TASK_B_UI.md ที่บอกให้ทำเป็น component เดียวใช้ร่วมกัน ไม่ใช่เขียนฟอร์ม fraction/เหตุผลซ้ำที่นี่)
//
// src/app/page.js เป็น async server component ดึงข้อมูลครั้งเดียวตอน render แล้วส่ง items เข้ามาทาง
// prop — ถ้าไม่บอก Next ให้ re-fetch server component นี้ใหม่ การ์ด/badge หน้าแรกจะค้างข้อมูลเก่าแม้
// DB จะอัปเดตถูกแล้ว (เพราะ props เดิมจาก render รอบก่อนยังอยู่) goToNext() คือจุดเดียวที่ทั้ง markUsed
// และ WasteResolveForm (ผ่าน onDone) เรียกหลังบันทึกสำเร็จ เลยเรียก router.refresh() ที่นี่ที่เดียว
// ครอบคลุมทั้ง 2 เส้นทาง — ไม่ใส่ใน WasteResolveForm.handleSubmit() ตรงๆ เพราะ component นั้นถูกใช้ซ้ำ
// ที่หน้า /items/[name] ด้วย ซึ่งมี onDone ของตัวเองที่เรียก load() (client-side fetch) อยู่แล้ว ถ้าใส่
// router.refresh() ในนั้นด้วยจะยิงซ้ำซ้อนโดยไม่จำเป็น
import { useState } from "react";
import { useRouter } from "next/navigation";
import WasteResolveForm from "./WasteResolveForm";

export default function ResolveExpiredPopup({ items }) {
  const router = useRouter();
  const [queue, setQueue] = useState(items || []);
  const [step, setStep] = useState("choice"); // "choice" | "waste-detail"
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (queue.length === 0) return null;
  const current = queue[0];

  function goToNext() {
    setQueue((prev) => prev.slice(1));
    setStep("choice");
    setError(null);
    router.refresh(); // ให้ src/app/page.js (server component) ดึงข้อมูลใหม่ การ์ด/badge จะได้ตรงกับ DB จริง
  }

  async function markUsed() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/items/${current.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "used" }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "บันทึกไม่สำเร็จ");
      goToNext();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-800 shadow-lg p-4 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
        {step === "choice" && (
          <>
            <div>
              <p className="text-xs text-zinc-400">ของหมดอายุแล้ว</p>
              <p className="font-semibold text-lg text-zinc-900 dark:text-zinc-50">{current.name}</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={markUsed}
                disabled={busy}
                className="flex-1 rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200 disabled:opacity-50 py-2.5 text-sm font-medium"
              >
                ใช้แล้ว
              </button>
              <button
                type="button"
                onClick={() => setStep("waste-detail")}
                disabled={busy}
                className="flex-1 rounded-full bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white py-2.5 text-sm font-medium"
              >
                ปล่อยให้เสีย
              </button>
            </div>
            {error && <p className="text-sm text-rose-600">{error}</p>}
          </>
        )}

        {step === "waste-detail" && (
          <WasteResolveForm item={current} onDone={goToNext} onCancel={() => setStep("choice")} />
        )}
      </div>
    </div>
  );
}
