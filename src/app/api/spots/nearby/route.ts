import { adminDb, adminReady } from "@/lib/firebaseAdmin";
import { distanceMeters, geohash } from "@/lib/geo";
import { NEARBY_CACHE_TTL_MS, RADIUS_MAX_KM, RADIUS_MIN_KM, DEFAULT_RADIUS_KM, type TeaSpot } from "@/lib/models";
import { fetchNearbySpots, geocodeArea } from "@/lib/places";
import { isResponse, requireSession } from "@/lib/routeHelpers";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await requireSession(req);
  if (isResponse(session)) return session;

  const url = new URL(req.url);
  const latRaw = url.searchParams.get("lat");
  const lngRaw = url.searchParams.get("lng");
  const q = url.searchParams.get("q")?.trim();

  const radiusKm = Math.min(
    RADIUS_MAX_KM,
    Math.max(RADIUS_MIN_KM, Number(url.searchParams.get("radiusKm")) || DEFAULT_RADIUS_KM),
  );
  const radiusM = Math.round(radiusKm * 1000);

  let center: { lat: number; lng: number } | null = null;
  let areaLabel: string | undefined;

  if (latRaw && lngRaw) {
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    if (Number.isFinite(lat) && Number.isFinite(lng)) center = { lat, lng };
  } else if (q) {
    const geo = await geocodeArea(q).catch(() => null);
    if (geo) {
      center = { lat: geo.lat, lng: geo.lng };
      areaLabel = geo.label;
    }
  }

  if (!center) {
    return Response.json({ error: "Tell us roughly where you are." }, { status: 400 });
  }

  const gh = geohash(center.lat, center.lng, 6);
  const cacheKey = `${gh}_r${radiusKm}`;
  let spots: TeaSpot[] = [];

  try {
    if (adminReady()) {
      const db = adminDb();
      const cacheRef = db.collection("nearbyCache").doc(cacheKey);
      const cacheSnap = await cacheRef.get();
      const cache = cacheSnap.exists ? cacheSnap.data()! : null;
      const fresh = cache && Date.now() - (cache.fetchedAt ?? 0) < NEARBY_CACHE_TTL_MS;

      if (fresh && Array.isArray(cache!.spotIds) && cache!.spotIds.length) {
        const refs = (cache!.spotIds as string[]).map((id) => db.collection("teaSpots").doc(id));
        const docs = await db.getAll(...refs);
        spots = docs.filter((d) => d.exists).map((d) => d.data() as TeaSpot);
      } else {
        spots = await fetchNearbySpots(center, radiusM);
        const batch = db.batch();
        for (const s of spots) batch.set(db.collection("teaSpots").doc(s.id), s, { merge: true });
        batch.set(cacheRef, {
          geohash: gh,
          radiusKm,
          center,
          spotIds: spots.map((s) => s.id),
          fetchedAt: Date.now(),
        });
        await batch.commit();
      }
    } else {
      spots = await fetchNearbySpots(center, radiusM);
    }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[nearby]", detail);
    return Response.json(
      { error: "Couldn't reach the map right now. Give it a moment and try again.", detail },
      { status: 502 },
    );
  }

  const withDistance = spots
    .map((s) => ({ ...s, distanceM: Math.round(distanceMeters(center!, { lat: s.lat, lng: s.lng })) }))
    .filter((s) => s.distanceM <= radiusM + 200)
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, 30);

  return Response.json({ center, areaLabel, radiusKm, spots: withDistance });
}
