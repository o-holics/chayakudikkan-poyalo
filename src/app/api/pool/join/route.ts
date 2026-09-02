import { adminDb } from "@/lib/firebaseAdmin";
import { geohash } from "@/lib/geo";
import { bumpInterest } from "@/lib/interest";
import { runPoolPass } from "@/lib/matching";
import { AREA_GEOHASH_PRECISION, DEFAULT_SIZE_MAX, DEFAULT_SIZE_MIN } from "@/lib/models";
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
  };
  const spotId = body.spotId?.trim();
  if (!spotId) return Response.json({ error: "Which spot?" }, { status: 400 });

  const db = adminDb();
  const now = Date.now();

  const [profileSnap, spotSnap, blocksSnap] = await Promise.all([
    db.collection("profiles").doc(session.uid).get(),
    db.collection("teaSpots").doc(spotId).get(),
    db.collection("profiles").doc(session.uid).collection("blocks").get(),
  ]);

  if (!profileSnap.exists) return Response.json({ error: "Finish your profile first." }, { status: 409 });
  const profile = profileSnap.data()!;

  if (profile.activeTableId) {
    const t = await db.collection("teaTables").doc(profile.activeTableId).get();
    if (t.exists && t.data()!.status === "active") {
      return Response.json({ status: "seated", tableId: profile.activeTableId });
    }
  }

  const spot = spotSnap.exists ? spotSnap.data()! : null;
  const spotName: string = (spot?.name as string) || body.spotName?.trim() || "a tea shop";
  const point = body.point ?? (spot ? { lat: spot.lat as number, lng: spot.lng as number } : null);
  if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lng)) {
    return Response.json({ error: "Couldn't place that spot on the map." }, { status: 400 });
  }

  const areaKey = geohash(point.lat, point.lng, AREA_GEOHASH_PRECISION);
  const blockedUids = blocksSnap.docs.map((d) => d.id);

  await bumpInterest(db, spotId, spotName);

  const poolRef = db.collection("matchPools").doc(areaKey);
  const waitingRef = poolRef.collection("waiting").doc(session.uid);

  await db.runTransaction(async (tx) => {
    const existing = await tx.get(waitingRef);
    const all = await tx.get(poolRef.collection("waiting"));

    if (!existing.exists) {
      tx.set(waitingRef, {
        uid: session.uid,
        displayName: profile.displayName ?? "friend",
        joinedAt: now,
        sizeMin: profile.sizeMin ?? DEFAULT_SIZE_MIN,
        sizeMax: profile.sizeMax ?? DEFAULT_SIZE_MAX,
        relaxedMin: null,
        spotId,
        spotName,
        point,
        blockedUids,
      });
    }
    tx.set(
      poolRef,
      { areaKey, waitingCount: existing.exists ? all.size : all.size + 1, updatedAt: now },
      { merge: true },
    );
  });

  let formed = await runPoolPass(db, areaKey);
  if (formed && !formed.uids.includes(session.uid)) formed = await runPoolPass(db, areaKey);

  if (formed?.uids.includes(session.uid)) {
    return Response.json({ status: "seated", tableId: formed.tableId });
  }
  return Response.json({ status: "waiting", areaKey });
}
