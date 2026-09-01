import { adminDb } from "@/lib/firebaseAdmin";
import { runPoolPass } from "@/lib/matching";
import { DEFAULT_SIZE_MAX, DEFAULT_SIZE_MIN } from "@/lib/models";
import { adminGate, isResponse, requireSession } from "@/lib/routeHelpers";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await requireSession(req);
  if (isResponse(session)) return session;
  const gate = adminGate();
  if (gate) return gate;

  const body = (await req.json().catch(() => ({}))) as { spotId?: string; spotName?: string };
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

  const spotName: string =
    (spotSnap.exists && (spotSnap.data()!.name as string)) || body.spotName?.trim() || "a tea shop";
  const blockedUids = blocksSnap.docs.map((d) => d.id);

  const poolRef = db.collection("matchPools").doc(spotId);
  const waitingRef = poolRef.collection("waiting").doc(session.uid);

  await db.runTransaction(async (tx) => {
    const existing = await tx.get(waitingRef);
    const poolSnap = await tx.get(poolRef);
    const currentCount = poolSnap.exists ? (poolSnap.data()!.waitingCount ?? 0) : 0;

    if (!existing.exists) {
      tx.set(waitingRef, {
        uid: session.uid,
        displayName: profile.displayName ?? "friend",
        joinedAt: now,
        sizeMin: profile.sizeMin ?? DEFAULT_SIZE_MIN,
        sizeMax: profile.sizeMax ?? DEFAULT_SIZE_MAX,
        blockedUids,
      });
    }

    tx.set(
      poolRef,
      {
        spotId,
        spotName,
        waitingCount: existing.exists ? currentCount : currentCount + 1,
        updatedAt: now,
      },
      { merge: true },
    );
  });

  // Try to seat straight away (only forms a full-ish table).
  let formed = await runPoolPass(db, spotId, spotName, "eager");
  if (formed && !formed.uids.includes(session.uid)) {
    formed = await runPoolPass(db, spotId, spotName, "eager");
  }

  if (formed?.uids.includes(session.uid)) {
    return Response.json({ status: "seated", tableId: formed.tableId });
  }
  return Response.json({ status: "waiting", spotId });
}
