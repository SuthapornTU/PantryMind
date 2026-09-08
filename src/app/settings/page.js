// หน้าตั้งค่า/โปรไฟล์ — ต้องบอกความจริงกับผู้ใช้ตรงๆ ว่าข้อมูลเก็บที่ไหน (ดู TASK_E_AUTH.md E9)
// ห้ามปล่อยให้ผู้ใช้เข้าใจว่าข้อมูลปลอดภัยกว่าความจริง — ตอนนี้เป็น anonymous account ผูกกับเบราว์เซอร์
// เครื่องนี้เท่านั้น (ยังไม่มี Google/เบอร์โทร/อีเมล ตามที่ TASK_E_AUTH.md บอกว่าเป็นเฟสถัดไป)
import Link from "next/link";
import { ChevronRightIcon } from "@/components/icons";

export default function SettingsPage() {
  return (
    <div className="pb-28">
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <Link
          href="/"
          aria-label="กลับ"
          className="w-8 h-8 rounded-full flex items-center justify-center rotate-180 text-zinc-500"
        >
          <ChevronRightIcon className="w-5 h-5" />
        </Link>
        <h1 className="font-semibold text-zinc-900 dark:text-zinc-50">ตั้งค่า</h1>
      </div>

      <div className="px-4">
        <div className="rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm text-amber-900 dark:text-amber-200 flex flex-col gap-2">
          <p className="font-medium">เกี่ยวกับบัญชีของคุณ</p>
          <p>ตอนนี้ข้อมูลของคุณเก็บไว้ในเครื่องนี้เท่านั้น</p>
          <p>ถ้าล้างข้อมูลเบราว์เซอร์หรือเปลี่ยนเครื่อง ข้อมูลจะหาย</p>
          <p className="opacity-80">(เร็วๆ นี้จะมีให้ผูกบัญชีเพื่อเก็บถาวร)</p>
        </div>

        <p className="text-xs text-zinc-400 mt-4">
          แนะนำให้เพิ่ม PantryMind ลงหน้าจอโฮมของเครื่อง เพื่อลดโอกาสที่ข้อมูลจะถูกลบโดยเบราว์เซอร์
        </p>
      </div>
    </div>
  );
}
