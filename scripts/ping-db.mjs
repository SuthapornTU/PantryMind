// วัดว่าช้าเพราะ database หรือเปล่า
// รัน:  node --env-file=.env.local scripts/ping-db.mjs
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
});

console.log("host:", process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] ?? "(ไม่พบ DATABASE_URL)");

let t = Date.now();
await pool.query("select 1");
console.log(`\n1) ต่อครั้งแรก (TCP + TLS + auth):  ${Date.now() - t} ms   <-- ตัวนี้แหละที่เจ็บ`);

const times = [];
for (let i = 0; i < 5; i++) {
  t = Date.now();
  await pool.query("select 1");
  times.push(Date.now() - t);
}
console.log(`2) query ซ้ำบน connection เดิม:     ${times.join(", ")} ms`);

t = Date.now();
await pool.query(
  `select id,name,expiry_date from pantry_items where user_id=$1 and used_at is null order by expiry_date limit 12`,
  [1]
);
const q1 = Date.now() - t;
t = Date.now();
await pool.query(
  `select id,name,expiry_date from pantry_items where user_id=$1 and used_at is null and expiry_date < current_date order by expiry_date`,
  [1]
);
const q2 = Date.now() - t;
console.log(`3) query จริงของหน้าแรก:            ${q1} ms + ${q2} ms = ${q1 + q2} ms (ตอนนี้รันทีละอัน)`);

const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
console.log(`\nสรุป: ค่า latency ไป-กลับ ~${avg} ms ต่อ 1 query`);
console.log(`ถ้าหน้าเว็บช้ากว่า ${avg * 3} ms มาก แปลว่าไม่ได้ช้าเพราะ database`);
await pool.end();
