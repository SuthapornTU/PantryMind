"use client";

// หน้าถ่ายรูปเพิ่มของ — ถ่าย/เลือกรูป 1 ใบ → ส่งให้ Gemini ทาย "ชื่อ + หมวดหมู่" ผ่าน /api/vision-identify
// แล้วพา user ไปหน้า add-item เดิม โดย prefill ค่าที่ทายได้ไว้ล่วงหน้าเท่านั้น (query params) —
// ไม่มีจุดไหนบันทึกลง pantry_items อัตโนมัติ ผู้ใช้ต้องเห็น/แก้ไข/กดปุ่ม "บันทึก" เองในฟอร์มเสมอ
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRightIcon, CameraIcon } from "@/components/icons";

export default function AddItemCameraPage() {
  const router = useRouter();
  const fileInputRef = useRef(null);

  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setPreviewUrl(URL.createObjectURL(file));
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch("/api/vision-identify", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ทายรูปไม่สำเร็จ");

      const params = new URLSearchParams({ name: data.name, category: data.category });
      router.push(`/add-item?${params.toString()}`);
    } catch (err) {
      setError(err.message);
      setLoading(false);
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

      <div className="px-4 py-10 flex flex-col items-center gap-4 text-center">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- preview รูปจาก blob URL ในเครื่อง ไม่ใช่รูปจาก remote host
          <img
            src={previewUrl}
            alt="ตัวอย่างรูปที่ถ่าย"
            className="w-40 h-40 rounded-2xl object-cover shadow-sm"
          />
        ) : (
          <span className="w-16 h-16 rounded-full bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center">
            <CameraIcon className="w-7 h-7 text-rose-400" />
          </span>
        )}

        {loading ? (
          <p className="text-sm text-zinc-400">กำลังวิเคราะห์รูปภาพ...</p>
        ) : error ? (
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm text-rose-600">{error}</p>
            <Link
              href="/add-item"
              className="rounded-full bg-rose-500 hover:bg-rose-600 text-white px-5 py-2.5 text-sm font-medium"
            >
              พิมพ์เอง
            </Link>
          </div>
        ) : (
          <>
            <p className="text-sm text-zinc-400">ถ่ายรูปของ 1 ชิ้น ให้ AI ช่วยทายชื่อและหมวดหมู่ให้</p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-full bg-rose-500 hover:bg-rose-600 text-white px-5 py-2.5 text-sm font-medium"
            >
              ถ่ายรูป / เลือกรูป
            </button>
          </>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </div>
  );
}
