import Link from "next/link";
import { getDashboardData, daysUntil } from "@/lib/server/dashboard";
import { formatExpiryDateBE } from "@/lib/shared/dateFormat";
import { UserIcon, MoreHorizontalIcon, ChevronRightIcon, ChefHatIcon } from "@/components/icons";

// สี/องค์ประกอบของหน้านี้อ้างอิงดีไซน์ Figma (node 2:5) โดยตรง — ใช้ hex ตรงตามดีไซน์
// แทน Tailwind palette ปกติของแอป เพราะเป็นสีเฉพาะของหน้า Home หน้านี้เท่านั้น

function daysLabel(d) {
  if (d < 0) return `เลยมา ${-d} วัน`;
  if (d === 0) return "หมดอายุวันนี้";
  if (d === 1) return "หมดอายุพรุ่งนี้";
  return `เหลือ ${d} วัน`;
}

// ความยาวแถบระดับของ (decorative) — เทียบสัดส่วนจำนวนกับเกณฑ์ 6 ชิ้นเป็นแถบเต็ม
// ไม่ได้อิงจำนวนสูงสุดจริงที่เคยมี เพราะยังไม่มีข้อมูลนั้นเก็บไว้
function stockRatio(quantity) {
  return Math.max(0.15, Math.min(quantity / 6, 1));
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
    <div className="bg-[#fffcf8] dark:bg-zinc-900 min-h-full pb-28">
      {/* Header: อวตาร + คำทักทาย + เมนู "..." (ยังไม่ implement) */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="w-11 h-11 rounded-full bg-rose-100 dark:bg-rose-950/40 flex items-center justify-center shrink-0">
            <UserIcon className="w-6 h-6 text-rose-500" />
          </span>
          <span className="font-semibold text-lg text-zinc-900 dark:text-zinc-50">สวัสดี 👋</span>
        </div>
        <button
          type="button"
          title="เร็วๆ นี้"
          className="w-8 h-8 flex items-center justify-center text-zinc-400 opacity-50 cursor-not-allowed"
        >
          <MoreHorizontalIcon className="w-5 h-5" />
        </button>
      </div>

      <div className="px-4">
        {dbError ? (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-4 text-sm text-amber-900 dark:text-amber-200">
            <p className="font-medium mb-1">ยังต่อฐานข้อมูลไม่ได้</p>
            <p className="text-xs opacity-70">{dbError}</p>
          </div>
        ) : (
          <>
            {/* อาหารใกล้หมดอายุ */}
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-xl text-zinc-900 dark:text-zinc-50 tracking-tight">
                อาหารใกล้หมดอายุ
              </span>
              <Link href="/items" className="text-zinc-400 hover:text-rose-500">
                <ChevronRightIcon className="w-5 h-5" />
              </Link>
            </div>

            {nearExpiry.length > 0 ? (
              <div className="rounded-2xl bg-[#edc5ca] dark:brightness-[0.4] p-3 flex flex-col gap-2 mb-4">
                {nearExpiry.map((item) => {
                  const d = daysUntil(item.expiry_date);
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-2xl bg-[#fbfdff] dark:bg-zinc-800 px-4 py-2.5"
                    >
                      <p className="font-semibold text-zinc-900 dark:text-zinc-50 truncate min-w-0">
                        {item.name}
                      </p>
                      <div className="shrink-0 rounded-2xl bg-[#c77984] text-white text-center px-3 py-1.5 min-w-[78px]">
                        <p className="text-sm font-semibold leading-tight whitespace-nowrap">{daysLabel(d)}</p>
                        <p className="text-[10px] leading-tight opacity-90 whitespace-nowrap">
                          EXP {formatExpiryDateBE(item.expiry_date)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl bg-[#edc5ca] dark:brightness-[0.4] px-4 py-3 text-sm text-[#7a3540] dark:text-rose-200 mb-4">
                ยังไม่มีของใกล้หมดอายุใน 3 วันนี้ 🎉
              </div>
            )}

            {/* ภารกิจลด FoodWaste + แนะนำเมนู (UI ตามดีไซน์ — ยังเป็นข้อมูล static รอฟีเจอร์จริง) */}
            <div className="flex gap-2 mb-4">
              <div className="flex-[1.6] rounded-2xl bg-[#bade97] dark:brightness-[0.4] p-4 flex flex-col justify-between h-[84px]">
                <p className="text-sm font-semibold text-black dark:text-zinc-50">
                  FoodWaste ต่ำกว่า 200 บาท...
                </p>
                <div className="h-2.5 rounded-full bg-[#eafad0]/70 overflow-hidden">
                  <div className="h-full rounded-full bg-[#a3c98a]" style={{ width: "45%" }} />
                </div>
              </div>
              <div className="flex-1 rounded-2xl bg-[#fcdd9d] dark:brightness-[0.4] p-3 flex flex-col items-center justify-center gap-1.5 h-[84px]">
                <span className="w-10 h-10 rounded-full bg-[#fff3d9] flex items-center justify-center">
                  <ChefHatIcon className="w-5 h-5 text-[#4b3535]" />
                </span>
                <p className="text-xs font-semibold text-[#4b3535] text-center leading-tight">
                  แนะนำเมนูอาหาร
                </p>
              </div>
            </div>

            {/* รายการอาหารทั้งหมด */}
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-xl text-zinc-900 dark:text-zinc-50 tracking-tight">
                รายการอาหารทั้งหมด
              </span>
              <Link href="/items" className="text-zinc-400 hover:text-rose-500">
                <ChevronRightIcon className="w-5 h-5" />
              </Link>
            </div>

            {others.length === 0 && nearExpiry.length === 0 ? (
              <p className="text-sm text-zinc-400 mb-5">
                ยังไม่มีของในตู้เลย{" "}
                <Link href="/add-item" className="text-rose-500 hover:underline">
                  เริ่มเพิ่มของแรก
                </Link>
              </p>
            ) : others.length === 0 ? (
              <p className="text-sm text-zinc-400 mb-5">
                ของที่เหลือทั้งหมดอยู่ในรายการใกล้หมดอายุด้านบนแล้ว
              </p>
            ) : (
              <div className="rounded-2xl bg-[#dceefe] dark:brightness-[0.4] p-3 flex flex-col gap-2 mb-5">
                {others.map((item) => {
                  const ratio = stockRatio(item.quantity);
                  return (
                    <div
                      key={item.id}
                      className="rounded-2xl bg-[#fbfdff] dark:bg-zinc-800 px-4 py-3 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-zinc-900 dark:text-zinc-50 truncate">{item.name}</p>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                          EXP {formatExpiryDateBE(item.expiry_date)}
                        </p>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-1.5 w-24">
                        <p className="font-semibold text-zinc-900 dark:text-zinc-50 whitespace-nowrap">
                          {item.quantity} ชิ้น
                        </p>
                        <div className="w-full h-2 rounded-full bg-[#e3f2ff] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#8ec5f5]"
                            style={{ width: `${ratio * 100}%` }}
                          />
                        </div>
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
