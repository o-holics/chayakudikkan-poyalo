import { adminDb } from "@/lib/firebaseAdmin";
import { geohash } from "@/lib/geo";
import { bumpInterest } from "@/lib/interest";
import { matchArea } from "@/lib/matching";
import {
  AREA_GEOHASH_PRECISION,
  DEFAULT_SIZE_MAX,
  DEFAULT_SIZE_MIN,
  latestDesiredAt,
  MIN_LEAD_MS,
  RELAXED_MIN,
  TRAVEL_LEAD_MS,
  type SpotRef,
} from "@/lib/models";
import { adminGate, isResponse, requireSession } from "@/lib/routeHelpers";

export const runtime = "nodejs";

function cleanSpot(v: unknown): SpotRef | null {
  if (!v || typeof v !== "object") return null;
  const s = v as Record<string, unknown>;
  if (typeof s.spotId !== "string" || typeof s.spotName !== "string") return null;
  const lat = Number(s.lat);
  const lng = Number(s.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { spotId: s.spotId, spotName: s.spotName, lat, lng };
}

export async function POST(req: Request) {
  const session = await requireSession(req);
  if (isResponse(session)) return session;
  const gate = adminGate();
  if (gate) return gate;

  const body = (await req.json().catch(() => ({}))) as {
    point?: { lat: number; lng: number };
    areaLabel?: string;
    spotPref?: unknown;
    spotOptions?: unknown[];
    desiredAt?: number;
    pairOk?: boolean;
  };

  const desiredAt = Number(body.desiredAt);
  if (!Number.isFinite(desiredAt)) return Response.json({ error: "Pick a time." }, { status: 400 });

  const now = Date.now();
  if (desiredAt < now + MIN_LEAD_MS) {
    return Response.json({ error: "Pick a time at least an hour from now." }, { status: 400 });
  }
  if (desiredAt > latestDesiredAt(now)) {
    return Response.json({ error: "Only through to tomorrow morning for now." }, { status: 400 });
  }

  const spotPref = cleanSpot(body.spotPref);
  const spotOptions = (Array.isArray(body.spotOptions) ? body.spotOptions : [])
    .map(cleanSpot)
    .filter((s): s is SpotRef => s !== null)
    .slice(0, 8);
  if (spotOptions.length === 0 && !spotPref) {
    return Response.json({ error: "We couldn't find any tea shops near you." }, { status: 400 });
  }

  const db = adminDb();
  const [profileSnap, blocksSnap, pendingSnap] = await Promise.all([
    db.collection("profiles").doc(session.uid).get(),
    db.collection("profiles").doc(session.uid).collection("blocks").get(),
    db.collection("teaIntents").where("uid", "==", session.uid).limit(20).get(),
  ]);

  if (!profileSnap.exists) return Response.json({ error: "Finish your profile first." }, { status: 409 });
  const profile = profileSnap.data()!;

  if (profile.activeTableId) {
    const t = await db.collection("teaTables").doc(profile.activeTableId).get();
    if (t.exists && t.data()!.status === "active") {
      return Response.json({ status: "matched", tableId: profile.activeTableId });
    }
  }
  const existing = pendingSnap.docs.find((d) => d.data().status === "pending");
  if (existing) return Response.json({ status: "pending", intentId: existing.id });

  const point =
    body.point ??
    (profile.homePoint as { lat: number; lng: number } | undefined) ??
    (spotPref ? { lat: spotPref.lat, lng: spotPref.lng } : { lat: spotOptions[0].lat, lng: spotOptions[0].lng });
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) {
    return Response.json({ error: "Tell us roughly where you are." }, { status: 400 });
  }

  const areaKey = geohash(point.lat, point.lng, AREA_GEOHASH_PRECISION);
  const intentId = `i_${now.toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

  if (spotPref) await bumpInterest(db, spotPref.spotId, spotPref.spotName);

  await db.collection("teaIntents").doc(intentId).set({
    uid: session.uid,
    displayName: profile.displayName ?? "friend",
    point,
    areaKey,
    areaLabel: body.areaLabel ?? profile.areaLabel ?? null,
    spotPref: spotPref ?? null,
    spotOptions,
    desiredAt,
    lockBy: desiredAt - TRAVEL_LEAD_MS,
    sizeMin: profile.sizeMin ?? DEFAULT_SIZE_MIN,
    sizeMax: profile.sizeMax ?? DEFAULT_SIZE_MAX,
    relaxedMin: body.pairOk ? RELAXED_MIN : null,
    blockedUids: blocksSnap.docs.map((d) => d.id),
    createdAt: now,
    status: "pending",
    tableId: null,
  });

  await matchArea(db, areaKey, now).catch(() => ({ formed: 0, expired: 0 }));

  const after = await db.collection("teaIntents").doc(intentId).get();
  if (after.data()?.status === "matched") {
    return Response.json({ status: "matched", tableId: after.data()!.tableId });
  }
  return Response.json({ status: "pending", intentId });
}
