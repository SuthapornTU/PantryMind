"use client";

// ป็อปอัพจัดการของหมดอายุที่ยังไม่ resolve — เด้งทีละรายการตอนเปิดแอป (รายการมาจาก
// getExpiredUnresolvedItems() ใน src/lib/server/dashboard.js, ส่งเข้ามาทาง prop จาก src/app/page.js)
// "ใช้แล้ว" เรียก endpoint เดิม PATCH /api/items/[id] (action: "used") ไม่เขียน logic ใหม่
// "ปล่อยให้เสีย" เก็บสัดส่วนที่ใช้ก่อนทิ้ง + เหตุผล แล้วยิง POST /api/items/[id]/resolve (endpoint ใหม่)
import { useState } from "react";
import { WASTE_REASON_CATEGORIES } from "@/lib/shared/constants";

const FRACTION_OPTIONS = [
  { usedPercent: 0, wasteFraction: 1, label: "ยังไม่ได้ใช้เลย" },
  { usedPercent: 0.25, wasteFraction: 0.75, label: "ใช้ไปนิดหน่อย" },
  { usedPercent: 0.5, wasteFraction: 0.5, label: "ใช้ไปครึ่งนึง" },
  { usedPercent: 0.75, wasteFraction: 0.25, label: "ใช้ไปเกือบหมด" },
];

const QUICK_REASONS = WASTE_REASON_CATEGORIES.filter((c) => c !== "อื่นๆ"); // "อื่นๆ" ไม่มีปุ่มลัด — ต้องพิมพ์เอง

function FractionCircle({ usedPercent, active }) {
  const deg = usedPercent * 360;
  return (
    <span
      className={`w-9 h-9 rounded-full border-2 shrink-0 ${
        active ? "border-rose-500 ring-2 ring-rose-200" : "border-zinc-200"
      }`}
      style={{ background: `conic-gradient(#f43f5e ${deg}deg, #e5e7eb ${deg}deg)` }}
    />
  );
}

export default function ResolveExpiredPopup({ items }) {
  const [queue, setQueue] = useState(items || []);
  const [step, setStep] = useState("choice"); // "choice" | "waste-detail"
  const [wasteFraction, setWasteFraction] = useState(null);
  const [reasonCategory, setReasonCategory] = useState(null); // เลือกจากปุ่มลัด
  const [customReason, setCustomReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (queue.length === 0) return null;
  const current = queue[0];

  function goToNext() {
    setQueue((prev) => prev.slice(1));
    setStep("choice");
    setWasteFraction(null);
    setReasonCategory(null);
    setCustomReason("");
    setError(null);
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

  async function submitWasted() {
    if (!wasteFraction) return;
    setBusy(true);
    setError(null);
    try {
      let category = reasonCategory;
      let text = null;

      if (!category) {
        // ไม่ได้เลือกปุ่มลัด — ต้องพิมพ์เองแล้วค่อยเรียก AI จัดหมวด (เรียกครั้งเดียวตอน submit)
        if (!customReason.trim()) {
          setError("เลือกเหตุผล หรือพิมพ์เหตุผลก่อนนะ");
          setBusy(false);
          return;
        }
        text = customReason.trim();
        const classifyRes = await fetch("/api/classify-waste-reason", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        const classifyData = await classifyRes.json();
        category = classifyData.category || "อื่นๆ";
      }

      const res = await fetch(`/api/items/${current.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wasteFraction,
          wasteReasonCategory: category,
          wasteReasonText: text,
        }),
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
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-800 shadow-lg p-4 flex flex-col gap-4">
        <div>
          <p className="text-xs text-zinc-400">ของหมดอายุแล้ว</p>
          <p className="font-semibold text-lg text-zinc-900 dark:text-zinc-50">{current.name}</p>
        </div>

        {step === "choice" && (
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
        )}

        {step === "waste-detail" && (
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                ใช้ไปเท่าไหร่ก่อนทิ้ง
              </p>
              <div className="flex justify-between gap-2">
                {FRACTION_OPTIONS.map((opt) => (
                  <button
                    type="button"
                    key={opt.wasteFraction}
                    onClick={() => setWasteFraction(opt.wasteFraction)}
                    className="flex flex-col items-center gap-1"
                  >
                    <FractionCircle usedPercent={opt.usedPercent} active={wasteFraction === opt.wasteFraction} />
                    <span className="text-[10px] text-zinc-400 text-center leading-tight w-14">
                      {opt.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">เหตุผลที่ทิ้ง</p>
              <div className="flex gap-2 flex-wrap mb-2">
                {QUICK_REASONS.map((r) => (
                  <button
                    type="button"
                    key={r}
                    onClick={() => {
                      setReasonCategory(r);
                      setCustomReason("");
                    }}
                    className={`px-3 py-1.5 rounded-full text-sm border ${
                      reasonCategory === r
                        ? "bg-rose-500 text-white border-rose-500"
                        : "border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-300"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={customReason}
                onChange={(e) => {
                  setCustomReason(e.target.value);
                  setReasonCategory(null);
                }}
                placeholder="หรือพิมพ์เหตุผลเอง..."
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
              />
            </div>

            {error && <p className="text-sm text-rose-600">{error}</p>}

            <button
              type="button"
              onClick={submitWasted}
              disabled={busy || !wasteFraction || (!reasonCategory && !customReason.trim())}
              className="rounded-full bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white py-2.5 text-sm font-medium"
            >
              {busy ? "กำลังบันทึก..." : "ยืนยัน"}
            </button>
          </div>
        )}

        {step === "choice" && error && <p className="text-sm text-rose-600">{error}</p>}
      </div>
    </div>
  );
}
