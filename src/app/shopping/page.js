"use client";

// หน้า "ช้อปปิ้ง" (shopping list) — ค้นหา+เพิ่มของที่ต้องซื้อ, โชว์ badge ถ้ามีของนี้ในตู้อยู่แล้ว
// (already_have มาจาก /api/shopping-list ที่เช็คกับ pantry_items ให้แล้ว เป็น SQL ล้วนๆ ไม่มี AI)
// ดีไซน์อ้างอิง Figma node "Shopping list" (17:3122) — วงกลมซ้ายของแต่ละแถวคือปุ่ม "ซื้อแล้ว" เดิม
// (กดแล้วรายการหายไปจากลิสต์ เหมือน checkbox ติ๊กถูก) ส่วนปุ่มลบยังคงไว้เป็นไอคอน "×" เล็กๆ ด้านขวา
// หมายเหตุ: ดีไซน์ต้นฉบับมีปุ่ม "ยืนยัน" ลอยด้านล่างและ banner เตือน "กินไม่ทันจนหมดอายุ" ต่อรายการ
// แต่ทั้งสองอย่างต้องมี flow/ข้อมูลที่แอปนี้ยังไม่มี (ไม่มี batch-confirm, ไม่มีการวิเคราะห์ waste
// history ต่อชื่อของ) เลยไม่ได้ใส่มาด้วย — ของเดิมเพิ่มลงลิสต์ทันทีที่เลือกอยู่แล้ว
import { useEffect, useRef, useState } from "react";
import { FridgeIcon, ChefHatIcon, PlusIcon } from "@/components/icons";

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
        ) : items.length === 0 && !error ? (
          <p className="text-[#4b3535]/60 text-sm">ยังไม่มีของที่ต้องซื้อ</p>
        ) : (
          <ul className="flex flex-col gap-2.5 pb-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-3xl bg-[#fefeff] shadow-sm px-3 py-3"
              >
                <button
                  type="button"
                  aria-label="ซื้อแล้ว"
                  title="ซื้อแล้ว"
                  onClick={() => markBought(item.id)}
                  disabled={busyId === item.id}
                  className="w-8 h-8 rounded-full border-2 border-[#5c8656] shrink-0 disabled:opacity-40"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-zinc-900 truncate">{item.item_name}</p>
                  {item.already_have && (
                    <p className="text-sm text-[#5c8656]">มีอยู่แล้ว {item.already_have_quantity} ชิ้น</p>
                  )}
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
      </div>
    </div>
  );
}
