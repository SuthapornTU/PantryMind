"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { HomeIcon, ChartIcon, CartIcon, AwardIcon, PlusIcon, CameraIcon, PencilIcon } from "./icons";

// bottom tab bar สไตล์แอปมือถือ (home / สถิติ / + / ช้อปปิ้ง / ภารกิจ)
// สี/ไอคอน/รูปทรงอ้างอิงดีไซน์ Figma หน้า Home (node 2:5, Tool Bar) — ลอยเป็นแคปซูลพื้นครีม #f0e5d2
// มีระยะห่างขอบจอ ไม่ชิดขอบเหมือนของเดิม — ใช้ bg โปร่งแสง + backdrop-blur (ไม่ทึบเหมือน Figma เป๊ะๆ)
// เพราะ user อยากให้บาร์นี้ดูกลมกลืนเหมือนกันทุกหน้า แม้พื้นหลังแต่ละหน้าจะสีไม่เหมือนกัน (หน้า Home
// พื้นครีมเรียบ, หน้าสถิติ/ช้อปปิ้งพื้นไล่เฉดสีอื่น) — โปร่งแสงเลยทำให้กลืนกับพื้นหลังใต้บาร์ได้ทุกหน้า
// ใช้ร่วมกันทุกหน้า ไม่ใช่แค่หน้า Home
// ล็อกไว้ตรงกลางความกว้างระดับมือถือ/iPad เสมอ ไม่ทำ layout สำหรับจอเดสก์ท็อป
// ไม่มีแท็บแยกสำหรับ "รายการของทั้งหมด" — เข้าถึงผ่านลิงก์ "ดูทั้งหมด" ในหน้าแรกแทน
// ภารกิจ (มิชชัน) ยังไม่ implement ใส่ไว้ให้เห็นภาพรวม UI แต่กดไม่ได้ยัง
// (opacity ต่ำ + ไม่ใช่ลิงก์) กัน user งงว่าทำไมกดแล้วไม่มีอะไรเกิดขึ้น
// ปุ่มกลาง "+" เป็น expandable FAB: กดแล้วเด้งปุ่มย่อย 2 อัน (ถ่ายรูป / พิมพ์เอง) แทนที่จะพา
// ไปหน้า add-item ตรงๆ

function NavLink({ href, label, Icon, active, onClick }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-0.5 w-14 py-1"
    >
      <Icon
        className={`w-6 h-6 ${active ? "text-[#4b3535] dark:text-rose-200" : "text-stone-400"}`}
      />
      <span className={`text-[10px] ${active ? "text-[#4b3535] dark:text-rose-200 font-medium" : "text-stone-400"}`}>
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
      <Icon className="w-6 h-6 text-stone-400" />
      <span className="text-[10px] text-stone-400">{label}</span>
    </button>
  );
}

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);

  function goTo(href) {
    setExpanded(false);
    router.push(href);
  }

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md px-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
      <div className="relative flex items-center justify-between px-4 h-16 rounded-full bg-[#f0e5d2]/70 backdrop-blur-md shadow-md ring-1 ring-white/40">
        <NavLink
          href="/"
          label="หน้าแรก"
          Icon={HomeIcon}
          active={pathname === "/"}
          onClick={() => setExpanded(false)}
        />
        <NavLink
          href="/stats"
          label="สถิติ"
          Icon={ChartIcon}
          active={pathname === "/stats"}
          onClick={() => setExpanded(false)}
        />

        {/* ปุ่มเพิ่มของ — ลอยกลาง bottom nav, ตำแหน่ง/ขนาด/เงาเดิมทุกอย่างตอน collapsed */}
        <div className="absolute left-1/2 -translate-x-1/2 -top-5">
          {/* ปุ่มย่อย: ถ่ายรูป / พิมพ์เอง — เด้งขึ้นเหนือปุ่มหลักตอน expanded เท่านั้น */}
          <div
            className={`absolute bottom-0 left-1/2 -translate-x-1/2 -translate-y-[90px] flex items-center gap-5 transition-all duration-200 ${
              expanded ? "opacity-100 scale-100" : "opacity-0 scale-75 pointer-events-none"
            }`}
          >
            <button
              type="button"
              aria-label="ถ่ายรูปเพิ่มของ"
              onClick={() => goTo("/add-item/camera")}
              className="w-11 h-11 rounded-full bg-white border border-zinc-200 shadow-md text-[#4b3535] flex items-center justify-center"
            >
              <CameraIcon className="w-5 h-5" />
            </button>
            <button
              type="button"
              aria-label="พิมพ์เพิ่มของเอง"
              onClick={() => goTo("/add-item")}
              className="w-11 h-11 rounded-full bg-white border border-zinc-200 shadow-md text-[#4b3535] flex items-center justify-center"
            >
              <PencilIcon className="w-5 h-5" />
            </button>
          </div>

          <button
            type="button"
            aria-label={expanded ? "ปิดเมนูเพิ่มของ" : "เพิ่มของ"}
            onClick={() => setExpanded((v) => !v)}
            className="w-14 h-14 rounded-full bg-[#4b3535] hover:bg-[#3a2929] text-white flex items-center justify-center shadow-lg shadow-[#4b3535]/30"
          >
            <PlusIcon
              className={`w-7 h-7 transition-transform duration-200 ${expanded ? "rotate-45" : "rotate-0"}`}
            />
          </button>
        </div>

        <NavLink
          href="/shopping"
          label="ช้อปปิ้ง"
          Icon={CartIcon}
          active={pathname === "/shopping"}
          onClick={() => setExpanded(false)}
        />
        <NavPlaceholder label="ภารกิจ" Icon={AwardIcon} />
      </div>
    </nav>
  );
}
