"use client";

// "เป้าหมายของฉัน" — เป้าหมายรายเดือนที่ผู้ใช้ตั้งเอง ต่างจาก "ภารกิจวันนี้" ที่ระบบแจกให้รายวัน
// (ดู TASK_D_GOALS.md) เลือกได้แค่ 2 แบบที่วัดผลได้ (บาท/ชิ้น) ห้ามพิมพ์เป้าหมายเป็นข้อความอิสระ —
// ยอดที่ใช้ไปแล้วทั้งหมดมาจาก /api/goals ซึ่งเรียก wasteStats ตัวเดิม (ไม่มีสูตรคิดเงินใหม่ที่นี่เลย)
import { useEffect, useState } from "react";

const METRIC_LABEL = { baht: "บาท", count: "ชิ้น" };

function roundSuggestion(value, metric) {
  // ปัดเป็นหลักสิบสำหรับบาท (ตัวเลขหลักร้อย ปัดหลักสิบอ่านง่ายกว่า) ส่วนจำนวนชิ้นมักเป็นเลขหลักเดียว
  // ปัดเป็นหลักสิบจะได้ 0 ไม่มีประโยชน์ เลยปัดเป็นจำนวนเต็มแทน (อย่างน้อย 1)
  if (metric === "count") return Math.max(1, Math.round(value));
  return Math.max(10, Math.round(value / 10) * 10);
}

function daysInfo(startDate, endDate) {
  const today = new Date(new Date().toDateString());
  const start = new Date(startDate);
  const end = new Date(endDate);
  const daysInMonth = Math.round((end - start) / 86400000) + 1;
  const daysElapsed = Math.min(daysInMonth, Math.max(1, Math.round((today - start) / 86400000) + 1));
  return { daysElapsed, daysInMonth };
}

// สถานะไฟ — เทียบ "% งบที่ใช้ไป" กับ "% ของเดือนที่ผ่านไป" (หัวใจของ D3) บอกได้ตั้งแต่กลางเดือนว่า
// จะทันหรือไม่ทัน ไม่ต้องรอสิ้นเดือน — แถบเต็ม = แย่ ไม่ใช่ดี (แถบคือ "ใช้ไปเท่าไหร่" ไม่ใช่ความสำเร็จ)
function getStatus(usedSoFar, targetValue, daysElapsed, daysInMonth) {
  if (usedSoFar >= targetValue) {
    return { color: "#27272a", emoji: "⚫️", text: "เกินเป้าแล้ว" };
  }
  const percentUsed = (usedSoFar / targetValue) * 100;
  const percentOfMonth = (daysElapsed / daysInMonth) * 100;
  const speedRatio = percentUsed / Math.max(percentOfMonth, 1);
  if (speedRatio <= 1) return { color: "#16a34a", emoji: "🟢", text: "ตามเป้าอยู่" };
  if (speedRatio < 1.2) return { color: "#ca8a04", emoji: "🟡", text: "เร็วไปนิดนึง" };
  return { color: "#dc2626", emoji: "🔴", text: "ใช้งบเร็วกว่าที่ควร" };
}

// สรุปสิ้นเดือน (D4) — เกินเป้าเมื่อไหร่ต้องหาความจริงด้านบวกมาพูดคู่กันเสมอ ห้ามใช้คำตำหนิ
function endOfMonthMessage(prev) {
  const unit = METRIC_LABEL[prev.metric];
  if (prev.actual <= prev.targetValue) {
    const saved = prev.targetValue - prev.actual;
    return `เดือนที่แล้ว: ทิ้งไป ${prev.actual} จาก ${prev.targetValue} ${unit} — ประหยัดไปได้ ${saved} ${unit} 🎉`;
  }
  const over = prev.actual - prev.targetValue;
  return `เดือนที่แล้ว: ทิ้งไป ${prev.actual} เกินเป้า ${over} ${unit} — เดือนนี้ลองตั้งเป้าใหม่กันนะ`;
}

function GoalForm({ initialMetric, initialTargetValue, lastMonth, onSaved, onCancel }) {
  const [metric, setMetric] = useState(initialMetric || "baht");
  const [value, setValue] = useState(initialTargetValue ? String(initialTargetValue) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const lastMonthForMetric = lastMonth[metric];
  const hasHistory = lastMonthForMetric > 0;
  const suggestions = hasHistory
    ? [0.9, 0.8, 0.7].map((f) => roundSuggestion(lastMonthForMetric * f, metric))
    : [];
  const suggestionLabels = ["ง่าย", "กำลังดี", "ท้าทาย"];

  function pickMetric(next) {
    setMetric(next);
    setValue(""); // เปลี่ยนหน่วยแล้วเลขเดิมไม่มีความหมาย ให้เลือก/กรอกใหม่
  }

  async function handleSave() {
    setError(null);
    const targetValue = Number(value);
    if (!Number.isFinite(targetValue) || targetValue <= 0) {
      setError("กรอกตัวเลขที่มากกว่า 0 ก่อนนะ");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metric, targetValue }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      onSaved(data.goal);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white dark:bg-zinc-800 shadow-sm p-4 flex flex-col gap-3 mb-5">
      <p className="font-semibold text-zinc-900 dark:text-zinc-50">ตั้งเป้าหมายเดือนนี้</p>

      <div className="flex flex-col gap-2">
        {[
          { value: "baht", label: "บาท" },
          { value: "count", label: "ชิ้น" },
        ].map((opt) => (
          <label
            key={opt.value}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 cursor-pointer ${
              metric === opt.value
                ? "border-rose-400 bg-rose-50 dark:bg-rose-950/30"
                : "border-zinc-200 dark:border-zinc-700"
            }`}
          >
            <input
              type="radio"
              name="goal-metric"
              checked={metric === opt.value}
              onChange={() => pickMetric(opt.value)}
              className="accent-rose-500"
            />
            <span className="text-sm text-zinc-700 dark:text-zinc-300">ทิ้งไม่เกิน</span>
            {metric === opt.value ? (
              <input
                type="number"
                min="1"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-20 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-sm text-center"
              />
            ) : (
              <span className="w-20 text-center text-sm text-zinc-400">···</span>
            )}
            <span className="text-sm text-zinc-700 dark:text-zinc-300">{opt.label} ต่อเดือน</span>
          </label>
        ))}
      </div>

      {hasHistory ? (
        <div>
          <p className="text-xs text-zinc-400 mb-1.5">
            เดือนที่แล้วคุณทิ้งไป {lastMonthForMetric} {METRIC_LABEL[metric]}
          </p>
          <div className="flex gap-2">
            {suggestions.map((s, i) => (
              <button
                type="button"
                key={s}
                onClick={() => setValue(String(s))}
                className={`flex-1 flex flex-col items-center gap-0.5 rounded-xl border py-1.5 text-sm font-medium ${
                  value === String(s)
                    ? "border-rose-400 bg-rose-50 text-rose-600 dark:bg-rose-950/30"
                    : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300"
                }`}
              >
                {s}
                <span className="text-[10px] font-normal text-zinc-400">{suggestionLabels[i]}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-zinc-400">ยังไม่มีข้อมูลเดือนที่แล้วให้เทียบ ใส่ตัวเลขที่ต้องการเองได้เลย</p>
      )}

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="flex gap-2 mt-1">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="flex-1 rounded-full border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-300 disabled:opacity-50 py-2 text-sm font-medium"
          >
            ยกเลิก
          </button>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex-1 rounded-full bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white py-2 text-sm font-medium"
        >
          {saving ? "กำลังบันทึก..." : "บันทึกเป้าหมาย"}
        </button>
      </div>
    </div>
  );
}

export default function GoalCard() {
  const [data, setData] = useState(null); // null = กำลังโหลด
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/goals");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "โหลดเป้าหมายไม่สำเร็จ");
      setData(json);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (error) return null; // ไม่ทำให้ทั้งหน้าพัง — หน้า missions มีการ์ดอื่นที่สำคัญกว่าอยู่แล้ว
  if (data === null) return null; // กำลังโหลด — เงียบไว้ ไม่ต้อง skeleton เพราะเร็ว (query ธรรมดา)

  function handleSaved() {
    setEditing(false);
    load();
  }

  if (editing || !data.goal) {
    return (
      <div className="mb-5">
        <p className="font-semibold text-zinc-800 dark:text-zinc-100 mb-2">🎯 เป้าหมายของฉัน</p>
        {!editing && data.previousGoal && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
            {endOfMonthMessage(data.previousGoal)}
          </p>
        )}
        {editing ? (
          <GoalForm
            initialMetric={data.goal?.metric}
            initialTargetValue={data.goal?.targetValue}
            lastMonth={data.lastMonth}
            onSaved={handleSaved}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="w-full rounded-2xl border-2 border-dashed border-rose-200 dark:border-rose-900 text-rose-500 py-4 text-sm font-medium"
          >
            + ตั้งเป้าหมายเดือนนี้
          </button>
        )}
      </div>
    );
  }

  const { goal, usedSoFar } = data;
  const { daysElapsed, daysInMonth } = daysInfo(goal.startDate, goal.endDate);
  const status = getStatus(usedSoFar, goal.targetValue, daysElapsed, daysInMonth);
  const percent = Math.min(100, Math.round((usedSoFar / goal.targetValue) * 100));
  const percentOfMonth = Math.round((daysElapsed / daysInMonth) * 100);
  const remaining = Math.max(0, goal.targetValue - usedSoFar);
  const unit = METRIC_LABEL[goal.metric];
  const monthLabel = new Date(goal.startDate).toLocaleDateString("th-TH", { month: "long" });

  return (
    <div className="mb-5">
      <p className="font-semibold text-zinc-800 dark:text-zinc-100 mb-2">🎯 เป้าหมายของฉัน</p>
      <div className="rounded-2xl bg-white dark:bg-zinc-800 shadow-sm p-4 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
            เป้าหมายเดือน{monthLabel}
          </p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs text-rose-500 hover:underline shrink-0"
          >
            แก้ไข
          </button>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          ทิ้งได้ไม่เกิน {goal.targetValue} {unit}
        </p>

        {/* แถบต้องไม่ทำให้เข้าใจผิด — แถบเต็ม = แย่ ไม่ใช่ดี เลยใช้สีตามสถานะ ไม่ใช่เขียวเสมอ */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2.5 rounded-full bg-zinc-100 dark:bg-zinc-700 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${percent}%`, background: status.color }}
            />
          </div>
          <span className="text-xs text-zinc-500 dark:text-zinc-400 shrink-0">
            {Math.round(usedSoFar * 100) / 100} / {goal.targetValue}
          </span>
        </div>

        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          เหลืองบอีก {Math.round(remaining * 100) / 100} {unit}
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {status.emoji} ผ่านไป {percentOfMonth}% ของเดือน
          <br />
          ใช้งบไป {Math.round((usedSoFar / goal.targetValue) * 100)}% — {status.text}
        </p>
      </div>
    </div>
  );
}
