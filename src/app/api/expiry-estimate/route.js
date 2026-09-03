// GET /api/expiry-estimate?name=...&storageLocation=fridge
// บอกฝั่งฟอร์มว่าควรโชว์ Path A (auto-fill) หรือ Path B (quick-pick) ตาม UX 2-path
import { resolveExpiryUI } from "@/lib/server/expiryEstimate";

export async function GET(req) {
  const params = new URL(req.url).searchParams;
  const name = params.get("name")?.trim();
  const storageLocation = params.get("storageLocation") || "fridge";

  if (!name) {
    return Response.json({ error: "ต้องระบุชื่อของ (name)" }, { status: 400 });
  }

  const result = await resolveExpiryUI({ foodName: name, storageLocation });
  return Response.json(result);
}
