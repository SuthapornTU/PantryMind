"use client";

// หน้ากล้องรวม 3 โหมด (สแกนตัวสินค้า / สแกนบาร์โค้ด / สแกนใบเสร็จ) สลับกันด้วยแถบปุ่มบนสุด —
// รวมมาจาก src/app/add-item/camera/page.js (ทายของ 1 ชิ้น) เดิม + src/app/add-item/receipt/page.js
// เดิม (แกะใบเสร็จหลายชิ้น) logic เรียก API ทั้งสองเส้นเหมือนเดิมทุกประการ ไม่ได้เขียนใหม่
// - "สแกนตัวสินค้า": POST /api/vision-identify → สำเร็จ redirect ไป /add-item?name=...&category=...
// - "สแกนใบเสร็จ": POST /api/receipt-scan → สำเร็จ โชว์ลิสต์รีวิวในหน้าเดียวกันเลย (ไม่ redirect)
//   ใช้ ReceiptReviewForm (component เดียวกับที่หน้า /shopping ใช้ตอน "เก็บเข้าตู้เย็น" — ดู C2 ใน
//   TASK_C_SHOPPING.md) ไม่มีจุดไหนบันทึกลง pantry_items อัตโนมัติจากผล AI ต้องผ่านการยืนยันของ user เสมอ
// - "สแกนบาร์โค้ด": ยังไม่ implement (เฟสถัดไป) ปุ่มถ่ายรูปถูก disable ไว้
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRightIcon, CameraIcon, BarcodeIcon, ReceiptIcon } from "@/components/icons";
import ReceiptReviewForm from "@/components/ReceiptReviewForm";

function toISODate(daysFromToday) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
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

  // ผลลัพธ์จาก /api/receipt-scan — null = ยังไม่ได้สแกน/อยู่ในโหมดอื่น, มีค่า = โชว์ ReceiptReviewForm แทน
  const [receiptItems, setReceiptItems] = useState(null);

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

  return (
    <div className="pb-28">
      {/* Header สไตล์หน้าย่อย: ลูกศรย้อนกลับ + ชื่อหน้า (pattern เดียวกับ add-item/page.js) */}
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
        <ReceiptReviewForm items={receiptItems} onConfirmed={() => router.push("/")} />
      )}
    </div>
  );
}
