import { Geist, Geist_Mono } from "next/font/google";
import BottomNav from "@/components/BottomNav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "PantryMind",
  description: "ลดขยะอาหารในครัวเรือน — บันทึกของ เตือนก่อนหมดอายุ แนะนำเมนู",
};

// Layout นี้ตั้งใจทำเป็น "mobile shell" เท่านั้น (ตามที่ตกลง — ไม่เอา desktop layout)
// ความกว้างล็อกไว้ที่ max-w-md (~448px) ตรงกลางจอเสมอ ไม่ว่าจะเปิดจากมือถือ/iPad/เบราว์เซอร์
// จอกว้างตอน dev ก็ตาม — พื้นหลังนอกกรอบ (bg-zinc-200) มีไว้แค่กันดู "ลอย" เวลาทดสอบบนจอเดสก์ท็อป
export default function RootLayout({ children }) {
  return (
    <html
      lang="th"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-zinc-200 dark:bg-zinc-950 flex justify-center">
        <div className="w-full max-w-md min-h-screen bg-stone-50 dark:bg-zinc-900 flex flex-col relative">
          <main className="flex-1 pb-24">{children}</main>
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
