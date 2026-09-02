import { adminDb } from "@/lib/firebaseAdmin";
import { geohash } from "@/lib/geo";
import { bumpInterest } from "@/lib/interest";
import { matchArea } from "@/lib/matching";
import {
  AREA_GEOHASH_PRECISION,
  DEFAULT_SIZE_MAX,
  DEFAULT_SIZE_MIN,
  MAX_LEAD_MS,
  MIN_LEAD_MS,
  RELAXED_MIN,
  TRAVEL_LEAD_MS,
} from "@/lib/models";
import { adminGate, isResponse, requireSession } from "@/lib/routeHelpers";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await requireSession(req);
  if (isResponse(session)) return session;
  const gate = adminGate();
  if (gate) return gate;

  const body = (await req.json().catch(() => ({}))) as {
    spotId?: string;
    spotName?: string;
    point?: { lat: number; lng: number };
    desiredAt?: number;
    pairOk?: boolean;
  };

  const spotId = body.spotId?.trim();
  const desiredAt = Number(body.desiredAt);
  if (!spotId) return Response.json({ error: "Which spot?" }, { status: 400 });
  if (!Number.isFinite(desiredAt)) return Response.json({ error: "Pick a time." }, { status: 400 });

  const now = Date.now();
  if (desiredAt < now + MIN_LEAD_MS) {
    return Response.json({ error: "Pick a time at least an hour from now." }, { status: 400 });
  }
  if (desiredAt > now + MAX_LEAD_MS) {
    return Response.json({ error: "Let's keep it to the next day or so." }, { status: 400 });
  }

  const db = adminDb();
  const [profileSnap, spotSnap, blocksSnap, pendingSnap] = await Promise.all([
    db.collection("profiles").doc(session.uid).get(),
    db.collection("teaSpots").doc(spotId).get(),
    db.collection("profiles").doc(session.uid).collection("blocks").get(),
    db
      .collection("teaIntents")
      .where("uid", "==", session.uid)
      .where("status", "==", "pending")
      .limit(1)
      .get(),
  ]);

  if (!profileSnap.exists) return Response.json({ error: "Finish your profile first." }, { status: 409 });
  const profile = profileSnap.data()!;

  if (profile.activeTableId) {
    const t = await db.collection("teaTables").doc(profile.activeTableId).get();
    if (t.exists && t.data()!.status === "active") {
      return Response.json({ status: "matched", tableId: profile.activeTableId });
    }
  }
  if (!pendingSnap.empty) {
    return Response.json({ status: "pending", intentId: pendingSnap.docs[0].id });
  }

  const spot = spotSnap.exists ? spotSnap.data()! : null;
  const spotName = (spot?.name as string) || body.spotName?.trim() || "a tea shop";
  const point = body.point ?? (spot ? { lat: spot.lat as number, lng: spot.lng as number } : null);
  if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lng)) {
    return Response.json({ error: "Couldn't place that spot on the map." }, { status: 400 });
  }

  const areaKey = geohash(point.lat, point.lng, AREA_GEOHASH_PRECISION);
  const intentId = `i_${now.toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

  await bumpInterest(db, spotId, spotName);
  await db.collection("teaIntents").doc(intentId).set({
    uid: session.uid,
    displayName: profile.displayName ?? "friend",
    spotId,
    spotName,
    point,
    areaKey,
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

  // Maybe there are already enough compatible intents nearby.
  await matchArea(db, areaKey, now).catch(() => ({ formed: 0, expired: 0 }));

  const after = await db.collection("teaIntents").doc(intentId).get();
  const status = after.data()?.status ?? "pending";
  if (status === "matched") {
    return Response.json({ status: "matched", tableId: after.data()!.tableId });
  }
  return Response.json({ status: "pending", intentId });
}
