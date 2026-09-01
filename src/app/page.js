import Link from "next/link";
import { query } from "@/lib/db";
import { DEMO_USER_ID } from "@/lib/demoUser";
import { LeafIcon, UserIcon, ChevronRightIcon } from "@/components/icons";

function daysUntil(dateStr) {
  const diff = new Date(dateStr) - new Date(new Date().toDateString());
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

function daysLabel(d) {
  if (d < 0) return `เลยมา ${-d} วัน`;
  if (d === 0) return "หมดอายุวันนี้";
  if (d === 1) return "หมดอายุพรุ่งนี้";
  return `อีก ${d} วัน`;
}

async function getDashboardData() {
  const result = await query(
    `SELECT id, name, category, storage_location, expiry_date, quantity
     FROM pantry_items
     WHERE user_id = $1 AND used_at IS NULL
     ORDER BY expiry_date ASC
     LIMIT 12`,
    [DEMO_USER_ID]
  );
  const all = result.rows;
  const nearExpiry = all.filter((item) => daysUntil(item.expiry_date) <= 3);
  const nearExpiryIds = new Set(nearExpiry.map((i) => i.id));
  const others = all.filter((item) => !nearExpiryIds.has(item.id)).slice(0, 6);
  return { nearExpiry, others };
}

export default async function Home() {
  let nearExpiry = [];
  let others = [];
  let dbError = null;
  try {
    ({ nearExpiry, others } = await getDashboardData());
  } catch (err) {
    dbError = err.message;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center">
            <LeafIcon className="w-5 h-5 text-rose-500" />
          </span>
          <span className="font-semibold text-zinc-900 dark:text-zinc-50">PantryMind</span>
        </div>
        <span className="w-9 h-9 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center">
          <UserIcon className="w-5 h-5 text-zinc-500" />
        </span>
      </div>

      <div className="px-4">
        {dbError ? (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-4 text-sm text-amber-900 dark:text-amber-200">
            <p className="font-medium mb-1">ยังต่อฐานข้อมูลไม่ได้</p>
            <p className="text-xs opacity-70">{dbError}</p>
          </div>
        ) : (
          <>
            {/* รายการใกล้หมดอายุ */}
            {nearExpiry.length > 0 ? (
              <>
                <div className="rounded-2xl bg-rose-500 text-white px-4 py-3 flex items-center justify-between mb-2">
                  <span className="font-medium">รายการใกล้หมดอายุ</span>
                  <span className="flex items-center gap-1">
                    <span className="bg-white/25 rounded-full px-2 py-0.5 text-sm font-semibold">
                      {nearExpiry.length}
                    </span>
                    <ChevronRightIcon className="w-4 h-4" />
                  </span>
                </div>
                <ul className="flex flex-col gap-2 mb-5">
                  {nearExpiry.map((item) => {
                    const d = daysUntil(item.expiry_date);
                    const urgent = d <= 1;
                    return (
                      <li
                        key={item.id}
                        className="flex items-center justify-between gap-3 rounded-xl bg-white dark:bg-zinc-800 shadow-sm p-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              urgent ? "bg-rose-500" : "bg-amber-400"
                            }`}
                          />
                          <div className="min-w-0">
                            <p className="font-medium text-zinc-900 dark:text-zinc-50 truncate">
                              {item.name}
                            </p>
                            <p className="text-xs text-zinc-400">
                              {item.category} · มี {item.quantity} ชิ้น
                            </p>
                          </div>
                        </div>
                        <span
                          className={`shrink-0 text-xs font-medium rounded-full px-2 py-1 ${
                            urgent
                              ? "bg-rose-50 text-rose-600 dark:bg-rose-950/40"
                              : "bg-amber-50 text-amber-600 dark:bg-amber-950/40"
                          }`}
                        >
                          {daysLabel(d)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : (
              <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 px-4 py-3 text-sm mb-5">
                ยังไม่มีของใกล้หมดอายุใน 3 วันนี้ 🎉
              </div>
            )}

            {/* รายการปัจจุบัน */}
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-zinc-800 dark:text-zinc-100">รายการปัจจุบัน</span>
              <Link
                href="/items"
                className="flex items-center gap-0.5 text-sm text-zinc-400 hover:text-rose-500"
              >
                ดูทั้งหมด <ChevronRightIcon className="w-4 h-4" />
              </Link>
            </div>

            {others.length === 0 && nearExpiry.length === 0 ? (
              <p className="text-sm text-zinc-400">
                ยังไม่มีของในตู้เลย{" "}
                <Link href="/add-item" className="text-rose-500 hover:underline">
                  เริ่มเพิ่มของแรก
                </Link>
              </p>
            ) : others.length === 0 ? (
              <p className="text-sm text-zinc-400">ของที่เหลือทั้งหมดอยู่ในรายการใกล้หมดอายุด้านบนแล้ว</p>
            ) : (
              <ul className="grid grid-cols-2 gap-2 mb-5">
                {others.map((item) => {
                  const d = daysUntil(item.expiry_date);
                  return (
                    <li
                      key={item.id}
                      className="rounded-xl bg-white dark:bg-zinc-800 shadow-sm p-3 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-zinc-900 dark:text-zinc-50 truncate">
                          {item.name}
                        </p>
                        <p className="text-xs text-zinc-400">
                          {d >= 0 ? `เหลือ ${d} วัน` : daysLabel(d)}
                        </p>
                      </div>
                      <span className="shrink-0 w-7 h-7 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 flex items-center justify-center text-sm font-semibold">
                        {item.quantity}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* placeholder ภารกิจ+ต้นไม้+สถิติ (ยังไม่สร้าง — ลำดับ build ข้อ 3-7) */}
            <div className="rounded-2xl bg-pink-50 dark:bg-pink-950/20 p-4 text-sm text-pink-400 dark:text-pink-300/70">
              ภารกิจประจำวัน 🌱 ต้นไม้ และสถิติรายเดือน — เร็วๆ นี้
            </div>
          </>
        )}
      </div>
    </div>
  );
}
