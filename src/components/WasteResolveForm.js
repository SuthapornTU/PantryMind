"use client";

// ฟอร์ม "ปล่อยให้เสีย" — component เดียวที่ใช้ร่วมกันทั้ง ResolveExpiredPopup (หน้าแรก) และปุ่ม
// 🗑 ทิ้ง ในหน้ากลุ่ม /items/[name] (ดู B4 ใน TASK_B_UI.md — เขียนใหม่ทั้งหมด แทนของเดิมที่ถาม
// แค่ wasteFraction เดียวของทั้งแถว ไม่รองรับแถวที่ quantity > 1 ทีละชิ้น)
//
// คำถามคือ "ใช้ไปเท่าไหร่" ไม่ใช่ "เหลือเท่าไหร่" (เก็บคำเดิม) — ทิ้งไป = จำนวนคงเหลือ − ผลรวม
// สัดส่วนที่ใช้ไป ของแต่ละชิ้น ก็คือผลรวม wasteFraction ของแต่ละชิ้นนั่นเอง (waste = 1 - used ต่อชิ้น)
// ส่ง wastedUnits (ตัวเลขจำนวนชิ้น) ไป /api/items/[id]/resolve ไม่ใช่ wasteFraction แบบเดิม
import { useState } from "react";
import { WASTE_REASON_CATEGORIES } from "@/lib/shared/constants";

// ตัวเลือกสัดส่วน "ใช้ไปแล้วก่อนทิ้ง" ต่อชิ้น — 5 สถานะ (ของเดิมใน ResolveExpiredPopup มีแค่ 4 ตัวแรก
// เพราะแถวเดิมมี quantity=1 เสมอ ที่นี่เพิ่ม "ใช้หมดแล้ว ไม่เสีย" (waste=0) เพราะทีละชิ้นอาจใช้ครบได้จริง)
const PIECE_FRACTION_OPTIONS = [
  { usedPercent: 0, wasteFraction: 1, label: "ยังไม่ได้ใช้เลย" },
  { usedPercent: 0.25, wasteFraction: 0.75, label: "ใช้ไปนิดหน่อย" },
  { usedPercent: 0.5, wasteFraction: 0.5, label: "ใช้ไปครึ่งนึง" },
  { usedPercent: 0.75, wasteFraction: 0.25, label: "ใช้ไปเกือบหมด" },
  { usedPercent: 1, wasteFraction: 0, label: "ใช้หมดแล้ว ไม่เสีย" },
];

const QUICK_REASONS = WASTE_REASON_CATEGORIES.filter((c) => c !== "อื่นๆ"); // "อื่นๆ" ไม่มีปุ่มลัด — ต้องพิมพ์เอง

export function FractionCircle({ usedPercent, active }) {
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

// เส้นทีละชิ้น — โหมดย่อ (แถวจุดเล็กๆ 5 จุด) กดแล้วขยายเป็นวงกลม+คำ (ของเดิมใน ResolveExpiredPopup)
function PieceLine({ wasteFraction, onChange }) {
  const [expanded, setExpanded] = useState(false);
  const activeIndex = PIECE_FRACTION_OPTIONS.findIndex((o) => o.wasteFraction === wasteFraction);

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex items-center gap-1.5 w-full py-1"
      >
        {PIECE_FRACTION_OPTIONS.map((o, i) => (
          <span
            key={o.wasteFraction}
            className={`h-2.5 rounded-full flex-1 ${
              i === activeIndex ? "bg-rose-500" : "bg-zinc-200 dark:bg-zinc-700"
            }`}
          />
        ))}
      </button>
    );
  }

  return (
    <div className="flex justify-between gap-1.5 py-1">
      {PIECE_FRACTION_OPTIONS.map((o) => (
        <button
          type="button"
          key={o.wasteFraction}
          onClick={() => {
            onChange(o.wasteFraction);
            setExpanded(false);
          }}
          className="flex flex-col items-center gap-0.5"
        >
          <FractionCircle usedPercent={o.usedPercent} active={wasteFraction === o.wasteFraction} />
          <span className="text-[9px] text-zinc-400 text-center leading-tight w-12">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

// item: { id, name, quantity, price_per_unit, used_count, wasted_count } — แถวที่กำลังจัดการ
// onDone(updatedItem) เรียกหลังบันทึกสำเร็จ, onCancel ใช้ปิดฟอร์มเฉยๆ (ไม่บันทึกอะไร)
export default function WasteResolveForm({ item, onDone, onCancel }) {
  const quantity = Number(item.quantity);
  const oldUsedCount = Number(item.used_count || 0);
  const oldWastedCount = Number(item.wasted_count || 0);
  const initialRemaining = quantity - oldUsedCount - oldWastedCount;

  const [usedCount, setUsedCount] = useState(oldUsedCount);
  const remainingAfterCounter = Math.max(0, quantity - usedCount - oldWastedCount);
  const pieceCount = Math.round(remainingAfterCounter); // ปกติเป็นจำนวนเต็มเสมอ (ของใหม่ยังไม่เคยถูกแบ่งชิ้น)

  const [pieceFractions, setPieceFractions] = useState(() => Array(pieceCount).fill(1));
  const [showAllPieces, setShowAllPieces] = useState(false);

  const [reasonCategory, setReasonCategory] = useState(null);
  const [customReason, setCustomReason] = useState("");
  const [priceDraft, setPriceDraft] = useState("");
  const [showPriceInput, setShowPriceInput] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  function setUsedCountClamped(next) {
    const clamped = Math.max(oldUsedCount, Math.min(quantity - oldWastedCount, next));
    setUsedCount(clamped);
    const newPieceCount = Math.round(Math.max(0, quantity - clamped - oldWastedCount));
    setPieceFractions((prev) => {
      const next = Array(newPieceCount).fill(1);
      for (let i = 0; i < Math.min(prev.length, newPieceCount); i++) next[i] = prev[i];
      return next;
    });
  }

  function setPieceFraction(index, fraction) {
    setPieceFractions((prev) => prev.map((v, i) => (i === index ? fraction : v)));
  }

  const wastedUnitsNow = pieceFractions.reduce((sum, f) => sum + f, 0);
  const hasPrice = item.price_per_unit != null;
  const effectivePrice = hasPrice ? Number(item.price_per_unit) : Number(priceDraft) || null;
  const bahtAmount = effectivePrice != null ? wastedUnitsNow * effectivePrice : null;

  const VISIBLE_PIECE_LIMIT = 3;
  const visiblePieces = showAllPieces ? pieceFractions : pieceFractions.slice(0, VISIBLE_PIECE_LIMIT);
  const hiddenCount = pieceFractions.length - visiblePieces.length;

  async function handleSubmit() {
    setError(null);
    if (!reasonCategory && !customReason.trim()) {
      setError("เลือกเหตุผล หรือพิมพ์เหตุผลก่อนนะ");
      return;
    }
    setBusy(true);
    try {
      let category = reasonCategory;
      let text = null;
      if (!category) {
        text = customReason.trim();
        const classifyRes = await fetch("/api/classify-waste-reason", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        const classifyData = await classifyRes.json();
        category = classifyData.category || "อื่นๆ";
      }

      const res = await fetch(`/api/items/${item.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usedCount,
          wastedUnits: wastedUnitsNow,
          wasteReasonCategory: category,
          wasteReasonText: text,
          ...(showPriceInput && priceDraft !== "" ? { pricePerUnit: Number(priceDraft) } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      onDone(data.item);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs text-zinc-400">ของหมดอายุแล้ว</p>
        <p className="font-semibold text-lg text-zinc-900 dark:text-zinc-50">
          {item.name} · เหลือ {initialRemaining} ชิ้น
        </p>
      </div>

      {/* ตัวนับ "กินหมดไปแล้วกี่ชิ้น" — ซ่อนถ้า quantity = 1 (ไม่มีอะไรให้แยกทีละชิ้น) */}
      {quantity > 1 && (
        <div>
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
            กินหมดไปแล้วกี่ชิ้น?
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setUsedCountClamped(usedCount - 1)}
              className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 hover:bg-rose-200 dark:bg-rose-950/40 dark:text-rose-300 font-medium"
            >
              −
            </button>
            <span className="w-8 text-center text-sm font-medium">{usedCount}</span>
            <button
              type="button"
              onClick={() => setUsedCountClamped(usedCount + 1)}
              className="w-8 h-8 rounded-full bg-sky-100 text-sky-600 hover:bg-sky-200 dark:bg-sky-950/40 dark:text-sky-300 font-medium"
            >
              +
            </button>
          </div>
        </div>
      )}

      {/* ทีละชิ้นที่เหลือหลังหักตัวนับ — ซ่อนทั้งหมดถ้าตัวนับกินไปครบคงเหลือทั้งหมดแล้ว (ไม่มีอะไรให้ตอบ) */}
      {pieceCount > 0 && (
        <div>
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            อีก {pieceCount} ชิ้น — ใช้ไปเท่าไหร่?
          </p>
          <div className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-700">
            {visiblePieces.map((fraction, i) => (
              <PieceLine key={i} wasteFraction={fraction} onChange={(f) => setPieceFraction(i, f)} />
            ))}
          </div>
          {!showAllPieces && hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setShowAllPieces(true)}
              className="text-xs text-zinc-400 hover:underline mt-1"
            >
              อีก {hiddenCount} ที่ยังไม่ได้แกะ ▾
            </button>
          )}
        </div>
      )}

      {/* สรุปยอด — ห้ามโชว์ 0 บาทถ้าไม่มีราคาจริง (ทำให้สถิติดูต่ำกว่าจริง) ให้โชว์แค่จำนวนชิ้นแทน */}
      <div className="rounded-xl bg-rose-50 dark:bg-rose-950/30 px-3 py-2.5 text-sm text-rose-700 dark:text-rose-300">
        {bahtAmount != null ? (
          <p>
            ทิ้งไป {wastedUnitsNow.toFixed(2)} ชิ้น = {bahtAmount.toFixed(0)} บาท
          </p>
        ) : (
          <>
            <p>ทิ้งไป {wastedUnitsNow.toFixed(2)} ชิ้น</p>
            {!showPriceInput ? (
              <button
                type="button"
                onClick={() => setShowPriceInput(true)}
                className="text-xs underline mt-1"
              >
                + ใส่ราคาเพื่อดูเป็นเงิน
              </button>
            ) : (
              <input
                type="number"
                min="0"
                step="0.01"
                autoFocus
                value={priceDraft}
                onChange={(e) => setPriceDraft(e.target.value)}
                placeholder="ราคา/หน่วย (บาท)"
                className="w-full mt-1 rounded-lg border border-rose-200 dark:border-rose-800 bg-white dark:bg-zinc-800 px-2.5 py-1.5 text-sm text-zinc-900 dark:text-zinc-50"
              />
            )}
          </>
        )}
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

      <div className="flex gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 rounded-full border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-300 disabled:opacity-50 py-2.5 text-sm font-medium"
          >
            ยกเลิก
          </button>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={busy || (!reasonCategory && !customReason.trim())}
          className="flex-1 rounded-full bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white py-2.5 text-sm font-medium"
        >
          {busy ? "กำลังบันทึก..." : "ยืนยัน"}
        </button>
      </div>
    </div>
  );
}
