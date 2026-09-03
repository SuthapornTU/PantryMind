// src/components/icons.js
// ไอคอนแบบ inline SVG เขียนเอง (เส้น outline ธรรมดา) — ไม่ใช้ icon library ภายนอก
// เพื่อไม่ต้องเพิ่ม dependency ใหม่ (เครื่องคุณเพิ่งลง Node.js เสร็จใหม่ๆ อยากให้ npm install ง่ายที่สุด)

function Svg({ children, className }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

export function HomeIcon({ className }) {
  return (
    <Svg className={className}>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9a1 1 0 0 0 1 1h4v-6h2v6h4a1 1 0 0 0 1-1v-9" />
    </Svg>
  );
}

export function ChartIcon({ className }) {
  return (
    <Svg className={className}>
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-7" />
      <path d="M4 20h16" />
    </Svg>
  );
}

export function CartIcon({ className }) {
  return (
    <Svg className={className}>
      <circle cx="9" cy="20" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="17" cy="20" r="1.4" fill="currentColor" stroke="none" />
      <path d="M3 4h2l2.2 11.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.6L21 8H6" />
    </Svg>
  );
}

export function GearIcon({ className }) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 13.5a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V19a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H5a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H11a1.7 1.7 0 0 0 1-1.5V5a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V11a1.7 1.7 0 0 0 1.5 1H19a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </Svg>
  );
}

export function PlusIcon({ className }) {
  return (
    <Svg className={className}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </Svg>
  );
}

export function UserIcon({ className }) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 20c1-3.5 4-5.5 7-5.5s6 2 7 5.5" />
    </Svg>
  );
}

export function ChevronRightIcon({ className }) {
  return (
    <Svg className={className}>
      <path d="m9 6 6 6-6 6" />
    </Svg>
  );
}

export function CameraIcon({ className }) {
  return (
    <Svg className={className}>
      <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1-1.6A1 1 0 0 1 9.36 5h5.28a1 1 0 0 1 .86.5L16.5 7h2A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5v-9Z" />
      <circle cx="12" cy="13" r="3.2" />
    </Svg>
  );
}

export function BarcodeIcon({ className }) {
  return (
    <Svg className={className}>
      <path d="M4 6V4h3" />
      <path d="M20 6V4h-3" />
      <path d="M4 18v2h3" />
      <path d="M20 18v2h-3" />
      <path d="M6 8v8" />
      <path d="M9.5 8v8" />
      <path d="M12.5 8v8" />
      <path d="M15 8v8" />
      <path d="M18 8v8" />
    </Svg>
  );
}

export function ReceiptIcon({ className }) {
  return (
    <Svg className={className}>
      <path d="M6 3h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3V3Z" />
      <path d="M8.5 8h7" />
      <path d="M8.5 11.5h7" />
      <path d="M8.5 15h4" />
    </Svg>
  );
}

export function PencilIcon({ className }) {
  return (
    <Svg className={className}>
      <path d="M4 20l.9-4.2L16.2 4.5a1.5 1.5 0 0 1 2.1 0l1.2 1.2a1.5 1.5 0 0 1 0 2.1L8.2 19.1 4 20Z" />
      <path d="M14.5 6.5l3 3" />
    </Svg>
  );
}

export function LeafIcon({ className }) {
  return (
    <Svg className={className}>
      <path d="M5 19c8 1 14-4 14-14-9 0-14 5-14 14Z" />
      <path d="M5 19c2-4 5-7 9-9" />
    </Svg>
  );
}

export function MoreHorizontalIcon({ className }) {
  return (
    <Svg className={className}>
      <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function ChefHatIcon({ className }) {
  return (
    <Svg className={className}>
      <path d="M7 11a3.5 3.5 0 0 1 1.1-6.8A3 3 0 0 1 12 3a3 3 0 0 1 3.9 1.2A3.5 3.5 0 0 1 17 11" />
      <path d="M7 11v6h10v-6" />
      <path d="M6.5 20.5h11" />
      <path d="M8 17.5v3" />
      <path d="M16 17.5v3" />
    </Svg>
  );
}

export function AwardIcon({ className }) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="9" r="5.2" />
      <path d="m8.3 13.6-1.6 6.4 5.3-2.8 5.3 2.8-1.6-6.4" />
    </Svg>
  );
}

export function ChevronsRightIcon({ className }) {
  return (
    <Svg className={className}>
      <path d="m7 6 6 6-6 6" />
      <path d="m13 6 6 6-6 6" />
    </Svg>
  );
}

export function ChevronsLeftIcon({ className }) {
  return (
    <Svg className={className}>
      <path d="m17 6-6 6 6 6" />
      <path d="m11 6-6 6 6 6" />
    </Svg>
  );
}

export function FridgeIcon({ className }) {
  return (
    <Svg className={className}>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M5 10h14" />
      <path d="M8 5.5v2" />
      <path d="M8 13v2" />
    </Svg>
  );
}
