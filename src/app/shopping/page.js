"use client";

// หน้า "ช้อปปิ้ง" (shopping list) — ค้นหา+เพิ่มของที่ต้องซื้อ, โชว์ badge ถ้ามีของนี้ในตู้อยู่แล้ว
// (already_have มาจาก /api/shopping-list ที่เช็คกับ pantry_items ให้แล้ว เป็น SQL ล้วนๆ ไม่มี AI)
// ดีไซน์อ้างอิง Figma node "Shopping list" (17:3122) — วงกลมซ้ายของแต่ละแถวคือปุ่ม "ซื้อแล้ว" เดิม
// (กดแล้วรายการหายไปจากลิสต์ เหมือน checkbox ติ๊กถูก) ส่วนปุ่มลบยังคงไว้เป็นไอคอน "×" เล็กๆ ด้านขวา
// หมายเหตุ: ดีไซน์ต้นฉบับมีปุ่ม "ยืนยัน" ลอยด้านล่าง แต่ต้องมี batch-confirm flow ที่แอปนี้ยังไม่มี
// เลยไม่ได้ใส่มาด้วย — ของเดิมเพิ่มลงลิสต์ทันทีที่เลือกอยู่แล้ว
// banner เตือน "มักถูกทิ้งบ่อย" ต่อรายการ ใส่แล้ว — มาจาก item.nudge ที่ /api/shopping-list คำนวณให้
// (checkNudge ใน src/lib/server/nudge.js, rule-based จาก item_events ทั้งหมด ไม่มี AI)
//
// แก้ 2 บั๊กตาม TASK_C_SHOPPING.md:
// ① ติ๊กว่าซื้อแล้วเดิมทำ setItems filter ทิ้งเหมือนกดลบ ทั้งที่ status='checked' เก็บไว้ใน DB อยู่แล้ว
//   — ตอนนี้แยกเป็น 2 ส่วน (ยังไม่ซื้อ/ซื้อแล้ว) ในหน้าเดียว ติ๊กซ้ำกลับเป็น pending ได้ (C1)
// ② ซื้อของเสร็จแล้วเป็นทางตัน ต้องพิมพ์ชื่อเดิมซ้ำในหน้าเพิ่มของ — ตอนนี้มีปุ่ม "เก็บเข้าตู้เย็น" ที่พา
//   ไปหน้ารีวิวเดียวกับตอนสแกนใบเสร็จ (ReceiptReviewForm) โดยเดาหมวดหมู่/วันหมดอายุด้วย
//   resolveExpiryUI ตัวเดียวกันให้ก่อนแล้ว ราคาต้องกรอกเอง (C2/C3)
// บังคับ dynamic rendering (ดู TASK_E_AUTH.md E3) — หน้าอ่านข้อมูล user คนเดียว ห้าม static cache
export const dynamic = "force-dynamic";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FridgeIcon, ChefHatIcon, PlusIcon, ChevronRightIcon, CameraIcon } from "@/components/icons";
import ReceiptReviewForm from "@/components/ReceiptReviewForm";

function toISODate(daysFromToday) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
}

export default function ShoppingPage() {
  const [items, setItems] = useState(null); // null = กำลังโหลด
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const debounceRef = useRef(null);

  // เข้าโหมดรีวิวก่อนเก็บของที่ซื้อแล้วเข้าตู้เย็น (C2) — null = ยังไม่ได้กด "เก็บเข้าตู้เย็น"
  const [reviewItems, setReviewItems] = useState(null);
  const [preparingReview, setPreparingReview] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/shopping-list");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "โหลดรายการไม่สำเร็จ");
      setItems(data.items);
      setError(null);
    } catch (err) {
      setError(err.message);
      setItems([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // ค้นหา autocomplete ตอนพิมพ์ (debounce 300ms) — pattern เดียวกับ add-item/page.js
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/shopping-list/search?q=${encodeURIComponent(query.trim())}`);
        const data = await res.json();
        setSuggestions(data.items || []);
      } catch {
        setSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  async function addToList(name) {
    if (!name?.trim()) return;
    setQuery("");
    setSuggestions([]);
    try {
      const res = await fetch("/api/shopping-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemName: name.trim(), quantity: 1 }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "เพิ่มไม่สำเร็จ");
      await load();
    } catch (err) {
      alert(err.message);
    }
  }

  // สลับ pending <-> checked ไปกลับได้ (C1) — ไม่ใช่ mark แล้วหายจากจอแบบเดิมอีกต่อไป
  async function toggleStatus(id) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/shopping-list/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle_status" }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      await load();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id) {
    if (!confirm("ลบรายการนี้ทิ้งเลยไหม?")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/shopping-list/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      alert(err.message);
    } finally {
      setBusyId(null);
    }
  }

  const pendingItems = items?.filter((i) => i.status === "pending") || [];
  const checkedItems = items?.filter((i) => i.status === "checked") || [];

  // เตรียมข้อมูลตั้งต้นให้ ReceiptReviewForm จากของที่ซื้อแล้ว — หมวดหมู่/วันหมดอายุต้องเดาด้วย
  // resolveExpiryUI ตัวเดียวกับที่ /api/receipt-scan ใช้ (เรียกผ่าน /api/expiry-estimate ตัวเดียวกับ
  // ที่ add-item/page.js และ ReceiptReviewForm เองก็เรียกตอนสลับที่เก็บ) ไม่ปล่อยว่างให้กรอกเองทุกช่อง
  // — ราคาไม่มีข้อมูลจากไหนเลยต้องปล่อยว่างให้ user กรอกเอง (ดู C2 ตาราง)
  async function handleStoreToFridge() {
    if (checkedItems.length === 0) return;
    setPreparingReview(true);
    try {
      const prefilled = await Promise.all(
        checkedItems.map(async (item) => {
          const res = await fetch(
            `/api/expiry-estimate?name=${encodeURIComponent(item.item_name)}&storageLocation=fridge`
          );
          const meta = await res.json();
          return {
            id: item.id,
            sourceShoppingId: item.id,
            included: true,
            name: item.item_name,
            category: meta.category || "อื่นๆ",
            quantity: item.quantity || 1,
            lineTotalPrice: "",
            storageLocation: "fridge",
            expiryMode: meta.mode,
            expiryDate: meta.mode === "auto-fill" ? toISODate(meta.defaultDays) : "",
            selectedDays: meta.mode === "auto-fill" ? meta.defaultDays : null,
            writeBackToReference: Boolean(meta.writeBackToReference),
          };
        })
      );
      setReviewItems(prefilled);
    } catch {
      alert("เตรียมรายการไม่สำเร็จ ลองใหม่อีกทีนะ");
    } finally {
      setPreparingReview(false);
    }
  }

  // C3: ลบเฉพาะอันที่ "ติ๊กรวมและบันทึกสำเร็จจริง" ออกจาก shopping_list — อันที่ผู้ใช้ติ๊กออกในหน้ารีวิว
  // ไม่ติดมาด้วย (ไม่อยู่ใน savedSourceShoppingIds) เลยยังอยู่ใน shopping_list ตามเดิม
  async function handleReviewConfirmed(savedSourceShoppingIds) {
    await Promise.all(
      savedSourceShoppingIds.map((id) => fetch(`/api/shopping-list/${id}`, { method: "DELETE" }))
    );
    setReviewItems(null);
    await load();
  }

  if (reviewItems) {
    return (
      <div className="pb-28">
        <div className="flex items-center gap-2 px-4 pt-4 pb-3">
          <button
            type="button"
            aria-label="กลับ"
            onClick={() => setReviewItems(null)}
            className="w-8 h-8 rounded-full flex items-center justify-center rotate-180 text-zinc-500"
          >
            <ChevronRightIcon className="w-5 h-5" />
          </button>
          <h1 className="font-semibold text-zinc-900 dark:text-zinc-50">เก็บเข้าตู้เย็น</h1>
        </div>
        <ReceiptReviewForm
          items={reviewItems}
          note="หมวดหมู่/วันหมดอายุเดาไว้ให้แล้ว แก้ไขได้ — ราคายังไม่มีข้อมูล กรอกเองก่อนยืนยันนะ"
          onConfirmed={handleReviewConfirmed}
        />
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-b from-[#e8f4cd] to-[#bade97] min-h-full pb-28">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <span className="w-9 h-9 rounded-xl bg-white/50 flex items-center justify-center shrink-0">
          <FridgeIcon className="w-5 h-5 text-[#4b3535]" />
        </span>
        <span className="font-semibold text-xl text-[#4b3535] tracking-tight">รายการที่ต้องซื้อ</span>
        <button
          type="button"
          title="เร็วๆ นี้"
          className="w-9 h-9 rounded-xl bg-white/50 flex items-center justify-center shrink-0 opacity-60 cursor-not-allowed"
        >
          <ChefHatIcon className="w-5 h-5 text-[#4b3535]" />
        </button>
      </div>

      <div className="px-4">
        {/* ช่องค้นหา + dropdown */}
        <div className="relative mb-4">
          <div className="flex items-center gap-2 rounded-full bg-[#fefeff] px-4 py-2.5 shadow-sm">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addToList(query);
              }}
              placeholder="เพิ่ม เนื้อหมู ผักกาดขาว"
              className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-zinc-400"
            />
            <button
              type="button"
              aria-label="เพิ่มลงรายการ"
              onClick={() => addToList(query)}
              className="w-7 h-7 rounded-full bg-[#bade97] text-[#4b3535] flex items-center justify-center shrink-0"
            >
              <PlusIcon className="w-4 h-4" />
            </button>
          </div>
          {suggestions.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full rounded-2xl border border-zinc-200 bg-white shadow-lg overflow-hidden">
              {suggestions.map((s) => (
                <li key={s.name}>
                  <button
                    type="button"
                    onClick={() => addToList(s.name)}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-zinc-100"
                  >
                    {s.name} <span className="text-zinc-400">· {s.category}</span>
                    {s.already_have_quantity > 0 && (
                      <span className="text-[#5c8656]"> · มีอยู่แล้วในตู้ {s.already_have_quantity} ชิ้น</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && (
          <p className="text-sm text-rose-700 mb-3">
            {error} — ถ้ายังไม่ได้ตั้งค่า Supabase ดูวิธีที่หน้าแรก
          </p>
        )}

        {items === null ? (
          <p className="text-[#4b3535]/60 text-sm">กำลังโหลด...</p>
        ) : pendingItems.length === 0 && checkedItems.length === 0 && !error ? (
          <p className="text-[#4b3535]/60 text-sm">ยังไม่มีของที่ต้องซื้อ</p>
        ) : (
          <>
            {pendingItems.length === 0 ? (
              <p className="text-[#4b3535]/60 text-sm mb-2">ซื้อครบตามลิสต์แล้ว 🎉</p>
            ) : (
              <ul className="flex flex-col gap-2.5 pb-2">
                {pendingItems.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 rounded-3xl bg-[#fefeff] shadow-sm px-3 py-3"
                  >
                    <button
                      type="button"
                      aria-label="ซื้อแล้ว"
                      title="ซื้อแล้ว"
                      onClick={() => toggleStatus(item.id)}
                      disabled={busyId === item.id}
                      className="w-8 h-8 rounded-full border-2 border-[#5c8656] shrink-0 disabled:opacity-40"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-zinc-900 truncate">{item.item_name}</p>
                      {item.already_have && (
                        <p className="text-sm text-[#5c8656]">มีอยู่แล้ว {item.already_have_quantity} ชิ้น</p>
                      )}
                      {item.nudge && <p className="text-sm text-amber-600 mt-0.5">⚠️ {item.nudge}</p>}
                    </div>
                    <button
                      type="button"
                      aria-label="ลบรายการนี้"
                      title="ลบ"
                      onClick={() => remove(item.id)}
                      disabled={busyId === item.id}
                      className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-zinc-400 hover:bg-zinc-100 hover:text-rose-500 disabled:opacity-40"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* ซื้อแล้ว — ย้ายลงมาส่วนนี้แทนหายไปเลย (C1) ซ่อนทั้งส่วนนี้และปุ่มทั้งสองถ้ายังไม่มีของซื้อแล้ว */}
            {checkedItems.length > 0 && (
              <>
                <p className="text-sm font-medium text-[#4b3535]/70 mt-3 mb-2">
                  ซื้อแล้ว {checkedItems.length} อย่าง
                </p>
                <ul className="flex flex-col gap-2.5 pb-3">
                  {checkedItems.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center gap-3 rounded-3xl bg-[#fefeff]/70 shadow-sm px-3 py-3"
                    >
                      <button
                        type="button"
                        aria-label="เอากลับไปเป็นยังไม่ซื้อ"
                        title="กดซ้ำเพื่อเอากลับไปเป็นยังไม่ซื้อ"
                        onClick={() => toggleStatus(item.id)}
                        disabled={busyId === item.id}
                        className="w-8 h-8 rounded-full bg-[#5c8656] text-white flex items-center justify-center shrink-0 disabled:opacity-40"
                      >
                        ✓
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-zinc-900/70 truncate line-through decoration-zinc-400">
                          {item.item_name}
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label="ลบรายการนี้"
                        title="ลบ"
                        onClick={() => remove(item.id)}
                        disabled={busyId === item.id}
                        className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-zinc-400 hover:bg-zinc-100 hover:text-rose-500 disabled:opacity-40"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>

                <div className="flex flex-col gap-2 pb-2">
                  <Link
                    href="/add-item/camera"
                    className="flex items-center justify-center gap-2 rounded-full bg-white/70 text-[#4b3535] py-2.5 text-sm font-medium"
                  >
                    <CameraIcon className="w-4 h-4" /> สแกนใบเสร็จ
                  </Link>
                  <button
                    type="button"
                    onClick={handleStoreToFridge}
                    disabled={preparingReview}
                    className="rounded-full bg-[#4b3535] hover:bg-[#3a2929] disabled:opacity-50 text-white py-2.5 text-sm font-medium"
                  >
                    {preparingReview
                      ? "กำลังเตรียม..."
                      : `📥 เก็บ ${checkedItems.length} อย่างนี้เข้าตู้เย็น`}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
