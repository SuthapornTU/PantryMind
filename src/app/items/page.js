"use client";

// บังคับ dynamic rendering (ดู TASK_E_AUTH.md E3) — หน้าอ่านข้อมูล user คนเดียว ห้าม static cache
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CATEGORIES, NEAR_EXPIRY_DAYS, STORAGE_LOCATIONS, storageLabel } from "@/lib/shared/constants";
import { formatExpiryDateBE } from "@/lib/shared/dateFormat";
import { ChevronRightIcon } from "@/components/icons";

// เกณฑ์ "ใกล้หมดอายุ" เดียวกับหน้า Home/ภารกิจ (NEAR_EXPIRY_DAYS = 3 วัน — ดู src/lib/shared/constants.js)
// ใช้สูตรเทียบวันแบบเดียวกับ src/lib/server/dashboard.js::daysUntil (ตัดเวลาออกก่อนลบ กัน timezone
// ทำให้ปัดวันผิด) — ไม่ได้เรียก import ตรงเพราะไฟล์นั้น import "pg" (server-only)
function daysUntil(dateStr) {
  const diff = new Date(dateStr) - new Date(new Date().toDateString());
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

// ขอบกระดาษซ้อนรางๆ ข้างหลัง — เอามาจาก src/app/page.js (STACK_CLASSES) เป๊ะๆ เพื่อให้ icon
// language ตรงกันทั้งแอป แต่ที่นี่เงื่อนไขเปิดคือ rowCount > 1 (กลุ่มนี้รวมมาจากหลายแถวจริงๆ)
// ไม่ใช่ remaining > 1 แบบหน้าแรก — ตั้งใจให้สื่อ "หลายล็อตซ้อนกัน" ตรงๆ
const STACK_CLASSES =
  "before:content-[''] before:absolute before:inset-0 before:-z-10 before:rounded-2xl " +
  "before:bg-white/60 dark:before:bg-zinc-700/60 before:translate-x-1 before:translate-y-1 before:-rotate-1 " +
  "after:content-[''] after:absolute after:inset-0 after:-z-20 after:rounded-2xl " +
  "after:bg-white/35 dark:after:bg-zinc-700/35 after:translate-x-[7px] after:translate-y-[7px] after:rotate-1";

// ความยาวแถบระดับของ (decorative) — สูตรเดียวกับ stockRatio ใน src/app/page.js
function stockRatio(quantity) {
  return Math.max(0.15, Math.min(quantity / 6, 1));
}

// รวมแถวเป็นกลุ่มตาม (name, storage_location) — คล้าย groupByName() ใน src/lib/server/dashboard.js
// แต่ key รวม storage เข้าไปด้วย เพื่อให้ของชื่อเดียวกันแต่เก็บคนละที่ (เช่น ไข่ไก่ในตู้เย็น vs นอกตู้
// เย็น) กลายเป็นการ์ดคนละใบ — เก็บ rowIds ของทุกแถวในกลุ่มไว้ด้วย (ใช้ตอนกดปุ่ม "ใช้แล้ว" ต้องยิงครบ
// ทุกแถว ไม่ใช่แค่แถวเดียว)
function groupByNameAndStorage(rows) {
  const groups = new Map();
  for (const row of rows) {
    const remaining = Number(row.quantity) - Number(row.used_count || 0) - Number(row.wasted_count || 0);
    if (remaining <= 0) continue;
    const key = `${row.name}::${row.storage_location}`;
    const g = groups.get(key);
    if (!g) {
      groups.set(key, {
        key,
        name: row.name,
        storageLocation: row.storage_location,
        category: row.category,
        remaining,
        earliestExpiry: row.expiry_date,
        soleItemId: row.id,
        rowIds: [row.id],
        rowCount: 1,
      });
    } else {
      g.remaining += remaining;
      g.rowCount += 1;
      g.rowIds.push(row.id);
      if (new Date(row.expiry_date) < new Date(g.earliestExpiry)) {
        g.earliestExpiry = row.expiry_date;
        g.category = row.category;
      }
      g.soleItemId = row.id; // จะใช้จริงเฉพาะตอน remaining รวม = 1
    }
  }
  return [...groups.values()];
}

// คงเหลือ 1 ชิ้น → ข้ามหน้ากลาง (/items/[name]) ไปหน้าแก้ไขตรงๆ (เหมือน groupHref ใน src/app/page.js)
// คงเหลือ > 1 ชิ้น → หน้ากลาง พร้อม storage query เพื่อกรองให้ตรงกับการ์ดที่แยกที่เก็บไว้แล้ว
function groupHref(g) {
  if (g.remaining > 1) {
    return `/items/${encodeURIComponent(g.name)}?storage=${encodeURIComponent(g.storageLocation)}`;
  }
  return `/add-item?id=${g.soleItemId}`;
}

export default function ItemsPage() {
  const [items, setItems] = useState(null); // null = กำลังโหลด
  const [error, setError] = useState(null);
  const [busyGroupKey, setBusyGroupKey] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("ทั้งหมด"); // ปุ่มกรองหมวดหมู่ — filter ฝั่ง client ล้วนๆ ไม่ยิง API ซ้ำ
  const [storageFilter, setStorageFilter] = useState("ทั้งหมด"); // ตัวกรองที่เก็บ — เหมือนกัน (client-side, มีตัวเลือก "ทั้งหมด" รวมทุกที่เก็บ)

  async function load() {
    setError(null);
    try {
      const res = await fetch("/api/items");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "โหลดรายการไม่สำเร็จ");
      setItems(data.items);
    } catch (err) {
      setError(err.message);
      setItems([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // กลุ่มตาม (name, storage_location) — ทุก filter/sort ด้านล่างทำงานบน groups นี้ ไม่ใช่แถวดิบ
  const groups = useMemo(() => {
    if (!items) return [];
    return groupByNameAndStorage(items);
  }, [items]);

  // เรียงชื่อก่อน (ให้การ์ดชื่อซ้ำแต่คนละที่เก็บอยู่ติดกันเสมอ) แล้วค่อยเรียงวันหมดอายุในชื่อเดียวกัน
  const sortedGroups = useMemo(() => {
    return [...groups].sort((a, b) => {
      const nameCmp = a.name.localeCompare(b.name, "th");
      if (nameCmp !== 0) return nameCmp;
      return new Date(a.earliestExpiry) - new Date(b.earliestExpiry);
    });
  }, [groups]);

  // ยิง PATCH action:"used" ครบทุก id ในกลุ่ม (ไม่ใช่แค่แถวเดียว) — ถ้ายิงไม่ครบ แถวที่เหลือจะยัง
  // ไม่ถูก mark ว่าใช้แล้วจริงในฐานข้อมูล แล้วจะกลับมาโผล่ที่หน้าแรกอีกครั้งตอนโหลดใหม่
  async function markUsedGroup(group) {
    setBusyGroupKey(group.key);
    try {
      const responses = await Promise.all(
        group.rowIds.map((id) =>
          fetch(`/api/items/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "used" }),
          })
        )
      );
      for (const res of responses) {
        if (!res.ok) throw new Error((await res.json()).error || "บันทึกไม่สำเร็จ");
      }
      const usedIds = new Set(group.rowIds);
      setItems((prev) => prev.filter((i) => !usedIds.has(i.id)));
    } catch (err) {
      alert(err.message);
    } finally {
      setBusyGroupKey(null);
    }
  }

  // รายการหมวดหมู่ที่มีของอยู่จริงเท่านั้น (ไม่โชว์ปุ่มกรองหมวดที่ตู้เย็นไม่มีของเลย) — เรียงตาม
  // ลำดับเดิมใน CATEGORIES เสมอ ไม่เรียงตามความถี่ เพื่อให้ตำแหน่งปุ่มไม่เปลี่ยนไปมาเวลาข้อมูลเปลี่ยน
  const categoriesPresent = useMemo(() => {
    const present = new Set(sortedGroups.map((g) => g.category));
    return CATEGORIES.filter((c) => present.has(c));
  }, [sortedGroups]);

  const filteredGroups = useMemo(() => {
    return sortedGroups.filter(
      (g) =>
        (categoryFilter === "ทั้งหมด" || g.category === categoryFilter) &&
        (storageFilter === "ทั้งหมด" || g.storageLocation === storageFilter)
    );
  }, [sortedGroups, categoryFilter, storageFilter]);

  return (
    <div className="pb-28">
      {/* Header สไตล์หน้าย่อย: ลูกศรย้อนกลับ + ชื่อหน้า */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <Link
          href="/"
          className="w-8 h-8 rounded-full flex items-center justify-center rotate-180 text-zinc-500"
        >
          <ChevronRightIcon className="w-5 h-5" />
        </Link>
        <h1 className="font-semibold text-zinc-900 dark:text-zinc-50">รายการของทั้งหมด</h1>
      </div>

      <div className="px-4">
        {error && (
          <p className="text-sm text-rose-600 mb-3">
            {error} — ถ้ายังไม่ได้ตั้งค่า Supabase ดูวิธีที่หน้าแรก
          </p>
        )}

        {items === null ? (
          <p className="text-zinc-400 text-sm">กำลังโหลด...</p>
        ) : items.length === 0 && !error ? (
          <p className="text-zinc-400 text-sm">
            ยังไม่มีของในตู้เลย{" "}
            <Link href="/add-item" className="text-rose-500 hover:underline">
              เริ่มเพิ่มของแรก
            </Link>
          </p>
        ) : (
          <>
            {/* ตัวกรองที่เก็บ (dropdown) + ปุ่มกรองหมวดหมู่ — filter ง่ายๆ ฝั่ง client ทั้งคู่ ไม่กระทบ
                query/backend เลย — ตัวกรองที่เก็บมีตัวเลือก "ทั้งหมด" ไว้ดูของทุกที่เก็บรวมกันเสมอ */}
            <div className="flex gap-2 overflow-x-auto pb-1 mb-3 -mx-1 px-1">
              <select
                value={storageFilter}
                onChange={(e) => setStorageFilter(e.target.value)}
                className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border-none bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
              >
                <option value="ทั้งหมด">ทุกที่เก็บ</option>
                {STORAGE_LOCATIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              {["ทั้งหมด", ...categoriesPresent].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategoryFilter(c)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap ${
                    categoryFilter === c
                      ? "bg-rose-500 text-white border-rose-500"
                      : "border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-300"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>

            {filteredGroups.length === 0 ? (
              <p className="text-zinc-400 text-sm">ไม่มีของตรงกับตัวกรองนี้</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {filteredGroups.map((g) => {
                  // ใกล้หมดอายุ (≤ NEAR_EXPIRY_DAYS วัน รวมที่เลยมาแล้วด้วย) → กรอบแดงเด่นขึ้นมา
                  const isNearExpiry = daysUntil(g.earliestExpiry) <= NEAR_EXPIRY_DAYS;
                  const ratio = stockRatio(g.remaining);
                  const busy = busyGroupKey === g.key;
                  return (
                    <li key={g.key} className={g.rowCount > 1 ? "relative" : undefined}>
                      <Link
                        href={groupHref(g)}
                        className={`relative flex items-center justify-between gap-3 rounded-2xl bg-white dark:bg-zinc-800 shadow-sm p-3 ${
                          isNearExpiry
                            ? "border-2 border-rose-400 dark:border-rose-600"
                            : "border border-transparent"
                        } ${g.rowCount > 1 ? STACK_CLASSES : ""}`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-zinc-900 dark:text-zinc-50 truncate">
                            {g.name}
                            {g.remaining > 1 && (
                              <span className="text-zinc-400 font-normal"> ×{g.remaining}</span>
                            )}
                          </p>
                          <p className="text-xs text-zinc-400">
                            {g.category} · {storageLabel(g.storageLocation)} · EXP{" "}
                            {formatExpiryDateBE(g.earliestExpiry)}
                          </p>
                          <div className="w-full h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-700 overflow-hidden mt-1.5">
                            <div
                              className="h-full rounded-full bg-sky-400"
                              style={{ width: `${ratio * 100}%` }}
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          title="ใช้แล้ว"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            markUsedGroup(g);
                          }}
                          disabled={busy}
                          className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200 disabled:opacity-50 flex items-center justify-center shrink-0"
                        >
                          ✓
                        </button>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
