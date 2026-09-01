import { reverseGeocode } from "@/lib/places";
import { isResponse, requireSession } from "@/lib/routeHelpers";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await requireSession(req);
  if (isResponse(session)) return session;

  const url = new URL(req.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return Response.json({ error: "bad point" }, { status: 400 });
  }

  const label = await reverseGeocode(lat, lng).catch(() => null);
  return Response.json({ label });
}
