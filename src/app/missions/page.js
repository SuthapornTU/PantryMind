"use client";

// หน้าภารกิจ + ต้นไม้ — fetch /api/missions (ensure ภารกิจวันนี้ + คืนภารกิจ 5 แบบ + สถานะต้นไม้)
// ทุกอย่างเป็น rule-based (SQL/arithmetic) ฝั่ง backend อยู่แล้ว หน้านี้แค่ render ผลลัพธ์
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRightIcon, LeafIcon } from "@/components/icons";

const DROPS_PER_LEVEL = 6; // ตรงกับ src/lib/missions.js (level up ทุก 6 หยด)

function treeEmoji(level) {
  if (level >= 4) return "🌳";
  if (level >= 2) return "🌿";
  return "🌱";
}

export default function MissionsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/missions")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "โหลดภารกิจไม่สำเร็จ");
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setData(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <Link
          href="/"
          aria-label="กลับ"
          className="w-8 h-8 rounded-full flex items-center justify-center rotate-180 text-zinc-500"
        >
          <ChevronRightIcon className="w-5 h-5" />
        </Link>
        <span className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center">
          <LeafIcon className="w-5 h-5 text-rose-500" />
        </span>
        <h1 className="font-semibold text-zinc-900 dark:text-zinc-50">ภารกิจ</h1>
      </div>

      <div className="px-4">
        {error ? (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-4 text-sm text-amber-900 dark:text-amber-200">
            <p className="font-medium mb-1">ยังต่อฐานข้อมูลไม่ได้</p>
            <p className="text-xs opacity-70">{error}</p>
          </div>
        ) : data === null ? (
          <p className="text-sm text-zinc-400 text-center py-8">กำลังโหลด...</p>
        ) : (
          <>
            {/* ต้นไม้ */}
            <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 p-4 flex items-center gap-4 mb-5">
              <span className="text-5xl leading-none">{treeEmoji(data.tree.level)}</span>
              <div>
                <p className="font-semibold text-zinc-900 dark:text-zinc-50">เลเวล {data.tree.level}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  💧 {data.tree.water_drops % DROPS_PER_LEVEL}/{DROPS_PER_LEVEL} หยด ถึงเลเวลถัดไป
                </p>
              </div>
            </div>

            {/* ภารกิจวันนี้ */}
            <p className="font-semibold text-zinc-800 dark:text-zinc-100 mb-2">ภารกิจวันนี้</p>
            {data.missions.length === 0 ? (
              <p className="text-sm text-zinc-400">ยังไม่มีภารกิจวันนี้</p>
            ) : (
              <ul className="flex flex-col gap-2 mb-5">
                {data.missions.map((m) => {
                  const percent =
                    m.target > 0 ? Math.min(100, Math.round((m.progress / m.target) * 100)) : 0;
                  return (
                    <li
                      key={m.id}
                      className="rounded-xl bg-white dark:bg-zinc-800 shadow-sm p-3 flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                          {m.description}
                        </p>
                        {m.completed ? (
                          <span className="shrink-0 text-xs font-medium rounded-full px-2 py-0.5 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40">
                            ✓ สำเร็จ
                          </span>
                        ) : (
                          <span className="shrink-0 text-xs text-zinc-400">
                            {m.progress}/{m.target} {m.unit || ""}
                          </span>
                        )}
                      </div>
                      <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-700 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${m.completed ? "bg-emerald-500" : "bg-rose-500"}`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
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
