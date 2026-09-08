import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import BottomNav from "@/components/BottomNav";
import AnonymousAuthBoot from "@/components/AnonymousAuthBoot";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const lineSeed = localFont({
  src: [
    { path: "./fonts/LINESeedSansTH_W_Rg.woff2", weight: "400", style: "normal" },
    { path: "./fonts/LINESeedSansTH_W_Bd.woff2", weight: "700", style: "normal" },
    { path: "./fonts/LINESeedSansTH_W_XBd.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-line-seed",
  display: "swap",
});

export const metadata = {
  title: "PantryMind",
  description: "ลดขยะอาหารในครัวเรือน — บันทึกของ เตือนก่อนหมดอายุ แนะนำเมนู",
};

// Layout นี้ตั้งใจทำเป็น "mobile shell" เท่านั้น (ไม่ทำ desktop layout)
// ความกว้างล็อกไว้ที่ max-w-md (~448px) ตรงกลางจอเสมอ ไม่ว่าจะเปิดจากมือถือ/iPad/เบราว์เซอร์
// จอกว้างตอน dev ก็ตาม — พื้นหลังนอกกรอบ (bg-zinc-200) มีไว้แค่กันดู "ลอย" เวลาทดสอบบนจอเดสก์ท็อป
export default function RootLayout({ children }) {
  return (
    <html
      lang="th"
      className={`${lineSeed.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-zinc-200 dark:bg-zinc-950 flex justify-center">
        {/* เช็ค/สร้าง anonymous session ให้อัตโนมัติทุกหน้า ไม่มีหน้าล็อกอินเลย (ดู TASK_E_AUTH.md E7) */}
        <AnonymousAuthBoot />
        <div className="w-full max-w-md min-h-screen bg-stone-50 dark:bg-zinc-900 flex flex-col relative">
          <main className="flex-1">{children}</main>
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
