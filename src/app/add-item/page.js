"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CATEGORIES, STORAGE_LOCATIONS } from "@/lib/constants";
import { ChevronRightIcon } from "@/components/icons";

function toISODate(daysFromToday) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
}

function daysBetweenTodayAnd(dateStr) {
  const diff = new Date(dateStr) - new Date(new Date().toISOString().slice(0, 10));
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

// useSearchParams ต้องอยู่ใน component ที่ห่อด้วย Suspense (ข้อกำหนดของ Next.js App Router)
// แยก AddItemForm ออกมาเฉพาะ — ค่าจาก query (name/category) แค่เป็น "ค่าตั้งต้น" ของฟอร์มเดิม
// มาจากผลทาย AI ที่หน้า /add-item/camera ส่งต่อมา (ดู src/app/api/vision-identify/route.js) —
// user ยังแก้ไข/ต้องกดปุ่ม "บันทึก" เองเหมือนเดิมทุกประการ ไม่มีอะไรถูกบันทึกอัตโนมัติ
function AddItemForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialName = searchParams.get("name") || "";
  const paramCategory = searchParams.get("category");
  const initialCategory = CATEGORIES.includes(paramCategory) ? paramCategory : CATEGORIES[0];

  const [name, setName] = useState(initialName);
  const [suggestions, setSuggestions] = useState([]);
  const [storageLocation, setStorageLocation] = useState("fridge");
  const [category, setCategory] = useState(initialCategory);
  const [quantity, setQuantity] = useState(1);
  const [pricePerUnit, setPricePerUnit] = useState("");

  // ผลลัพธ์จาก /api/expiry-estimate — เก็บ writeBackToReference จากตรงนี้เสมอ ไม่เปลี่ยนตาม
  // escape-hatch toggle (escape-hatch ห้ามเขียนกลับเสมอ เพราะมันเป็น false อยู่แล้วตั้งแต่ตอนเป็น Path A)
  const [expiryMeta, setExpiryMeta] = useState(null);
  const [uiMode, setUiMode] = useState(null); // "auto-fill" | "quick-pick" (โชว์จริงบนจอ — escape-hatch แก้ตรงนี้ได้)
  const [expiryDate, setExpiryDate] = useState("");
  const [selectedDays, setSelectedDays] = useState(null); // สำหรับ quick-pick: 3/7/15/"custom"

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const debounceRef = useRef(null);

  // ค้นหา autocomplete ตอนพิมพ์ชื่อ (debounce 300ms)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!name.trim()) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/food-reference?q=${encodeURIComponent(name.trim())}`);
        const data = await res.json();
        setSuggestions(data.items || []);
      } catch {
        setSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [name]);

  async function lookupExpiry(foodName, location) {
    if (!foodName.trim()) return;
    try {
      const res = await fetch(
        `/api/expiry-estimate?name=${encodeURIComponent(foodName.trim())}&storageLocation=${location}`
      );
      const meta = await res.json();
      setExpiryMeta(meta);
      setUiMode(meta.mode);
      if (meta.category) setCategory(meta.category);

      if (meta.mode === "auto-fill") {
        setExpiryDate(toISODate(meta.defaultDays));
        setSelectedDays(meta.defaultDays);
      } else {
        setExpiryDate("");
        setSelectedDays(null);
      }
    } catch {
      // เงียบไว้ — user ยังกรอกวันหมดอายุเองได้ผ่าน quick-pick/custom
    }
  }

  function pickSuggestion(item) {
    setName(item.name);
    setCategory(item.category);
    setSuggestions([]);
    lookupExpiry(item.name, storageLocation);
  }

  function handleNameBlur() {
    lookupExpiry(name, storageLocation);
  }

  function handleStorageChange(value) {
    setStorageLocation(value);
    if (name.trim()) lookupExpiry(name, value);
  }

  function pickQuickDays(d) {
    setSelectedDays(d);
    if (d === "custom") {
      setExpiryDate(toISODate(7));
    } else {
      setExpiryDate(toISODate(d));
    }
  }

  function toggleEscapeHatch() {
    // สลับจาก Path A (auto-fill) ไปใช้ปุ่ม quick-pick ชั่วคราว สำหรับของเฉพาะกรณี
    // (ของลดราคา/ค้างสต๊อก) — ค่าที่ได้ตรงนี้ห้ามเขียนกลับ food_reference เสมอ
    // (expiryMeta.writeBackToReference เป็น false อยู่แล้วเพราะมาจาก Path A ไม่ต้องแก้)
    setUiMode(uiMode === "auto-fill" ? "quick-pick" : "auto-fill");
    if (expiryMeta?.mode === "auto-fill") {
      setExpiryDate(toISODate(expiryMeta.defaultDays));
      setSelectedDays(expiryMeta.defaultDays);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);

    if (!name.trim() || !expiryDate) {
      setFormError("กรอกชื่อของและวันหมดอายุก่อนนะ");
      return;
    }

    const days =
      selectedDays === "custom" || selectedDays === null
        ? daysBetweenTodayAnd(expiryDate)
        : selectedDays;

    // เขียนกลับ food_reference เฉพาะตอนเป็น Path B แท้ๆ — expiryMeta.writeBackToReference มาจาก
    // /api/expiry-estimate อยู่แล้วว่า false เสมอสำหรับ Path A (ไม่ว่าจะ toggle escape-hatch
    // ไปโชว์ quick-pick หรือไม่ก็ตาม) จึงใช้ค่านี้ตรงๆ ได้เลยไม่ต้องเช็ค uiMode ซ้ำ
    const writeBack = Boolean(expiryMeta?.writeBackToReference);

    setSubmitting(true);
    try {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          category,
          storageLocation,
          quantity: Number(quantity) || 1,
          pricePerUnit: pricePerUnit === "" ? null : Number(pricePerUnit),
          expiryDate,
          days,
          writeBack,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      router.push("/items");
    } catch (err) {
      setFormError(err.message);
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
        <h1 className="font-semibold text-zinc-900 dark:text-zinc-50">เพิ่มของเข้าตู้</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4">
        {/* ชื่อสินค้า */}
        <div className="relative">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            ชื่อสินค้า
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleNameBlur}
            placeholder="เช่น นมสด, ไข่ไก่, คะน้า"
            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2.5 text-sm"
            required
          />
          {suggestions.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-lg overflow-hidden">
              {suggestions.map((s) => (
                <li key={s.name}>
                  <button
                    type="button"
                    onClick={() => pickSuggestion(s)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700"
                  >
                    {s.name} <span className="text-zinc-400">· {s.category}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* หมวดหมู่ */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            หมวดหมู่
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-xl border border-sky-200 dark:border-sky-900 bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 px-3 py-2.5 text-sm font-medium"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* ที่เก็บ */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            ที่เก็บ
          </label>
          <div className="flex gap-2">
            {STORAGE_LOCATIONS.map((s) => (
              <button
                type="button"
                key={s.value}
                onClick={() => handleStorageChange(s.value)}
                className={`px-3 py-1.5 rounded-full text-sm border ${
                  storageLocation === s.value
                    ? "bg-rose-500 text-white border-rose-500"
                    : "border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-300"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* จำนวน + ราคา */}
        <div className="flex gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              จำนวน
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, Number(q) - 1))}
                className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 hover:bg-rose-200 dark:bg-rose-950/40 dark:text-rose-300 font-medium"
              >
                −
              </button>
              <span className="w-6 text-center text-sm font-medium">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity((q) => Number(q) + 1)}
                className="w-8 h-8 rounded-full bg-sky-100 text-sky-600 hover:bg-sky-200 dark:bg-sky-950/40 dark:text-sky-300 font-medium"
              >
                +
              </button>
            </div>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              ราคา/หน่วย (ไม่บังคับ)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={pricePerUnit}
              onChange={(e) => setPricePerUnit(e.target.value)}
              placeholder="บาท"
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2.5 text-sm"
            />
          </div>
        </div>

        {/* วันหมดอายุ — UX 2-path */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            วันหมดอายุ
          </label>

          {uiMode === "auto-fill" && (
            <div className="flex flex-col gap-1">
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 font-medium px-3 py-2.5 text-sm"
              />
              <p className="text-xs text-zinc-400">ระบบเดาให้จากฐานข้อมูล แก้ไขได้เลย</p>
              <button
                type="button"
                onClick={toggleEscapeHatch}
                className="text-xs text-rose-500 hover:underline text-left mt-1"
              >
                ไม่ใช่ของใหม่ปกติ? (ป้ายเหลือง/ซื้อมานานแล้ว)
              </button>
            </div>
          )}

          {uiMode === "quick-pick" && (
            <div className="flex flex-col gap-2">
              {expiryMeta?.mode === "auto-fill" && (
                <button
                  type="button"
                  onClick={toggleEscapeHatch}
                  className="text-xs text-zinc-400 hover:underline text-left"
                >
                  ← กลับไปใช้วันหมดอายุที่ระบบเดาให้
                </button>
              )}
              <div className="flex gap-2 flex-wrap">
                {[3, 7, 15, "custom"].map((d) => (
                  <button
                    type="button"
                    key={d}
                    onClick={() => pickQuickDays(d)}
                    className={`px-3 py-1.5 rounded-full text-sm border ${
                      selectedDays === d
                        ? "bg-rose-500 text-white border-rose-500"
                        : "border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-300"
                    }`}
                  >
                    {d === "custom" ? "กำหนดเอง" : `${d} วัน`}
                  </button>
                ))}
              </div>
              {selectedDays === "custom" && (
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2.5 text-sm"
                />
              )}
            </div>
          )}

          {uiMode === null && (
            <p className="text-xs text-zinc-400">พิมพ์ชื่อของก่อน ระบบจะเดาวันหมดอายุให้อัตโนมัติ</p>
          )}
        </div>

        {formError && <p className="text-sm text-rose-600">{formError}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white rounded-full py-2.5 text-sm font-medium"
        >
          {submitting ? "กำลังบันทึก..." : "บันทึก"}
        </button>
      </form>
    </div>
  );
}

export default function AddItemPage() {
  return (
    <Suspense fallback={null}>
      <AddItemForm />
    </Suspense>
  );
}
