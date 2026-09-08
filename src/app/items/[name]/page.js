"use client";

// หน้ากลุ่ม /items/[name] — ลิสต์ของชื่อเดียวกัน "ทีละชิ้น" ข้ามหลายแถว/หลายวันหมดอายุ (ดู B2 ใน
// TASK_B_UI.md) มาจากการ์ดซ้อนในหน้าแรกตอนกลุ่มมีคงเหลือ > 1 ชิ้น (คงเหลือ = 1 ข้ามหน้านี้ไปหน้า
// แก้ไขตรงๆ อยู่แล้ว — ดู groupHref ใน src/app/page.js)
// บังคับ dynamic rendering (ดู TASK_E_AUTH.md E3) — หน้าอ่านข้อมูล user คนเดียว ห้าม static cache
// (ไม่อยู่ใน 5 หน้าที่ E3 ระบุตรงๆ แต่เป็นหน้าคู่กันของ /items ที่โชว์ข้อมูลตู้เย็นเหมือนกัน เลยใส่ด้วย)
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRightIcon } from "@/components/icons";
import WasteResolveForm from "@/components/WasteResolveForm";

const PIECE_LIST_LIMIT = 12; // เกินนี้เปลี่ยนเป็นตัวนับแทน (ไข่ 30 ฟองต้องไม่วาด 30 บรรทัด)

function daysUntilExpiry(expiryDate) {
  const diff = new Date(expiryDate) - new Date(new Date().toDateString());
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

function daysLabel(expiryDate) {
  const d = daysUntilExpiry(expiryDate);
  if (d < 0) return `เลยมา ${-d} วัน`;
  if (d === 0) return "หมดอายุวันนี้";
  if (d === 1) return "หมดอายุพรุ่งนี้";
  if (d >= 30) return `เหลือ ${Math.round(d / 30)} เดือน`;
  return `เหลือ ${d} วัน`;
}

// กระจายแต่ละแถวเป็น "ทีละชิ้น" — ชิ้นในแถวเดียวกันใช้วันหมดอายุ/ราคาเดียวกันหมด มีแค่ชิ้นแรกของ
// แถวเท่านั้นที่โชว์ป้าย % ได้ (ถ้า open_fraction ไม่ null) เพราะ open_fraction เป็นค่าระดับแถว
// แทนสถานะ "ชิ้นที่กำลังเปิดใช้อยู่" ชิ้นเดียวต่อแถว (ดูนิยามใน TASK_A_DATA.md/TASK_B_UI.md)
function expandToPieces(rows) {
  const pieces = [];
  for (const row of rows) {
    const remaining = Math.round(row.remaining);
    for (let i = 0; i < remaining; i++) {
      pieces.push({
        key: `${row.id}-${i}`,
        rowId: row.id,
        row,
        expiryDate: row.expiry_date,
        openFraction: i === 0 ? row.open_fraction : null,
      });
    }
  }
  pieces.sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
  return pieces;
}

export default function GroupPage() {
  const params = useParams();
  const router = useRouter();
  const name = decodeURIComponent(params.name);

  const [rows, setRows] = useState(null); // null = กำลังโหลด
  const [error, setError] = useState(null);
  const [busyRowId, setBusyRowId] = useState(null);
  const [wasteRowId, setWasteRowId] = useState(null); // แถวที่กำลังเปิด WasteResolveForm อยู่

  async function load() {
    setError(null);
    try {
      const res = await fetch(`/api/items/group/${encodeURIComponent(name)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "โหลดรายการไม่สำเร็จ");
      setRows(data.rows);
      if (data.rows.length === 0) router.replace("/");
    } catch (err) {
      setError(err.message);
      setRows([]);
    }
  }

  useEffect(() => {
    load();
  }, [name]);

  async function consumeOne(rowId) {
    setBusyRowId(rowId);
    try {
      const res = await fetch(`/api/items/${rowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "consume_one" }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "บันทึกไม่สำเร็จ");
      await load();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusyRowId(null);
    }
  }

  // "เลือกทั้งหมดว่ากินแล้ว" = การกระทำเดียวกับปุ่ม "ใช้แล้ว" เดิม เรียกทุกแถวในกลุ่ม (logic เดิม
  // PATCH action:"used" ต่อแถว ไม่เขียนใหม่ — ดู B2 ใน TASK_B_UI.md)
  async function markAllUsed() {
    if (!confirm(`ยืนยันว่ากิน${name}ทั้งหมดหมดแล้วใช่ไหม?`)) return;
    setBusyRowId("__all__");
    try {
      await Promise.all(
        rows.map((row) =>
          fetch(`/api/items/${row.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "used" }),
          })
        )
      );
      router.push("/");
    } catch (err) {
      alert(err.message || "บันทึกไม่สำเร็จ");
    } finally {
      setBusyRowId(null);
    }
  }

  if (rows === null) {
    return <p className="text-zinc-400 text-sm px-4 pt-6">กำลังโหลด...</p>;
  }

  const totalRemaining = rows.reduce((sum, r) => sum + r.remaining, 0);
  const pieces = expandToPieces(rows);
  const wasteRow = rows.find((r) => r.id === wasteRowId) || null;

  // เกิน 12 ชิ้น → เปลี่ยนเป็นตัวนับ [−] N [+] แทนลิสต์ทีละชิ้น (ดู B2) − กด = consume_one ของแถวที่
  // หมดอายุเร็วสุดก่อนเสมอ (FIFO ตามลำดับที่แสดง) + ยังไม่รองรับ (ไม่มี endpoint ยกเลิก consume_one)
  const useCounterView = totalRemaining > PIECE_LIST_LIMIT;
  const earliestRowWithStock = [...rows].sort(
    (a, b) => new Date(a.expiry_date) - new Date(b.expiry_date)
  )[0];

  return (
    <div className="pb-28">
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <Link
          href="/"
          className="w-8 h-8 rounded-full flex items-center justify-center rotate-180 text-zinc-500"
        >
          <ChevronRightIcon className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-semibold text-zinc-900 dark:text-zinc-50">{name}</h1>
          <p className="text-xs text-zinc-400">มีอยู่ {totalRemaining} ชิ้น</p>
        </div>
      </div>

      <div className="px-4">
        {error && <p className="text-sm text-rose-600 mb-3">{error}</p>}

        <button
          type="button"
          onClick={markAllUsed}
          disabled={busyRowId === "__all__"}
          className="w-full mb-4 rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200 disabled:opacity-50 py-2.5 text-sm font-medium"
        >
          เลือกทั้งหมดว่ากินแล้ว
        </button>

        {useCounterView ? (
          <div className="rounded-2xl bg-white dark:bg-zinc-800 shadow-sm p-4 flex flex-col items-center gap-2">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => earliestRowWithStock && consumeOne(earliestRowWithStock.id)}
                disabled={busyRowId !== null}
                className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 hover:bg-rose-200 disabled:opacity-50 font-semibold text-lg"
              >
                −
              </button>
              <span className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 w-12 text-center">
                {totalRemaining}
              </span>
              <button
                type="button"
                disabled
                title="ยังไม่รองรับ"
                className="w-10 h-10 rounded-full bg-zinc-100 text-zinc-300 dark:bg-zinc-700 font-semibold text-lg cursor-not-allowed"
              >
                +
              </button>
            </div>
            <p className="text-xs text-zinc-400">{daysLabel(earliestRowWithStock.expiry_date)}ที่สุด</p>
          </div>
        ) : (
          <>
            <ul className="flex flex-col gap-2">
              {pieces.map((p) => {
                const hasOpenBadge = p.openFraction != null && Number(p.openFraction) > 0;
                return (
                  <li
                    key={p.key}
                    className="flex items-center gap-3 rounded-xl bg-white dark:bg-zinc-800 shadow-sm p-3"
                  >
                    <button
                      type="button"
                      onClick={() => router.push(`/add-item?id=${p.rowId}`)}
                      className="flex-1 min-w-0 flex items-center gap-2 text-left"
                    >
                      <span className="text-lg shrink-0">{hasOpenBadge ? "◐" : "☐"}</span>
                      <span className="min-w-0">
                        <span className="block font-medium text-zinc-900 dark:text-zinc-50 truncate">
                          {name}
                        </span>
                        <span className="text-xs text-zinc-400">{daysLabel(p.expiryDate)}</span>
                      </span>
                      {hasOpenBadge && (
                        <span className="text-[10px] font-medium text-amber-700 bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 rounded-full px-2 py-0.5 shrink-0">
                          เปิดแล้ว {Math.round(Number(p.openFraction) * 100)}%
                        </span>
                      )}
                    </button>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        type="button"
                        title="กินหมดแล้ว"
                        onClick={() => consumeOne(p.rowId)}
                        disabled={busyRowId !== null}
                        className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200 disabled:opacity-50 flex items-center justify-center"
                      >
                        ✓
                      </button>
                      <button
                        type="button"
                        title="ทิ้ง"
                        onClick={() => setWasteRowId(p.rowId)}
                        disabled={busyRowId !== null}
                        className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 hover:bg-rose-200 disabled:opacity-50 flex items-center justify-center"
                      >
                        🗑
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      {wasteRow && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-800 shadow-lg p-4 max-h-[90vh] overflow-y-auto">
            <WasteResolveForm
              item={wasteRow}
              onCancel={() => setWasteRowId(null)}
              onDone={async () => {
                setWasteRowId(null);
                await load();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
