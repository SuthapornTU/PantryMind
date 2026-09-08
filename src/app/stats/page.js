"use client";

// หน้า "สถิติ" — โดนัทชาร์ตสัดส่วนมูลค่าของที่ทิ้ง (event_type='expired_unwanted') แยกตามหมวดหมู่/รายชิ้น
// ของเดือนที่เลือกอยู่ ดึงจาก /api/stats/waste (SQL aggregation ล้วนๆ ไม่มี AI/ML ตัดสินใจ)
// ดีไซน์อ้างอิง Figma node "Dash Board - หมวดหมู่/ชนิด/เปรียบเทียบ" (17:3099, 46:2678, 46:2755)
// หมายเหตุ: เฟรม "เปรียบเทียบ" ใน Figma มีแค่ปุ่มสลับ (ไม่มี mockup กราฟเปรียบเทียบจริง)
// เลยคงกราฟแท่งเปรียบเทียบเดิมของแอปไว้ (ใช้งานได้จริงอยู่แล้ว) แค่รีสกินสีให้เข้าธีมใหม่
// ส่วนแถว breakdown ดีไซน์ไม่มี % / จำนวนครั้งให้เห็น (มีแค่ชื่อ + ราคา) — ตัด % กับจำนวนครั้ง
// ออกจากตัวแถวเพื่อให้ตรงดีไซน์ (สัดส่วนยังเห็นได้จากโดนัทชาร์ตด้านบนอยู่แล้ว)

// บังคับ dynamic rendering (ดู TASK_E_AUTH.md E3) — หน้าอ่านข้อมูล user คนเดียว ห้าม static cache
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { ChevronRightIcon, ChevronsRightIcon, ChevronsLeftIcon } from "@/components/icons";
import { currentMonthStr, shiftMonth, thaiMonthLabel, isCurrentMonth } from "@/lib/shared/monthUtils";

// พาเลตเดียวกับสีหมวดหมู่ที่ใช้ทั้งแอป (เขียว/ชมพู/ส้ม/ฟ้า) วนซ้ำถ้าหมวดหมู่เยอะกว่านี้
const PALETTE = ["#bade97", "#edc5ca", "#fcdd9d", "#c3e3ff", "#d8c7f5", "#f5b8c0", "#c9c0b3"];

function formatBaht(n) {
  return Math.round(n).toLocaleString("th-TH");
}

function DonutChart({ breakdown, total }) {
  const size = 190;
  const strokeWidth = 30;
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
        className="text-white/60"
        strokeWidth={strokeWidth}
      />
      {total > 0 && segments}
      <text
        x="50%"
        y="46%"
        textAnchor="middle"
        className="fill-[#4b3535]"
        style={{ fontSize: 26, fontWeight: 700 }}
      >
        {formatBaht(total)}
      </text>
      <text x="50%" y="61%" textAnchor="middle" className="fill-[#4b3535]" style={{ fontSize: 15 }}>
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
                  active ? "bg-[#4b3535]" : "bg-[#e3f2ff]"
                }`}
                style={{ height: `${heightPct}%` }}
                title={`${formatBaht(h.amount)} บาท`}
              />
            </div>
            <span className={`text-[10px] ${active ? "text-[#4b3535] font-medium" : "text-zinc-400"}`}>
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
    <div className="bg-gradient-to-b from-[#f3ebdd] to-[#d3c8b7] min-h-full pb-28">
      {/* หัวข้อ */}
      <div className="px-4 pt-5 pb-1 text-center">
        <p className="font-semibold text-2xl text-[#4b3535] leading-tight tracking-tight">
          สัดส่วนราคาอาหาร
          <br />
          ที่หมดอายุก่อนการบริโภค
        </p>
      </div>

      <div className="px-4">
        {/* ตัวเลื่อนเดือน */}
        <div className="flex items-center justify-center gap-4 mt-2 mb-1">
          <button
            type="button"
            aria-label="เดือนก่อนหน้า"
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
            className="w-8 h-8 rounded-full flex items-center justify-center rotate-180 text-[#4b3535]/70 hover:bg-white/40"
          >
            <ChevronRightIcon className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium text-[#4b3535] w-20 text-center">
            {thaiMonthLabel(month)}
          </span>
          <button
            type="button"
            aria-label="เดือนถัดไป"
            disabled={isCurrentMonth(month)}
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#4b3535]/70 hover:bg-white/40 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronRightIcon className="w-4 h-4" />
          </button>
        </div>

        {error ? (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 mb-4">
            <p className="font-medium mb-1">ยังต่อฐานข้อมูลไม่ได้</p>
            <p className="text-xs opacity-70">{error}</p>
          </div>
        ) : data === null ? (
          <p className="text-sm text-[#4b3535]/60 text-center py-8">กำลังโหลด...</p>
        ) : (
          <>
            {/* โดนัทชาร์ต */}
            <div className="py-2 mb-3">
              <DonutChart breakdown={breakdown} total={total} />
            </div>

            {/* ปุ่มเปรียบเทียบ */}
            <button
              type="button"
              onClick={toggleCompare}
              className="w-full flex items-center justify-between rounded-2xl bg-[rgba(255,45,45,0.45)] text-white px-4 py-2.5 mb-3"
            >
              <span className="font-semibold">เปรียบเทียบ</span>
              {showCompare ? (
                <ChevronsLeftIcon className="w-5 h-5" />
              ) : (
                <ChevronsRightIcon className="w-5 h-5" />
              )}
            </button>

            {showCompare && (
              <div className="rounded-2xl bg-[#fffaf2] shadow-sm p-4 mb-3">
                {historyError ? (
                  <p className="text-xs text-rose-600">{historyError}</p>
                ) : !history ? (
                  <p className="text-sm text-zinc-400 text-center py-4">กำลังโหลด...</p>
                ) : (
                  <>
                    <CompareBarChart history={history.history} currentMonth={history.history.at(-1)?.month} />
                    <p className="text-sm text-center mt-3 text-zinc-600">
                      {history.diffFromAverage === 0 ? (
                        "เดือนนี้เท่ากับค่าเฉลี่ยย้อนหลัง"
                      ) : history.diffFromAverage > 0 ? (
                        <>
                          เดือนนี้ทิ้งของ{" "}
                          <span className="font-semibold text-[#c77984]">
                            สูงกว่าค่าเฉลี่ย {formatBaht(history.diffFromAverage)} บาท
                          </span>
                        </>
                      ) : (
                        <>
                          เดือนนี้ทิ้งของ{" "}
                          <span className="font-semibold text-[#5c8656]">
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
            <div className="flex rounded-2xl bg-[#ccc6bb] p-0.5 mb-3">
              <button
                type="button"
                onClick={() => setView("category")}
                className={`flex-1 px-3 py-2.5 rounded-[14px] text-sm font-semibold transition-colors ${
                  view === "category" ? "bg-[#4b3535] text-white" : "text-[#a49b8e]"
                }`}
              >
                หมวดหมู่
              </button>
              <button
                type="button"
                onClick={() => setView("item")}
                className={`flex-1 px-3 py-2.5 rounded-[14px] text-sm font-semibold transition-colors ${
                  view === "item" ? "bg-[#4b3535] text-white" : "text-[#a49b8e]"
                }`}
              >
                ชนิด
              </button>
            </div>

            {/* รายการ breakdown */}
            {breakdown.length === 0 ? (
              <div className="rounded-2xl bg-emerald-50 text-emerald-700 px-4 py-3 text-sm mb-5">
                ยังไม่มีของที่ทิ้งในเดือนนี้ 🎉
              </div>
            ) : (
              <div className="rounded-3xl bg-[#fffaf2] shadow-sm p-3 mb-5 flex flex-col gap-2.5">
                {breakdown.map((seg, i) => {
                  const color = PALETTE[i % PALETTE.length];
                  return (
                    <div key={seg.label} className="flex items-center gap-2">
                      <div
                        className="flex-1 min-w-0 rounded-2xl bg-white border-2 px-4 py-2.5 text-center"
                        style={{ borderColor: color }}
                      >
                        <p className="font-semibold text-zinc-900 truncate">{seg.label}</p>
                      </div>
                      <div
                        className="shrink-0 w-24 rounded-2xl px-3 py-2.5 text-center"
                        style={{ background: color }}
                      >
                        <p className="font-semibold text-zinc-900 whitespace-nowrap">
                          {formatBaht(seg.amount)} บาท
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
