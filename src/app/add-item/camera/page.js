"use client";

// หน้ากล้องรวม 3 โหมด (สแกนตัวสินค้า / สแกนบาร์โค้ด / สแกนใบเสร็จ) สลับกันด้วยแถบปุ่มบนสุด —
// รวมมาจาก src/app/add-item/camera/page.js (ทายของ 1 ชิ้น) เดิม + src/app/add-item/receipt/page.js
// เดิม (แกะใบเสร็จหลายชิ้น) logic เรียก API ทั้งสองเส้นเหมือนเดิมทุกประการ ไม่ได้เขียนใหม่
// - "สแกนตัวสินค้า": POST /api/vision-identify → สำเร็จ redirect ไป /add-item?name=...&category=...
// - "สแกนใบเสร็จ": POST /api/receipt-scan → สำเร็จ โชว์ลิสต์รีวิวในหน้าเดียวกันเลย (ไม่ redirect)
//   ยืนยันแล้วค่อยวนลูป POST /api/items ทีละชิ้น (เหมือนฟอร์ม add-item ปกติ) — ไม่มีจุดไหนบันทึก
//   ลง pantry_items อัตโนมัติจากผล AI ทั้งคู่ ต้องผ่านการยืนยันของ user เสมอ
// - "สแกนบาร์โค้ด": ยังไม่ implement (เฟสถัดไป) ปุ่มถ่ายรูปถูก disable ไว้
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { STORAGE_LOCATIONS } from "@/lib/constants";
import { ChevronRightIcon, CameraIcon, BarcodeIcon, ReceiptIcon } from "@/components/icons";

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

const MODES = [
  { value: "item", label: "สแกนตัวสินค้า", Icon: CameraIcon },
  { value: "barcode", label: "สแกนบาร์โค้ด", Icon: BarcodeIcon },
  { value: "receipt", label: "สแกนใบเสร็จ", Icon: ReceiptIcon },
];

const HINTS = {
  item: "ถ่ายรูปของสด 1 ชิ้นให้อยู่ในกรอบ ชัดเจน แสงพอ",
  barcode: "ฟีเจอร์นี้กำลังพัฒนา เร็วๆ นี้นะ",
  receipt: "ถ่ายรูปใบเสร็จให้เห็นรายการสินค้าชัดทั้งใบ",
};

export default function AddItemCameraPage() {
  const router = useRouter();
  const fileInputRef = useRef(null);

  const [mode, setMode] = useState("item");
  const [previewUrl, setPreviewUrl] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // ผลลัพธ์จาก /api/receipt-scan — null = ยังไม่ได้สแกน/อยู่ในโหมดอื่น, มีค่า = โชว์หน้ารีวิวแทน
  const [receiptItems, setReceiptItems] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  function handleModeChange(next) {
    setMode(next);
    setPreviewUrl(null);
    setError(null);
    setBusy(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file || mode === "barcode") return;

    setError(null);
    setPreviewUrl(URL.createObjectURL(file));
    setBusy(true);

    try {
      const formData = new FormData();
      formData.append("image", file);

      if (mode === "item") {
        const res = await fetch("/api/vision-identify", { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "ทายรูปไม่สำเร็จ");

        const params = new URLSearchParams({ name: data.name, category: data.category });
        router.push(`/add-item?${params.toString()}`);
        return;
      }

      // mode === "receipt"
      const res = await fetch("/api/receipt-scan", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "อ่านใบเสร็จไม่สำเร็จ");

      setReceiptItems(
        data.items.map((it, idx) => ({
          id: idx,
          included: true,
          name: it.name,
          category: it.category,
          quantity: it.quantity,
          // โชว์เป็น "ราคารวม" ให้ user เห็น (ตรงกับตัวเลขบนใบเสร็จจริง ตรวจสอบง่ายกว่า) แม้ backend
          // จะคำนวณเป็น pricePerUnit ไว้แล้วก็ตาม — แปลงกลับเป็นราคารวมด้วย pricePerUnit × quantity
          lineTotalPrice:
            it.pricePerUnit != null ? Math.round(it.pricePerUnit * it.quantity * 100) / 100 : "",
          storageLocation: it.defaultStorage,
          expiryMode: it.expiryMode,
          expiryDate: it.expiryMode === "auto-fill" ? toISODate(it.defaultDays) : "",
          selectedDays: it.expiryMode === "auto-fill" ? it.defaultDays : null,
          writeBackToReference: it.writeBackToReference,
        }))
      );
      setBusy(false);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  function updateReceiptItem(id, patch) {
    setReceiptItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  async function handleStorageChange(item, storageLocation) {
    updateReceiptItem(item.id, { storageLocation });
    try {
      const res = await fetch(
        `/api/expiry-estimate?name=${encodeURIComponent(item.name)}&storageLocation=${storageLocation}`
      );
      const meta = await res.json();
      if (meta.mode === "auto-fill") {
        updateReceiptItem(item.id, {
          expiryMode: "auto-fill",
          expiryDate: toISODate(meta.defaultDays),
          selectedDays: meta.defaultDays,
          writeBackToReference: Boolean(meta.writeBackToReference),
        });
      } else {
        updateReceiptItem(item.id, {
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
      updateReceiptItem(item.id, { selectedDays: "custom", expiryDate: toISODate(7) });
    } else {
      updateReceiptItem(item.id, { selectedDays: d, expiryDate: toISODate(d) });
    }
  }

  const includedItems = receiptItems?.filter((it) => it.included) || [];
  const confirmDisabled =
    submitting || includedItems.length === 0 || !includedItems.every(isResolved);

  async function handleConfirmAll() {
    setSubmitError(null);
    setSubmitting(true);
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
      }
      router.push("/");
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      {/* Header สไตล์หน้าย่อย: ลูกศรย้อนกลับ + ชื่อหน้า */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <Link
          href="/"
          aria-label="กลับ"
          className="w-8 h-8 rounded-full flex items-center justify-center rotate-180 text-zinc-500"
        >
          <ChevronRightIcon className="w-5 h-5" />
        </Link>
        <h1 className="font-semibold text-zinc-900 dark:text-zinc-50">ถ่ายรูปเพิ่มของ</h1>
      </div>

      {receiptItems === null ? (
        <div className="px-4 flex flex-col gap-4">
          {/* แถบสลับโหมด */}
          <div className="grid grid-cols-3 gap-2">
            {MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => handleModeChange(m.value)}
                className={`flex flex-col items-center gap-1 rounded-xl py-2.5 text-xs font-medium ${
                  mode === m.value ? "bg-rose-500 text-white" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                }`}
              >
                <m.Icon className="w-5 h-5" />
                {m.label}
              </button>
            ))}
          </div>

          {/* พื้นที่กล้อง/preview */}
          <div className="relative w-full aspect-square rounded-2xl bg-zinc-900 overflow-hidden flex items-center justify-center">
            {previewUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- preview รูปจาก blob URL ในเครื่อง ไม่ใช่รูปจาก remote host */}
                <img
                  src={previewUrl}
                  alt="ตัวอย่างรูปที่เลือก"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                {busy && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <p className="text-white text-sm">กำลังวิเคราะห์...</p>
                  </div>
                )}
              </>
            ) : (
              <>
                <span className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-white/70 rounded-tl-lg" />
                <span className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-white/70 rounded-tr-lg" />
                <span className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-white/70 rounded-bl-lg" />
                <span className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-white/70 rounded-br-lg" />

                <button
                  type="button"
                  aria-label="ถ่ายรูป"
                  disabled={mode === "barcode"}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-16 h-16 rounded-full bg-white disabled:opacity-30 disabled:cursor-not-allowed"
                />
              </>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* แถบคำแนะนำ */}
          <div className="bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 rounded-xl p-3 text-sm text-center">
            {HINTS[mode]}
          </div>

          {error && (
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm text-rose-600 text-center">{error}</p>
              <Link
                href="/add-item"
                className="rounded-full bg-rose-500 hover:bg-rose-600 text-white px-5 py-2.5 text-sm font-medium"
              >
                พิมพ์เอง
              </Link>
            </div>
          )}
        </div>
      ) : (
        // รีวิวรายการที่แกะได้จากใบเสร็จ
        <div className="px-4 flex flex-col gap-3">
          <p className="text-xs text-zinc-400">แก้ไข/เอาออกได้ก่อนยืนยัน — เอาชื่อร้าน ยอดรวม ค่าถุงออกให้แล้ว</p>

          <ul className="flex flex-col gap-3">
            {receiptItems.map((item) => (
              <li
                key={item.id}
                className="rounded-xl bg-white dark:bg-zinc-800 shadow-sm p-3 flex flex-col gap-3"
              >
                <div className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={item.included}
                    onChange={(e) => updateReceiptItem(item.id, { included: e.target.checked })}
                    className="mt-2.5 w-4 h-4 accent-rose-500 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => updateReceiptItem(item.id, { name: e.target.value })}
                      className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm font-medium"
                    />
                    <span className="inline-block mt-1.5 text-xs font-medium rounded-full px-2 py-0.5 bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                      {item.category}
                    </span>
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
                          onChange={(e) => updateReceiptItem(item.id, { expiryDate: e.target.value })}
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
                            onChange={(e) => updateReceiptItem(item.id, { expiryDate: e.target.value })}
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
                          onChange={(e) => updateReceiptItem(item.id, { quantity: e.target.value })}
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
                          onChange={(e) => updateReceiptItem(item.id, { lineTotalPrice: e.target.value })}
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
      )}
    </div>
  );
}
