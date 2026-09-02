import { adminDb } from "@/lib/firebaseAdmin";
import { RELAX_TIERS } from "@/lib/models";
import { adminGate, isResponse, requireSession } from "@/lib/routeHelpers";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await requireSession(req);
  if (isResponse(session)) return session;
  const gate = adminGate();
  if (gate) return gate;

  const body = (await req.json().catch(() => ({}))) as { areaKey?: string; spotId?: string };
  const areaKey = body.areaKey?.trim();
  if (!areaKey) return Response.json({ error: "Which pool?" }, { status: 400 });

  const db = adminDb();
  const poolRef = db.collection("matchPools").doc(areaKey);
  const waitingRef = poolRef.collection("waiting").doc(session.uid);

  await db.runTransaction(async (tx) => {
    const mine = await tx.get(waitingRef);
    const all = await tx.get(poolRef.collection("waiting"));
    if (!mine.exists) return;

    const rest = all.docs.filter((d) => d.id !== session.uid).map((d) => d.data().joinedAt as number);
    tx.delete(waitingRef);
    tx.set(
      poolRef,
      {
        waitingCount: rest.length,
        formingDeadline: rest.length >= 2 ? Math.min(...rest) + RELAX_TIERS[1].afterMs : null,
        updatedAt: Date.now(),
      },
      { merge: true },
    );
  });

  return Response.json({ status: "left" });
}
