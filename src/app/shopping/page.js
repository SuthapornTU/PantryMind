"use client";

// หน้า "ช้อปปิ้ง" (shopping list) — ค้นหา+เพิ่มของที่ต้องซื้อ, โชว์ badge ถ้ามีของนี้ในตู้อยู่แล้ว
// (already_have มาจาก /api/shopping-list ที่เช็คกับ pantry_items ให้แล้ว เป็น SQL ล้วนๆ ไม่มี AI)
import { useEffect, useRef, useState } from "react";
import { LeafIcon } from "@/components/icons";

export default function ShoppingPage() {
  const [items, setItems] = useState(null); // null = กำลังโหลด
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const debounceRef = useRef(null);

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
    setQuery("");
    setSuggestions([]);
    try {
      const res = await fetch("/api/shopping-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemName: name, quantity: 1 }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "เพิ่มไม่สำเร็จ");
      await load();
    } catch (err) {
      alert(err.message);
    }
  }

  async function markBought(id) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/shopping-list/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "bought" }),
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
      const res = await fetch(`/api/shopping-list/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      alert(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center">
            <LeafIcon className="w-5 h-5 text-rose-500" />
          </span>
          <span className="font-semibold text-zinc-900 dark:text-zinc-50">ช้อปปิ้ง</span>
        </div>
      </div>

      <div className="px-4">
        {/* ช่องค้นหา + dropdown */}
        <div className="relative mb-4">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="พิมพ์ชื่อของที่ต้องซื้อ..."
            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2.5 text-sm"
          />
          {suggestions.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-lg overflow-hidden">
              {suggestions.map((s) => (
                <li key={s.name}>
                  <button
                    type="button"
                    onClick={() => addToList(s.name)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700"
                  >
                    {s.name} <span className="text-zinc-400">· {s.category}</span>
                    {s.already_have_quantity > 0 && (
                      <span className="text-amber-600"> · มีอยู่แล้วในตู้ {s.already_have_quantity} ชิ้น</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && (
          <p className="text-sm text-rose-600 mb-3">
            {error} — ถ้ายังไม่ได้ตั้งค่า Supabase ดูวิธีที่หน้าแรก
          </p>
        )}

        {items === null ? (
          <p className="text-zinc-400 text-sm">กำลังโหลด...</p>
        ) : items.length === 0 && !error ? (
          <p className="text-zinc-400 text-sm">ยังไม่มีของที่ต้องซื้อ</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-white dark:bg-zinc-800 shadow-sm p-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-zinc-900 dark:text-zinc-50 truncate">
                    {item.item_name}
                  </p>
                  <p className="text-xs text-zinc-400">
                    จำนวน {item.quantity}
                    {item.already_have && (
                      <span className="ml-2 inline-block rounded-full bg-amber-50 text-amber-600 px-2 py-0.5">
                        มีอยู่แล้วในตู้ {item.already_have_quantity} ชิ้น
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => markBought(item.id)}
                    disabled={busyId === item.id}
                    className="text-xs px-2.5 py-1.5 rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200 disabled:opacity-50"
                  >
                    ซื้อแล้ว
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
