import Link from "next/link";
import { getDashboardData, getExpiredUnresolvedItems, daysUntil } from "@/lib/server/dashboard";
import { formatExpiryDateBE } from "@/lib/shared/dateFormat";
import { UserIcon, MoreHorizontalIcon, ChevronRightIcon, ChefHatIcon } from "@/components/icons";
import ResolveExpiredPopup from "@/components/ResolveExpiredPopup";
import AddToHomeScreenPrompt from "@/components/AddToHomeScreenPrompt";
import { getCurrentUserId } from "@/lib/server/currentUser";
import { getGoalForMonth, getUsedAmount } from "@/lib/server/goals";
import { getTreeProgress } from "@/lib/server/missions";
import { currentMonthStr } from "@/lib/shared/monthUtils";

// บังคับ dynamic rendering เสมอ (ดู TASK_E_AUTH.md E3) — หน้านี้อ่านข้อมูล user คนเดียว ถ้าโดน static
// render แล้ว cache ไว้ ข้อมูลของ anonymous user คนหนึ่งจะไปโผล่ที่ user อีกคนได้ (Supabase เตือนเรื่องนี้
// ตรงๆ) พลาดไม่ได้เด็ดขาดเพราะเป็นข้อมูลรั่วของคนอื่นมาให้เราเห็น
export const dynamic = "force-dynamic";

// สี/องค์ประกอบของหน้านี้อ้างอิงดีไซน์ Figma (node 2:5) โดยตรง — ใช้ hex ตรงตามดีไซน์
// แทน Tailwind palette ปกติของแอป เพราะเป็นสีเฉพาะของหน้า Home หน้านี้เท่านั้น

const METRIC_LABEL = { baht: "บาท", count: "ชิ้น" };

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

// สถานะไฟของเป้าหมาย — สูตรเดียวกับ src/components/GoalCard.js (getStatus) เป๊ะๆ เพื่อให้การ์ดในหน้า
// Home กับหน้า /missions ตีความ % เดียวกันแล้วให้สีตรงกันเสมอ ไม่มีสูตรใหม่ที่นี่
function goalBarColor(usedSoFar, targetValue, startDate, endDate) {
  if (usedSoFar >= targetValue) return "#27272a"; // เกินเป้าแล้ว
  const today = new Date(new Date().toDateString());
  const start = new Date(startDate);
  const end = new Date(endDate);
  const daysInMonth = Math.round((end - start) / 86400000) + 1;
  const daysElapsed = Math.min(daysInMonth, Math.max(1, Math.round((today - start) / 86400000) + 1));
  const percentUsed = (usedSoFar / targetValue) * 100;
  const percentOfMonth = (daysElapsed / daysInMonth) * 100;
  const speedRatio = percentUsed / Math.max(percentOfMonth, 1);
  if (speedRatio <= 1) return "#16a34a"; // ตามเป้าอยู่
  if (speedRatio < 1.2) return "#ca8a04"; // เร็วไปนิดนึง
  return "#dc2626"; // ใช้งบเร็วกว่าที่ควร
}

// คงเหลือ 1 ชิ้น → ข้ามหน้ากลาง (/items/[name]) ไปหน้าแก้ไขของชิ้นนั้นตรงๆ เพราะ 22 จาก 24 แถวตอนนี้
// เป็นของชิ้นเดียว บังคับผ่านหน้ากลางที่มีบรรทัดเดียวทุกครั้งจะน่ารำคาญมาก (ดู B1 ใน TASK_B_UI.md)
function groupHref(g) {
  return g.remaining > 1 ? `/items/${encodeURIComponent(g.name)}` : `/add-item?id=${g.soleItemId}`;
}

// ขอบกระดาษซ้อนรางๆ ข้างหลัง เฉพาะกลุ่มที่คงเหลือ > 1 ชิ้น — pseudo-element ล้วน (ไม่มี DOM ซ้ำ)
// ซ้อนแค่ 2 ชั้นเสมอไม่ว่าจะมีกี่ชิ้น (รวมการ์ดจริงเป็น 3 ชั้น) เยื้อง 3-4px + เอียงเล็กน้อยตามสเปก
const STACK_CLASSES =
  "before:content-[''] before:absolute before:inset-0 before:-z-10 before:rounded-2xl " +
  "before:bg-white/60 dark:before:bg-zinc-700/60 before:translate-x-1 before:translate-y-1 before:-rotate-1 " +
  "after:content-[''] after:absolute after:inset-0 after:-z-20 after:rounded-2xl " +
  "after:bg-white/35 dark:after:bg-zinc-700/35 after:translate-x-[7px] after:translate-y-[7px] after:rotate-1";

// ตอนเพิ่งเปิดแอปครั้งแรกสุด (ยังไม่มี session cookie เลย) getCurrentUserId() จะได้ null ก่อนที่
// signInAnonymously() ฝั่ง client (ดู src/components/AnonymousAuthBoot.js, E7) จะทำงานเสร็จแล้ว
// reload หน้า — ต้องโชว์ skeleton ตรงนี้ระหว่างรอ ห้ามเป็นหน้าขาว (E7 ข้อสำคัญ)
function HomeSkeleton() {
  return (
    <div className="bg-[#fffcf8] dark:bg-zinc-900 min-h-full pb-28 animate-pulse">
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="w-11 h-11 rounded-full bg-zinc-200 dark:bg-zinc-800 shrink-0" />
          <span className="w-24 h-5 rounded bg-zinc-200 dark:bg-zinc-800" />
        </div>
      </div>
      <div className="px-4 flex flex-col gap-4">
        <div className="w-40 h-5 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-20 rounded-2xl bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-20 rounded-2xl bg-zinc-100 dark:bg-zinc-800" />
      </div>
    </div>
  );
}

export default async function Home() {
  const userId = await getCurrentUserId();
  if (!userId) return <HomeSkeleton />;

  let nearExpiry = [];
  let others = [];
  let totalItemCount = 0;
  let expiredUnresolved = [];
  let dbError = null;
  let goal = null; // เป้าหมายเดือนนี้ (จาก "เป้าหมายของฉัน" ที่ user ตั้งเอง — ดู src/lib/server/goals.js)
  let goalUsedSoFar = 0;
  let waterDrops = 0; // สะสมจากภารกิจรายวัน (ดู src/lib/server/missions.js)
  try {
    ({ nearExpiry, others, totalItemCount } = await getDashboardData(userId));
    expiredUnresolved = await getExpiredUnresolvedItems(userId);

    // การ์ด "ภารกิจ" ในหน้านี้เคยเป็น static mock ("FoodWaste ต่ำกว่า 200 บาท..." ตัวเลขคงที่) — ตอนนี้
    // ต่อกับข้อมูลจริง 2 แหล่ง: เป้าหมายรายเดือนที่ user ตั้งเอง (ถ้ายังไม่ได้ตั้ง goal จะเป็น null —
    // การ์ดจะชวนไปตั้งแทนที่จะโชว์เลขปลอม) และจำนวนหยดน้ำสะสมจากต้นไม้/ภารกิจรายวัน
    const monthStr = currentMonthStr();
    const goalRow = await getGoalForMonth(userId, monthStr);
    if (goalRow) {
      goal = {
        metric: goalRow.metric,
        targetValue: Number(goalRow.target_value),
        startDate: goalRow.start_date,
        endDate: goalRow.end_date,
      };
      goalUsedSoFar = await getUsedAmount(userId, monthStr, goalRow.metric);
    }
    const tree = await getTreeProgress(userId);
    waterDrops = tree.water_drops;
  } catch (err) {
    dbError = err.message;
  }

  return (
    <div className="bg-[#fffcf8] dark:bg-zinc-900 min-h-full pb-28">
      {!dbError && <ResolveExpiredPopup items={expiredUnresolved} />}

      {/* Header: อวตาร + คำทักทาย + เมนู "..." พาไปหน้าตั้งค่า (ดู TASK_E_AUTH.md E9 — เดิม disabled
          ไว้เฉยๆ ตอนนี้ต้องมีทางเข้าหน้าที่บอกความจริงเรื่องข้อมูลเก็บที่ไหนแล้ว) */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="w-11 h-11 rounded-full bg-rose-100 dark:bg-rose-950/40 flex items-center justify-center shrink-0">
            <UserIcon className="w-6 h-6 text-rose-500" />
          </span>
          <span className="font-semibold text-lg text-zinc-900 dark:text-zinc-50">สวัสดี 👋</span>
        </div>
        <Link
          href="/settings"
          aria-label="ตั้งค่า"
          className="w-8 h-8 flex items-center justify-center text-zinc-400"
        >
          <MoreHorizontalIcon className="w-5 h-5" />
        </Link>
      </div>

      {!dbError && <AddToHomeScreenPrompt itemCount={totalItemCount} />}

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
                {nearExpiry.map((g) => {
                  const d = daysUntil(g.earliestExpiry);
                  return (
                    <Link
                      key={g.name}
                      href={groupHref(g)}
                      className={`relative flex items-center justify-between gap-3 rounded-2xl bg-[#fbfdff] dark:bg-zinc-800 px-4 py-2.5 ${
                        g.remaining > 1 ? STACK_CLASSES : ""
                      }`}
                    >
                      <p className="font-semibold text-zinc-900 dark:text-zinc-50 truncate min-w-0">
                        {g.name}
                        {g.remaining > 1 && <span className="text-zinc-400 font-normal"> ×{g.remaining}</span>}
                      </p>
                      <div className="shrink-0 rounded-2xl bg-[#c77984] text-white text-center px-3 py-1.5 min-w-[78px]">
                        <p className="text-sm font-semibold leading-tight whitespace-nowrap">{daysLabel(d)}</p>
                        <p className="text-[10px] leading-tight opacity-90 whitespace-nowrap">
                          EXP {formatExpiryDateBE(g.earliestExpiry)}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl bg-[#edc5ca] dark:brightness-[0.4] px-4 py-3 text-sm text-[#7a3540] dark:text-rose-200 mb-4">
                ยังไม่มีของใกล้หมดอายุใน 3 วันนี้ 🎉
              </div>
            )}

            {/* ภารกิจลด FoodWaste (การ์ดซ้าย) พาไปหน้า /missions จริง (ภารกิจ 5 แบบ + ต้นไม้ ทำเสร็จแล้ว)
                ตอนนี้ต่อกับข้อมูลจริงแล้ว: ถ้าตั้ง "เป้าหมายของฉัน" ไว้ (src/components/GoalCard.js)
                โชว์ % ที่ใช้ไปจริง + สีสถานะตรงกับหน้า /missions เป๊ะๆ, ถ้ายังไม่ได้ตั้งชวนไปตั้งแทน —
                ทั้งสองแบบโชว์จำนวนหยดน้ำสะสมจากภารกิจรายวันด้วยเสมอ (independent จาก goal) —
                แนะนำเมนู (การ์ดขวา) พาไปหน้า /recipes จริงแล้ว (ฟีเจอร์พรีเมียม เปิดฟรีในเดโม
                ดู RECIPE_TASK.md) */}
            <div className="flex gap-2 mb-4">
              <Link
                href="/missions"
                className="flex-[1.6] rounded-2xl bg-[#bade97] dark:brightness-[0.4] p-4 flex flex-col justify-between h-[84px]"
              >
                {goal ? (
                  <>
                    <p className="text-sm font-semibold text-black dark:text-zinc-50 truncate">
                      ทิ้งไม่เกิน {goal.targetValue} {METRIC_LABEL[goal.metric]}เดือนนี้
                    </p>
                    <div className="h-2.5 rounded-full bg-[#eafad0]/70 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, Math.round((goalUsedSoFar / goal.targetValue) * 100))}%`,
                          background: goalBarColor(goalUsedSoFar, goal.targetValue, goal.startDate, goal.endDate),
                        }}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-black dark:text-zinc-50">ยังไม่ได้ตั้งเป้าหมาย</p>
                    <p className="text-xs text-[#3f5c2a] dark:text-zinc-300">แตะเพื่อตั้งเป้าลด FoodWaste เดือนนี้</p>
                  </>
                )}
                <p className="text-[10px] text-[#3f5c2a] dark:text-zinc-400 mt-0.5">💧 {waterDrops} หยดสะสม</p>
              </Link>
              <Link
                href="/recipes"
                className="flex-1 rounded-2xl bg-[#fcdd9d] dark:brightness-[0.4] p-3 flex flex-col items-center justify-center gap-1.5 h-[84px]"
              >
                <span className="w-10 h-10 rounded-full bg-[#fff3d9] flex items-center justify-center">
                  <ChefHatIcon className="w-5 h-5 text-[#4b3535]" />
                </span>
                <p className="text-xs font-semibold text-[#4b3535] text-center leading-tight">
                  แนะนำเมนูอาหาร
                </p>
              </Link>
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
                {others.map((g) => {
                  const ratio = stockRatio(g.remaining);
                  return (
                    <Link
                      key={g.name}
                      href={groupHref(g)}
                      className={`relative rounded-2xl bg-[#fbfdff] dark:bg-zinc-800 px-4 py-3 flex items-center justify-between gap-3 ${
                        g.remaining > 1 ? STACK_CLASSES : ""
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-zinc-900 dark:text-zinc-50 truncate">{g.name}</p>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                          EXP {formatExpiryDateBE(g.earliestExpiry)}
                        </p>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-1.5 w-24">
                        <p className="font-semibold text-zinc-900 dark:text-zinc-50 whitespace-nowrap">
                          {g.remaining} ชิ้น
                        </p>
                        <div className="w-full h-2 rounded-full bg-[#e3f2ff] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#8ec5f5]"
                            style={{ width: `${ratio * 100}%` }}
                          />
                        </div>
                      </div>
                    </Link>
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
