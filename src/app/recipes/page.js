"use client";

// หน้า "แนะนำเมนูอาหาร" — ยิง POST /api/recipes แล้วโชว์เมนูที่ AI แนะนำจากของใกล้หมดอายุ
// ฟีเจอร์นี้เป็นพรีเมียม (39฿/เดือน) จริงๆ แต่บิลด์นี้เป็นเดโม เปิดให้ใช้ฟรี ไม่มี paywall —
// ต้องมีแถบบอกชัดเจนว่าตั้งใจแบบนี้ ไม่ใช่ทำไม่เสร็จ (ดู RECIPE_TASK.md)
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChefHatIcon } from "@/components/icons";

function daysLeftLabel(d) {
  if (d < 0) return `เลยมา ${-d} วัน`;
  if (d === 0) return "หมดอายุวันนี้";
  if (d === 1) return "เหลือ 1 วัน";
  return `เหลือ ${d} วัน`;
}

// skeleton โครงการ์ดระหว่างรอ AI (ปกติใช้เวลา 3-8 วิ) — กันหน้าขาว
function RecipeSkeleton() {
  return (
    <div className="rounded-2xl bg-white/70 dark:bg-zinc-800/70 p-4 animate-pulse">
      <div className="h-5 w-2/3 bg-zinc-200 dark:bg-zinc-700 rounded mb-3" />
      <div className="h-3 w-1/3 bg-zinc-200 dark:bg-zinc-700 rounded mb-4" />
      <div className="h-3 w-full bg-zinc-200 dark:bg-zinc-700 rounded mb-2" />
      <div className="h-3 w-5/6 bg-zinc-200 dark:bg-zinc-700 rounded" />
    </div>
  );
}

function RecipeCard({ recipe }) {
  return (
    <div className="rounded-2xl bg-white dark:bg-zinc-800 shadow-sm p-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="font-semibold text-lg text-zinc-900 dark:text-zinc-50">{recipe.name}</h3>
        <span className="shrink-0 text-xs font-medium text-[#4b3535] bg-[#fcdd9d] rounded-full px-2.5 py-1">
          {recipe.time_minutes} นาที
        </span>
      </div>

      {recipe.uses?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {recipe.uses.map((u) => (
            <span
              key={u}
              className="text-xs font-medium text-[#5c8656] bg-[#e8f4cd] rounded-full px-2.5 py-1"
            >
              {u}
            </span>
          ))}
        </div>
      )}

      {recipe.extra_needed?.length > 0 && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
          ต้องซื้อเพิ่ม: {recipe.extra_needed.join(", ")}
        </p>
      )}

      {recipe.steps?.length > 0 && (
        <ol className="list-decimal list-inside space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
          {recipe.steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default function RecipesPage() {
  const [items, setItems] = useState([]);
  const [recipes, setRecipes] = useState(null); // null = กำลังโหลด
  const [reason, setReason] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load(force = false) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const data = await res.json();
      setItems(data.items || []);
      setRecipes(data.recipes || []);
      setReason(data.reason || null);
      setError(data.error || null);
    } catch {
      setItems([]);
      setRecipes([]);
      setError("คิดเมนูไม่สำเร็จ ลองใหม่อีกทีนะ");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(false);
  }, []);

  return (
    <div className="bg-[#fffcf8] dark:bg-zinc-900 min-h-full pb-28">
      {/* Header — ไม่มีปุ่มย้อนกลับแยก เพราะ BottomNav (แท็บ "หน้าแรก") ลอยอยู่ทุกหน้าอยู่แล้ว */}
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-3">
        <span className="w-9 h-9 rounded-xl bg-[#fff3d9] flex items-center justify-center shrink-0">
          <ChefHatIcon className="w-5 h-5 text-[#4b3535]" />
        </span>
        <span className="font-semibold text-xl text-zinc-900 dark:text-zinc-50 tracking-tight">
          แนะนำเมนูอาหาร
        </span>
      </div>

      <div className="px-4">
        {/* แถบโหมดสาธิต */}
        <div className="rounded-2xl bg-[#fcdd9d] dark:brightness-[0.4] px-4 py-3 text-sm text-[#4b3535] mb-4">
          🎁 โหมดสาธิต — ฟีเจอร์นี้เป็นพรีเมียม (39฿/เดือน) เปิดให้ทดลองใช้ฟรีในเวอร์ชันนี้
        </div>

        {loading ? (
          <>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {[1, 2, 3].map((i) => (
                <span
                  key={i}
                  className="h-6 w-20 bg-zinc-200 dark:bg-zinc-700 rounded-full animate-pulse"
                />
              ))}
            </div>
            <div className="flex flex-col gap-3">
              <RecipeSkeleton />
              <RecipeSkeleton />
              <RecipeSkeleton />
            </div>
          </>
        ) : reason === "no_items" ? (
          <div className="rounded-2xl bg-white dark:bg-zinc-800 p-5 text-center">
            <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-3">
              ยังไม่มีของใกล้หมดอายุให้แนะนำเมนูเลย ลองเพิ่มของในตู้เย็นก่อนนะ
            </p>
            <Link
              href="/add-item"
              className="inline-block text-sm font-medium text-white bg-[#4b3535] rounded-full px-5 py-2"
            >
              ไปเพิ่มของ
            </Link>
          </div>
        ) : (
          <>
            {/* ของใกล้หมดอายุที่ใช้คิดเมนู */}
            {items.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {items.map((it) => (
                  <span
                    key={it.id}
                    className="text-xs font-medium text-[#7a3540] bg-[#edc5ca] rounded-full px-2.5 py-1"
                  >
                    {it.name} · {daysLeftLabel(it.days_left)}
                  </span>
                ))}
              </div>
            )}

            {error ? (
              <div className="rounded-2xl bg-white dark:bg-zinc-800 p-5 text-center">
                <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-3">{error}</p>
                <button
                  type="button"
                  onClick={() => load(true)}
                  className="text-sm font-medium text-white bg-[#4b3535] rounded-full px-5 py-2"
                >
                  ลองใหม่
                </button>
              </div>
            ) : recipes && recipes.length > 0 ? (
              <div className="flex flex-col gap-3 mb-4">
                {recipes.map((r, i) => (
                  <RecipeCard key={i} recipe={r} />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl bg-white dark:bg-zinc-800 p-5 text-center mb-4">
                <p className="text-sm text-zinc-600 dark:text-zinc-300">
                  ของที่มีอยู่ยังน้อยเกินจะคิดเมนูได้ ลองเพิ่มของอีกนิดนะ
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => load(true)}
              disabled={loading}
              className="w-full text-sm font-medium text-[#4b3535] bg-[#e8f4cd] rounded-full px-5 py-2.5 disabled:opacity-50"
            >
              คิดเมนูใหม่
            </button>
          </>
        )}
      </div>
    </div>
  );
}
