"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HomeIcon, ChartIcon, CartIcon, GearIcon, PlusIcon } from "./icons";

// bottom tab bar สไตล์แอปมือถือ ตาม Figma mockup (home / สถิติ / + / ช้อปปิ้ง / ตั้งค่า) —
// ล็อกไว้ตรงกลางความกว้างระดับมือถือ/iPad เสมอ (ไม่ทำ layout สำหรับจอเดสก์ท็อป ตามที่ตกลงกันไว้)
// ในมockup ไม่มีแท็บแยกสำหรับ "รายการของทั้งหมด" — เข้าถึงผ่านลิงก์ "ดูทั้งหมด" ในหน้าแรกแทน
// (ตรงกับ docs หัวข้อ 1: หน้า Home = การ์ดของใกล้หมดอายุ, หน้ารายการปัจจุบันแยกอีกหน้าเข้าผ่านลิงก์)
// สถิติ implement แล้ว (ลำดับ build ข้อ 5) — Shopping / Settings ยังไม่ implement (รอลำดับ build
// ข้อ 4, 7) ใส่ไว้ให้เห็นภาพรวม UI แต่กดไม่ได้ยัง (opacity ต่ำ + ไม่ใช่ลิงก์) กัน user งงว่าทำไมกดแล้วไม่มีอะไรเกิดขึ้น

function NavLink({ href, label, Icon, active }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center justify-center gap-0.5 w-14 py-1"
    >
      <Icon
        className={`w-6 h-6 ${active ? "text-rose-500" : "text-zinc-400"}`}
      />
      <span className={`text-[10px] ${active ? "text-rose-500 font-medium" : "text-zinc-400"}`}>
        {label}
      </span>
    </Link>
  );
}

function NavPlaceholder({ label, Icon }) {
  return (
    <button
      type="button"
      title="เร็วๆ นี้"
      className="flex flex-col items-center justify-center gap-0.5 w-14 py-1 opacity-35 cursor-not-allowed"
    >
      <Icon className="w-6 h-6 text-zinc-400" />
      <span className="text-[10px] text-zinc-400">{label}</span>
    </button>
  );
}

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-zinc-200 pb-[env(safe-area-inset-bottom)]">
      <div className="relative flex items-center justify-between px-4 h-16">
        <NavLink href="/" label="หน้าแรก" Icon={HomeIcon} active={pathname === "/"} />
        <NavLink href="/stats" label="สถิติ" Icon={ChartIcon} active={pathname === "/stats"} />

        {/* ปุ่มเพิ่มของ — ลอยกลาง bottom nav */}
        <Link
          href="/add-item"
          className="absolute left-1/2 -translate-x-1/2 -top-5 w-14 h-14 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-500/30"
        >
          <PlusIcon className="w-7 h-7" />
        </Link>

        <NavPlaceholder label="ช้อปปิ้ง" Icon={CartIcon} />
        <NavPlaceholder label="ตั้งค่า" Icon={GearIcon} />
      </div>
    </nav>
  );
}
