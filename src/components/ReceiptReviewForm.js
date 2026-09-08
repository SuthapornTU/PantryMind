"use client";

// หน้ารีวิว "หลายชิ้นก่อนบันทึกเข้าตู้เย็น" — เดิมอยู่ใน add-item/camera/page.js เฉพาะทาง "สแกนใบเสร็จ"
// ดึงออกมาเป็น component แยกตามที่ TASK_C_SHOPPING.md สั่ง (C2) เพื่อให้ทั้ง "สแกนใบเสร็จ" และ
// "เก็บของที่ซื้อแล้วจาก shopping list เข้าตู้เย็น" ใช้หน้ารีวิวเดียวกัน ไม่มีจุดไหน insert ลง
// pantry_items ตรงๆ เลย ต้องผ่านการติ๊ก/แก้ไข/ยืนยันของ user ในนี้เสมอ
//
// item ที่รับเข้ามาแต่ละอันมีรูปแบบ:
// { id, included, name, category, quantity, lineTotalPrice, storageLocation,
//   expiryMode, expiryDate, selectedDays, writeBackToReference, sourceShoppingId? }
// sourceShoppingId (ถ้ามี) = id ของแถวใน shopping_list ที่ item นี้มาจาก ใช้ตอนบันทึกสำเร็จแล้ว
// ให้ผู้เรียก (src/app/shopping/page.js) รู้ว่าจะลบแถวไหนออกจาก shopping_list ได้บ้าง (ดู C3)
import { useState } from "react";
import { CATEGORIES, STORAGE_LOCATIONS } from "@/lib/shared/constants";

function toISODate(daysFromToday) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
}

function daysBetweenTodayAnd(dateStr) {
  const diff = new Date(dateStr) - new Date(new Date().toISOString().slice(0, 10));
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

function isResolved(item) {
  if (!item.included) return true;
  if (item.expiryMode === "auto-fill") return true;
  if (item.selectedDays === null) return false;
  if (item.selectedDays === "custom") return Boolean(item.expiryDate);
  return true;
}

// note: ข้อความบรรทัดเล็กบนสุด ต่างกันเล็กน้อยตามที่มา (ใบเสร็จ vs รายการที่ซื้อแล้ว)
// onConfirmed(savedSourceShoppingIds): เรียกหลังบันทึกสำเร็จ พร้อม sourceShoppingId ของอันที่ "ติ๊กรวม
// และบันทึกสำเร็จจริง" เท่านั้น (อันที่ผู้ใช้ติ๊กออกไม่ติดมาด้วย ยังอยู่ใน shopping_list ตามเดิม — ดู C3)
export default function ReceiptReviewForm({ items: initialItems, note, onConfirmed }) {
  const [items, setItems] = useState(initialItems);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  function updateItem(id, patch) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  async function handleStorageChange(item, storageLocation) {
    updateItem(item.id, { storageLocation });
    try {
      const res = await fetch(
        `/api/expiry-estimate?name=${encodeURIComponent(item.name)}&storageLocation=${storageLocation}`
      );
      const meta = await res.json();
      if (meta.mode === "auto-fill") {
        updateItem(item.id, {
          expiryMode: "auto-fill",
          expiryDate: toISODate(meta.defaultDays),
          selectedDays: meta.defaultDays,
          writeBackToReference: Boolean(meta.writeBackToReference),
        });
      } else {
        updateItem(item.id, {
          expiryMode: "quick-pick",
          expiryDate: "",
          selectedDays: null,
          writeBackToReference: Boolean(meta.writeBackToReference),
        });
      }
    } catch {
      // เงียบไว้ — user ยังเลือกวันหมดอายุเองผ่าน quick-pick ได้
    }
  }

  function pickQuickDays(item, d) {
    if (d === "custom") {
      updateItem(item.id, { selectedDays: "custom", expiryDate: toISODate(7) });
    } else {
      updateItem(item.id, { selectedDays: d, expiryDate: toISODate(d) });
    }
  }

  const includedItems = items.filter((it) => it.included);
  const confirmDisabled = submitting || includedItems.length === 0 || !includedItems.every(isResolved);

  async function handleConfirmAll() {
    setSubmitError(null);
    setSubmitting(true);
    const savedSourceShoppingIds = [];
    try {
      for (const item of includedItems) {
        const days =
          item.selectedDays === "custom" || item.selectedDays === null
            ? daysBetweenTodayAnd(item.expiryDate)
            : item.selectedDays;

        const quantity = Number(item.quantity) || 1;
        // ราคารวมที่ user เห็น/แก้ไขในการ์ด → แปลงกลับเป็นราคา/หน่วยตอนบันทึกจริง (rule-based ธรรมดา)
        const pricePerUnit =
          item.lineTotalPrice === "" || item.lineTotalPrice === null
            ? null
            : Number(item.lineTotalPrice) / quantity;

        const res = await fetch("/api/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: item.name.trim(),
            category: item.category,
            storageLocation: item.storageLocation,
            quantity,
            pricePerUnit,
            expiryDate: item.expiryDate,
            days,
            writeBack: Boolean(item.writeBackToReference),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `เพิ่ม "${item.name}" ไม่สำเร็จ`);
        if (item.sourceShoppingId) savedSourceShoppingIds.push(item.sourceShoppingId);
      }
      onConfirmed(savedSourceShoppingIds);
    } catch (err) {
      // บันทึกสำเร็จไปกี่อันก็อันนั้นแล้ว (ทีละ POST ไม่ได้ครอบ transaction รวม) — แจ้ง error แล้วให้ user
      // กด "ยืนยันเพิ่มทั้งหมด" ซ้ำได้ อันที่สำเร็จไปแล้วจะซ้ำเป็นแถวใหม่ก็จริง แต่ปลอดภัยกว่าปล่อยให้ตกหล่น
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="px-4 flex flex-col gap-3">
      <p className="text-xs text-zinc-400">
        {note || "แก้ไข/เอาออกได้ก่อนยืนยัน — เอาชื่อร้าน ยอดรวม ค่าถุงออกให้แล้ว"}
      </p>

      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item.id} className="rounded-xl bg-white dark:bg-zinc-800 shadow-sm p-3 flex flex-col gap-3">
            <div className="flex items-start gap-2.5">
              <input
                type="checkbox"
                checked={item.included}
                onChange={(e) => updateItem(item.id, { included: e.target.checked })}
                className="mt-2.5 w-4 h-4 accent-rose-500 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) => updateItem(item.id, { name: e.target.value })}
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm font-medium"
                />
                {/* หมวดหมู่ — ระบบเดาให้อัตโนมัติจากการสแกน (AI/บาร์โค้ด) แต่ user เปลี่ยนเองได้เสมอ
                    เหมือน field อื่นๆ ในการ์ดนี้ (ชื่อ/ที่เก็บ/วันหมดอายุ) — ยังเป็น dropdown ธรรมดา
                    ไม่มีจุดไหนบันทึกอัตโนมัติ ต้องผ่านปุ่ม "ยืนยันเพิ่มทั้งหมด" เหมือนเดิม */}
                <select
                  value={item.category}
                  onChange={(e) => updateItem(item.id, { category: e.target.value })}
                  className="inline-block mt-1.5 w-fit text-xs font-medium rounded-full pl-2.5 pr-1.5 py-0.5 bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border-none"
                >
                  {!CATEGORIES.includes(item.category) && (
                    <option value={item.category}>{item.category}</option>
                  )}
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {item.included && (
              <>
                {/* ที่เก็บ */}
                <div className="flex gap-2">
                  {STORAGE_LOCATIONS.map((s) => (
                    <button
                      type="button"
                      key={s.value}
                      onClick={() => handleStorageChange(item, s.value)}
                      className={`px-3 py-1.5 rounded-full text-sm border ${
                        item.storageLocation === s.value
                          ? "bg-rose-500 text-white border-rose-500"
                          : "border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-700"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                {/* วันหมดอายุ */}
                {item.expiryMode === "auto-fill" ? (
                  <div className="flex flex-col gap-1">
                    <input
                      type="date"
                      value={item.expiryDate}
                      onChange={(e) => updateItem(item.id, { expiryDate: e.target.value })}
                      className="w-full rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 font-medium px-3 py-2 text-sm"
                    />
                    <p className="text-xs text-zinc-400">ระบบเดาให้จากฐานข้อมูล แก้ไขได้เลย</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2 flex-wrap">
                      {[3, 7, 15, "custom"].map((d) => (
                        <button
                          type="button"
                          key={d}
                          onClick={() => pickQuickDays(item, d)}
                          className={`px-3 py-1.5 rounded-full text-sm border ${
                            item.selectedDays === d
                              ? "bg-rose-500 text-white border-rose-500"
                              : "border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-300"
                          }`}
                        >
                          {d === "custom" ? "กำหนดเอง" : `${d} วัน`}
                        </button>
                      ))}
                    </div>
                    {item.selectedDays === "custom" && (
                      <input
                        type="date"
                        value={item.expiryDate}
                        onChange={(e) => updateItem(item.id, { expiryDate: e.target.value })}
                        className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
                      />
                    )}
                    {item.selectedDays === null && (
                      <p className="text-xs text-amber-600">ยังไม่รู้จักของนี้ — เลือกวันหมดอายุก่อนนะ</p>
                    )}
                  </div>
                )}

                {/* จำนวน + ราคารวม */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">จำนวน</label>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateItem(item.id, { quantity: e.target.value })}
                      className="w-20 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1.5 text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">ราคารวม</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.lineTotalPrice}
                      onChange={(e) => updateItem(item.id, { lineTotalPrice: e.target.value })}
                      placeholder="บาท"
                      className="w-24 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1.5 text-sm"
                    />
                  </div>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>

      {submitError && <p className="text-sm text-rose-600">{submitError}</p>}

      <button
        type="button"
        onClick={handleConfirmAll}
        disabled={confirmDisabled}
        className="mt-1 mb-4 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white rounded-full py-2.5 text-sm font-medium"
      >
        {submitting ? "กำลังบันทึก..." : "ยืนยันเพิ่มทั้งหมด"}
      </button>
    </div>
  );
}
