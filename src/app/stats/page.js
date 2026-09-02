"use client";

// หน้า "สถิติ" — โดนัทชาร์ตสัดส่วนมูลค่าของที่ทิ้ง (event_type='expired_unwanted') แยกตามหมวดหมู่/รายชิ้น
// ของเดือนที่เลือกอยู่ ดึงจาก /api/stats/waste (SQL aggregation ล้วนๆ ไม่มี AI/ML ตัดสินใจ)

import { useEffect, useState } from "react";
import { ChevronRightIcon, LeafIcon } from "@/components/icons";
import { currentMonthStr, shiftMonth, thaiMonthLabel, isCurrentMonth } from "@/lib/monthUtils";

// พาสเทลโทนเดียวกับที่ใช้อยู่ในหน้าอื่น (rose/amber/violet/emerald/sky/pink) วนซ้ำถ้าหมวดหมู่เยอะกว่านี้
const PALETTE = ["#fbbf24", "#a78bfa", "#34d399", "#38bdf8", "#fb7185", "#f472b6", "#94a3b8"];

function formatBaht(n) {
  return Math.round(n).toLocaleString("th-TH");
}

function DonutChart({ breakdown, total }) {
  const size = 180;
  const strokeWidth = 26;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let offsetAcc = 0;
  const segments = breakdown.map((seg, i) => {
    const fraction = total > 0 ? seg.amount / total : 0;
    const dash = fraction * circumference;
    const el = (
      <circle
        key={seg.label}
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={PALETTE[i % PALETTE.length]}
        strokeWidth={strokeWidth}
        strokeDasharray={`${dash} ${circumference - dash}`}
        strokeDashoffset={-offsetAcc}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    );
    offsetAcc += dash;
    return el;
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        className="text-zinc-100 dark:text-zinc-800"
        strokeWidth={strokeWidth}
      />
      {total > 0 && segments}
      <text
        x="50%"
        y="46%"
        textAnchor="middle"
        className="fill-zinc-900 dark:fill-zinc-50"
        style={{ fontSize: 22, fontWeight: 700 }}
      >
        {formatBaht(total)}
      </text>
      <text x="50%" y="61%" textAnchor="middle" className="fill-zinc-400" style={{ fontSize: 12 }}>
        บาท
      </text>
    </svg>
  );
}

function CompareBarChart({ history, currentMonth }) {
  const max = Math.max(...history.map((h) => h.amount), 1);
  return (
    <div className="flex items-end gap-2 h-28">
      {history.map((h) => {
        const heightPct = Math.max((h.amount / max) * 100, h.amount > 0 ? 4 : 1);
        const active = h.month === currentMonth;
        return (
          <div key={h.month} className="flex-1 flex flex-col items-center gap-1 h-full">
            <div className="w-full flex-1 flex items-end">
              <div
                className={`w-full rounded-t-md transition-all ${
                  active ? "bg-rose-500" : "bg-sky-200 dark:bg-sky-900"
                }`}
                style={{ height: `${heightPct}%` }}
                title={`${formatBaht(h.amount)} บาท`}
              />
            </div>
            <span className={`text-[10px] ${active ? "text-rose-500 font-medium" : "text-zinc-400"}`}>
              {thaiMonthLabel(h.month)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function StatsPage() {
  const [month, setMonth] = useState(currentMonthStr());
  const [view, setView] = useState("category"); // "category" | "item"
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const [showCompare, setShowCompare] = useState(false);
  const [history, setHistory] = useState(null);
  const [historyError, setHistoryError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/stats/waste?month=${month}&view=${view}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "โหลดสถิติไม่สำเร็จ");
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
  }, [month, view]);

  function toggleCompare() {
    const next = !showCompare;
    setShowCompare(next);
    if (next && !history) {
      fetch("/api/stats/waste-history?months=6")
        .then(async (res) => {
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || "โหลดข้อมูลเปรียบเทียบไม่สำเร็จ");
          setHistory(json);
        })
        .catch((err) => setHistoryError(err.message));
    }
  }

  const breakdown = data?.breakdown || [];
  const total = data?.total || 0;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center">
            <LeafIcon className="w-5 h-5 text-rose-500" />
          </span>
          <span className="font-semibold text-zinc-900 dark:text-zinc-50">สถิติ</span>
        </div>
      </div>

      <div className="px-4">
        {/* ตัวเลื่อนเดือน */}
        <div className="flex items-center justify-center gap-4 mb-4">
          <button
            type="button"
            aria-label="เดือนก่อนหน้า"
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
            className="w-8 h-8 rounded-full flex items-center justify-center rotate-180 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <ChevronRightIcon className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200 w-20 text-center">
            {thaiMonthLabel(month)}
          </span>
          <button
            type="button"
            aria-label="เดือนถัดไป"
            disabled={isCurrentMonth(month)}
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronRightIcon className="w-4 h-4" />
          </button>
        </div>

        {error ? (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-4 text-sm text-amber-900 dark:text-amber-200 mb-4">
            <p className="font-medium mb-1">ยังต่อฐานข้อมูลไม่ได้</p>
            <p className="text-xs opacity-70">{error}</p>
          </div>
        ) : data === null ? (
          <p className="text-sm text-zinc-400 text-center py-8">กำลังโหลด...</p>
        ) : (
          <>
            {/* โดนัทชาร์ต */}
            <div className="rounded-2xl bg-white dark:bg-zinc-800 shadow-sm p-4 mb-4">
              <p className="text-center text-sm text-zinc-500 dark:text-zinc-400 mb-2">
                สัดส่วนราคาของอาหารที่หมดอายุ
                <br />
                ก่อนถูกบริโภค
              </p>
              <DonutChart breakdown={breakdown} total={total} />
            </div>

            {/* ปุ่มเปรียบเทียบ */}
            <button
              type="button"
              onClick={toggleCompare}
              className="w-full flex items-center justify-between rounded-2xl bg-gradient-to-r from-rose-400 to-rose-500 text-white px-4 py-3 mb-4 shadow-sm shadow-rose-500/20"
            >
              <span className="font-medium text-sm">เปรียบเทียบ</span>
              <ChevronRightIcon
                className={`w-4 h-4 transition-transform ${showCompare ? "rotate-90" : ""}`}
              />
            </button>

            {showCompare && (
              <div className="rounded-2xl bg-white dark:bg-zinc-800 shadow-sm p-4 mb-4">
                {historyError ? (
                  <p className="text-xs text-rose-600">{historyError}</p>
                ) : !history ? (
                  <p className="text-sm text-zinc-400 text-center py-4">กำลังโหลด...</p>
                ) : (
                  <>
                    <CompareBarChart history={history.history} currentMonth={history.history.at(-1)?.month} />
                    <p className="text-sm text-center mt-3 text-zinc-600 dark:text-zinc-300">
                      {history.diffFromAverage === 0 ? (
                        "เดือนนี้เท่ากับค่าเฉลี่ยย้อนหลัง"
                      ) : history.diffFromAverage > 0 ? (
                        <>
                          เดือนนี้ทิ้งของ{" "}
                          <span className="font-semibold text-rose-500">
                            สูงกว่าค่าเฉลี่ย {formatBaht(history.diffFromAverage)} บาท
                          </span>
                        </>
                      ) : (
                        <>
                          เดือนนี้ทิ้งของ{" "}
                          <span className="font-semibold text-emerald-500">
                            ต่ำกว่าค่าเฉลี่ย {formatBaht(-history.diffFromAverage)} บาท
                          </span>
                        </>
                      )}
                    </p>
                    <p className="text-xs text-center text-zinc-400 mt-1">
                      ค่าเฉลี่ย {history.history.length - 1} เดือนก่อนหน้า:{" "}
                      {formatBaht(history.averagePreviousMonths)} บาท
                    </p>
                  </>
                )}
              </div>
            )}

            {/* แท็บ หมวดหมู่ / รายชิ้น */}
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => setView("category")}
                className={`flex-1 px-3 py-2 rounded-full text-sm font-medium border ${
                  view === "category"
                    ? "bg-rose-500 text-white border-rose-500"
                    : "border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-300"
                }`}
              >
                หมวดหมู่
              </button>
              <button
                type="button"
                onClick={() => setView("item")}
                className={`flex-1 px-3 py-2 rounded-full text-sm font-medium border ${
                  view === "item"
                    ? "bg-rose-500 text-white border-rose-500"
                    : "border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-300"
                }`}
              >
                รายชิ้น
              </button>
            </div>

            {/* รายการ breakdown */}
            {breakdown.length === 0 ? (
              <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 px-4 py-3 text-sm mb-5">
                ยังไม่มีของที่ทิ้งในเดือนนี้ 🎉
              </div>
            ) : (
              <ul className="flex flex-col gap-2 mb-5">
                {breakdown.map((seg, i) => {
                  const percent = total > 0 ? Math.round((seg.amount / total) * 100) : 0;
                  const color = PALETTE[i % PALETTE.length];
                  return (
                    <li
                      key={seg.label}
                      className="flex items-center justify-between gap-3 rounded-xl bg-white dark:bg-zinc-800 shadow-sm p-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ background: color }}
                        />
                        <div className="min-w-0">
                          <p className="font-medium text-sm text-zinc-900 dark:text-zinc-50 truncate">
                            {seg.label}
                          </p>
                          <p className="text-xs text-zinc-400">
                            {seg.count} ครั้ง · {formatBaht(seg.amount)} บาท
                          </p>
                        </div>
                      </div>
                      <span
                        className="shrink-0 text-xs font-semibold rounded-full px-2.5 py-1"
                        style={{ background: `${color}26`, color }}
                      >
                        {percent}%
                      </span>
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
