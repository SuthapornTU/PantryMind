"use client";

// หน้า "เลือกจากลิสต์" — เข้าถึงผ่านปุ่ม "พิมพ์เอง" ใน FAB แทน /add-item ตรงๆ
// โชว์ของสดพื้นฐานจาก food_reference แยกตามหมวดหมู่ (GET /api/food-reference ไม่ใส่ q = ลิสต์เต็ม
// เรียงตามหมวดหมู่ — ต่อยอดจาก endpoint เดิม), พิมพ์ค้นหา debounce เหมือน add-item/page.js
// (เรียก endpoint เดียวกันพร้อม ?q=) — กด "+" ของที่มีอยู่แล้ว หรือ "เพิ่มเป็นรายการใหม่" ของที่ไม่เจอ
// ทั้งคู่แค่พาไปฟอร์ม /add-item เดิม (prefill name/category) ไม่มีจุดไหนบันทึกตรงนี้เลย
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRightIcon, PlusIcon } from "@/components/icons";

function groupByCategory(items) {
  const groups = [];
  const indexByCategory = new Map();
  for (const item of items) {
    if (!indexByCategory.has(item.category)) {
      indexByCategory.set(item.category, groups.length);
      groups.push({ category: item.category, items: [] });
    }
    groups[indexByCategory.get(item.category)].items.push(item);
  }
  return groups;
}

export default function BrowseAddItemPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState(null); // null = กำลังโหลด
  const [error, setError] = useState(null);
  const debounceRef = useRef(null);

  // โหลดลิสต์เต็ม (ไม่มี q) ตอนเปิดหน้า แล้ว debounce เรียกซ้ำพร้อม q ทุกครั้งที่พิมพ์
  // — debounce เหลือ 150ms (จาก 300ms) + ยกเลิก request เก่าด้วย AbortController กัน response ช้า
  // ย้อนมาทับผลใหม่กว่า (pattern เดียวกับที่แก้ใน src/app/add-item/page.js — แก้ปัญหาดรอปดาวน์
  // แอบช้า/ค้างตอนพิมพ์เร็วๆ)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const controller = new AbortController();
    debounceRef.current = setTimeout(async () => {
      try {
        const q = query.trim();
        const res = await fetch(`/api/food-reference${q ? `?q=${encodeURIComponent(q)}` : ""}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "โหลดรายการไม่สำเร็จ");
        setItems(data.items || []);
        setError(null);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message);
          setItems([]);
        }
      }
    }, 150);
    return () => {
      clearTimeout(debounceRef.current);
      controller.abort();
    };
  }, [query]);

  function goToAddItem(name, category) {
    const params = new URLSearchParams({ name });
    if (category) params.set("category", category);
    router.push(`/add-item?${params.toString()}`);
  }

  const trimmedQuery = query.trim();
  const groups = items ? groupByCategory(items) : [];
  const notFound = items !== null && trimmedQuery && items.length === 0;

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
        <h1 className="font-semibold text-zinc-900 dark:text-zinc-50">เลือกจากลิสต์</h1>
      </div>

      <div className="px-4 flex flex-col gap-4">
        {/* ช่องค้นหา */}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหาของ เช่น นมสด, ไข่ไก่, คะน้า"
          className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2.5 text-sm"
        />

        {error && (
          <p className="text-sm text-rose-600">
            {error} — ถ้ายังไม่ได้ตั้งค่า Supabase ดูวิธีที่หน้าแรก
          </p>
        )}

        {items === null ? (
          <p className="text-zinc-400 text-sm">กำลังโหลด...</p>
        ) : notFound ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-zinc-400">ไม่พบ &quot;{trimmedQuery}&quot; ในลิสต์</p>
            <button
              type="button"
              onClick={() => goToAddItem(trimmedQuery, null)}
              className="rounded-full bg-rose-500 hover:bg-rose-600 text-white px-5 py-2.5 text-sm font-medium"
            >
              ➕ เพิ่ม &quot;{trimmedQuery}&quot; เป็นรายการใหม่
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4 mb-6">
            {groups.map((group) => (
              <div key={group.category}>
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200 mb-2">
                  {group.category}
                </p>
                <div className="flex flex-wrap gap-2">
                  {group.items.map((item) => (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => goToAddItem(item.name, item.category)}
                      className="flex items-center gap-1.5 rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 pl-3 pr-2 py-1.5 text-sm text-zinc-700 dark:text-zinc-200"
                    >
                      {item.name}
                      <span className="w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center shrink-0">
                        <PlusIcon className="w-2.5 h-2.5" />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
