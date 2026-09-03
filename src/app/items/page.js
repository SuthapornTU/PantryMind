"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { storageLabel } from "@/lib/shared/constants";
import { ChevronRightIcon } from "@/components/icons";

export default function ItemsPage() {
  const [items, setItems] = useState(null); // null = กำลังโหลด
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

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

  async function markUsed(id) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "used" }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setItems((prev) => prev.filter((i) => i.id !== id));
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
      const res = await fetch(`/api/items/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      alert(err.message);
    } finally {
      setBusyId(null);
    }
  }

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
          <ul className="flex flex-col gap-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-white dark:bg-zinc-800 shadow-sm p-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-zinc-900 dark:text-zinc-50 truncate">{item.name}</p>
                  <p className="text-xs text-zinc-400">
                    {item.category} · {storageLabel(item.storage_location)} · จำนวน {item.quantity} ·
                    หมดอายุ {new Date(item.expiry_date).toLocaleDateString("th-TH")}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => markUsed(item.id)}
                    disabled={busyId === item.id}
                    className="text-xs px-2.5 py-1.5 rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200 disabled:opacity-50"
                  >
                    ใช้แล้ว
                  </button>
                  <button
                    onClick={() => remove(item.id)}
                    disabled={busyId === item.id}
                    className="text-xs px-2.5 py-1.5 rounded-full bg-zinc-100 text-zinc-500 hover:bg-zinc-200 disabled:opacity-50 dark:bg-zinc-700 dark:text-zinc-300"
                  >
                    ลบ
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
