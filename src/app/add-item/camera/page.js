"use client";

// หน้ากล้องรวม 3 โหมด (สแกนตัวสินค้า / สแกนบาร์โค้ด / สแกนใบเสร็จ) สลับกันด้วยแถบปุ่มบนสุด —
// รวมมาจาก src/app/add-item/camera/page.js (ทายของ 1 ชิ้น) เดิม + src/app/add-item/receipt/page.js
// เดิม (แกะใบเสร็จหลายชิ้น) logic เรียก API ทั้งสองเส้นเหมือนเดิมทุกประการ ไม่ได้เขียนใหม่
// - "สแกนตัวสินค้า": POST /api/vision-identify → สำเร็จ redirect ไป /add-item?name=...&category=...
// - "สแกนใบเสร็จ": POST /api/receipt-scan → สำเร็จ โชว์ลิสต์รีวิวในหน้าเดียวกันเลย (ไม่ redirect)
//   ใช้ ReceiptReviewForm (component เดียวกับที่หน้า /shopping ใช้ตอน "เก็บเข้าตู้เย็น" — ดู C2 ใน
//   TASK_C_SHOPPING.md) ไม่มีจุดไหนบันทึกลง pantry_items อัตโนมัติจากผล AI ต้องผ่านการยืนยันของ user เสมอ
// - "สแกนบาร์โค้ด": ลองเปิดกล้องแบบ live stream ก่อนเสมอ (ดีสุด ไม่ต้องกดอะไรเพิ่ม) ใช้ @zxing/browser
//   ถอดรหัสบาร์โค้ดจากเฟรมวิดีโอฝั่ง client ล้วนๆ (ไม่ส่งรูปไปเซิร์ฟเวอร์เลย) — แต่เครื่องที่ไม่มีกล้อง
//   หรือเป็นคอมที่ user ไม่อยากอนุญาตกล้อง (เปิดกล้องไม่สำเร็จ/ถูกปฏิเสธ) จะมีปุ่ม "เลือกรูปจากไฟล์"
//   โผล่มาเป็น fallback เสมอ (เหมือน 2 โหมดบนที่ใช้ input type=file capture="environment" — มือถือกด
//   แล้วเปิดกล้องได้ทันที ส่วนคอมกดแล้วเลือกไฟล์รูปได้เลย) เลือกไฟล์แล้วถอดรหัสด้วย decodeFromImageUrl
//   (ยัง client-side อยู่ ไม่ส่งรูปไปเซิร์ฟเวอร์เหมือนกัน) — ถอดเลขได้ครั้งใด (จากกล้องหรือจากไฟล์ก็ตาม)
//   เรียก GET /api/barcode-lookup?code=... ทันทีเพื่อแปลงเลข → ชื่อ+หมวดหมู่ → สำเร็จ redirect ไป
//   /add-item เหมือน "สแกนตัวสินค้า" ทุกประการ (prefill เท่านั้น user ยืนยัน/แก้เองเสมอ)
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRightIcon, CameraIcon, BarcodeIcon, ReceiptIcon, ImageIcon } from "@/components/icons";
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
  barcode: "เล็งกล้องไปที่บาร์โค้ดสินค้าให้อยู่ในกรอบ ระบบจะสแกนให้อัตโนมัติ",
  receipt: "ถ่ายรูปใบเสร็จให้เห็นรายการสินค้าชัดทั้งใบ",
};

export default function AddItemCameraPage() {
  const router = useRouter();
  const fileInputRef = useRef(null);
  const barcodeFileInputRef = useRef(null);

  const [mode, setMode] = useState("item");
  const [previewUrl, setPreviewUrl] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // ผลลัพธ์จาก /api/receipt-scan — null = ยังไม่ได้สแกน/อยู่ในโหมดอื่น, มีค่า = โชว์ ReceiptReviewForm แทน
  const [receiptItems, setReceiptItems] = useState(null);

  // --- โหมดสแกนบาร์โค้ด: live video + zxing (มีปุ่มเลือกไฟล์เป็น fallback เสมอ) ---
  const videoRef = useRef(null);
  const barcodeReaderRef = useRef(null);
  const barcodeHandledRef = useRef(false); // กันเรียก lookup ซ้ำหลายครั้งจากเฟรมถัดๆ ไปก่อน redirect จะเสร็จ
  const [cameraError, setCameraError] = useState(null); // มีค่า = เปิดกล้อง live ไม่ได้ (ไม่มีกล้อง/ถูกปฏิเสธ) → โชว์ปุ่มเลือกไฟล์แทนอัตโนมัติ
  const [cameraReady, setCameraReady] = useState(false); // true = กล้อง live เปิดสำเร็จแล้ว (โชว์ video); false = กำลังลองเปิดอยู่ หรือเปิดไม่ได้

  function handleModeChange(next) {
    setMode(next);
    setPreviewUrl(null);
    setError(null);
    setCameraError(null);
    setCameraReady(false);
    setBusy(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (barcodeFileInputRef.current) barcodeFileInputRef.current.value = "";
  }

  // เปิด/ปิดกล้อง live เฉพาะตอนอยู่โหมด barcode และยังไม่มีผลลัพธ์ใบเสร็จค้างอยู่ — ปิดกล้องเสมอตอน
  // ออกจาก mode นี้หรือ unmount หน้า (คืนสิทธิ์กล้องกลับ ไม่ปล่อยให้แอบเปิดค้าง) — เครื่องไหนไม่มีกล้อง
  // (เช่นคอมบางเครื่อง) หรือ user กดปฏิเสธสิทธิ์กล้อง จะ catch แล้วโชว์ปุ่ม "เลือกรูปจากไฟล์" แทนทันที
  // ไม่ใช่ error ที่ต้อง block การใช้งาน
  useEffect(() => {
    if (mode !== "barcode" || receiptItems !== null) return;

    let cancelled = false;
    barcodeHandledRef.current = false;
    setCameraError(null);
    setCameraReady(false);

    async function startScanning() {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const { DecodeHintType, BarcodeFormat } = await import("@zxing/library");
        // จำกัดให้อ่านเฉพาะฟอร์แมตบาร์โค้ดสินค้า (EAN/UPC/CODE_128) แทนที่จะให้ลองทุกฟอร์แมตรวม
        // QR/DataMatrix/ฯลฯ ทุกเฟรม — ลดความสับสนของ decoder ทำให้อ่านบาร์โค้ดสินค้าจริงแม่นขึ้นมาก
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_128,
        ]);
        const reader = new BrowserMultiFormatReader(hints);
        barcodeReaderRef.current = reader;

        await reader.decodeFromVideoDevice(undefined, videoRef.current, (result, err) => {
          if (cancelled || barcodeHandledRef.current) return;
          if (!cameraReady) setCameraReady(true);
          if (result) {
            barcodeHandledRef.current = true;
            handleBarcodeDetected(result.getText());
          }
          // err ที่ไม่ใช่ NotFoundException คือ "ยังไม่เจอในเฟรมนี้" ปกติมาก ไม่ต้องโชว์ error ทุกเฟรม
        });
      } catch (err) {
        // เปิดกล้องไม่ได้ — พบบ่อยบนคอมที่ไม่มีกล้อง/ไม่อนุญาตสิทธิ์ ไม่ใช่ error รุนแรง แค่สลับไปให้
        // เลือกไฟล์แทน (ปุ่มด้านล่างโชว์เองเมื่อ cameraError ไม่ใช่ null และ cameraReady เป็น false)
        if (!cancelled) {
          console.error("[camera/barcode] เปิดกล้อง live ไม่สำเร็จ ใช้การเลือกไฟล์แทน:", err);
          setCameraError("เปิดกล้องแบบสดไม่ได้ (อาจไม่มีกล้อง หรือยังไม่ได้อนุญาต) — เลือกรูปจากไฟล์แทนได้เลย");
        }
      }
    }

    startScanning();

    return () => {
      cancelled = true;
      barcodeReaderRef.current?.reset?.();
      barcodeReaderRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, receiptItems]);

  async function handleBarcodeDetected(code) {
    barcodeReaderRef.current?.reset?.();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/barcode-lookup?code=${encodeURIComponent(code)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ไม่พบสินค้านี้ ลองพิมพ์ชื่อเองก่อนนะ");

      const params = new URLSearchParams({ name: data.name });
      if (data.category) params.set("category", data.category);
      router.push(`/add-item?${params.toString()}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
      barcodeHandledRef.current = false; // ให้ลองสแกนใหม่ได้ถ้าไม่เจอ/พลาด
    }
  }

  // fallback ของโหมด barcode: เลือกรูปนิ่งจากไฟล์ (กล้องมือถือ หรือไฟล์ในคอม) แล้วถอดรหัสด้วย zxing
  // จากรูปนิ่งแทนวิดีโอสด — ยัง client-side ทั้งหมด ไม่ส่งรูปขึ้นเซิร์ฟเวอร์เหมือนโหมด live
  async function handleBarcodeFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setBusy(true);
    const objectUrl = URL.createObjectURL(file);
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const { DecodeHintType, BarcodeFormat } = await import("@zxing/library");
      // เหมือน live scan ด้านบน (จำกัดฟอร์แมตให้ตรงบาร์โค้ดสินค้า) แต่เพิ่ม TRY_HARDER ด้วย เพราะ
      // โหมดนี้มีรูปนิ่งแค่ 1 รูป ไม่มีเฟรมถัดๆ ไปให้ลองใหม่เหมือนกล้องสด ต้องพยายามให้เต็มที่ในช็อตเดียว
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128,
      ]);
      hints.set(DecodeHintType.TRY_HARDER, true);
      const reader = new BrowserMultiFormatReader(hints);
      const result = await reader.decodeFromImageUrl(objectUrl);
      await handleBarcodeDetected(result.getText());
    } catch (err) {
      console.error("[camera/barcode] ถอดรหัสจากไฟล์ไม่สำเร็จ:", err);
      setError("อ่านบาร์โค้ดจากรูปนี้ไม่ออก ลองถ่าย/เลือกรูปที่บาร์โค้ดชัดกว่านี้ หรือพิมพ์ชื่อเอง");
      setBusy(false);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
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

  const showBarcodeFileFallback = mode === "barcode" && (cameraError || !cameraReady);

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
            {mode === "barcode" ? (
              <>
                {/* eslint-disable-next-line jsx-a11y/media-has-caption -- live camera preview ไม่ใช่วิดีโอที่มีเสียง/บทพูด ไม่ต้องมี caption */}
                <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted playsInline />
                {cameraReady && !cameraError && (
                  <>
                    <span className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-white/70 rounded-tl-lg" />
                    <span className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-white/70 rounded-tr-lg" />
                    <span className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-white/70 rounded-bl-lg" />
                    <span className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-white/70 rounded-br-lg" />
                    <span className="absolute left-4 right-4 top-1/2 -translate-y-1/2 h-0.5 bg-rose-500/80" />
                  </>
                )}
                {busy && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <p className="text-white text-sm">กำลังค้นหาสินค้า...</p>
                  </div>
                )}
                {showBarcodeFileFallback && !busy && (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3 px-6 text-center">
                    {cameraError ? (
                      <p className="text-white text-sm">{cameraError}</p>
                    ) : (
                      <p className="text-white/70 text-sm">กำลังเปิดกล้อง...</p>
                    )}
                    <button
                      type="button"
                      onClick={() => barcodeFileInputRef.current?.click()}
                      className="flex items-center gap-2 rounded-full bg-white text-zinc-900 px-5 py-2.5 text-sm font-medium"
                    >
                      <ImageIcon className="w-4 h-4" />
                      เลือกรูปบาร์โค้ดจากไฟล์
                    </button>
                  </div>
                )}
              </>
            ) : previewUrl ? (
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
                  onClick={() => fileInputRef.current?.click()}
                  className="w-16 h-16 rounded-full bg-white"
                />
              </>
            )}
          </div>

          {mode !== "barcode" && (
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />
          )}

          {mode === "barcode" && (
            <>
              <input
                ref={barcodeFileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleBarcodeFileChange}
                className="hidden"
              />
              {/* ปุ่มเลือกไฟล์โชว์ตลอด (ไม่ใช่แค่ตอนกล้อง live พัง) เผื่อ user อยากเลือกรูปเองแทนกล้องสด
                  เช่น มีรูปบาร์โค้ดถ่ายไว้ก่อนแล้ว — ซ้อนกับปุ่มใน overlay ด้านบนตอนกล้องเปิดไม่ได้ */}
              {cameraReady && !cameraError && (
                <button
                  type="button"
                  onClick={() => barcodeFileInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 py-2.5 text-sm font-medium"
                >
                  <ImageIcon className="w-4 h-4" />
                  หรือเลือกรูปบาร์โค้ดจากไฟล์แทน
                </button>
              )}
            </>
          )}

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
