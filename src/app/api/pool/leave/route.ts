import { adminDb } from "@/lib/firebaseAdmin";
import { SIZE_MIN } from "@/lib/models";
import { adminGate, isResponse, requireSession } from "@/lib/routeHelpers";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await requireSession(req);
  if (isResponse(session)) return session;
  const gate = adminGate();
  if (gate) return gate;

  const body = (await req.json().catch(() => ({}))) as { spotId?: string };
  const spotId = body.spotId?.trim();
  if (!spotId) return Response.json({ error: "Which spot?" }, { status: 400 });

  const db = adminDb();
  const poolRef = db.collection("matchPools").doc(spotId);
  const waitingRef = poolRef.collection("waiting").doc(session.uid);

  await db.runTransaction(async (tx) => {
    const mine = await tx.get(waitingRef);
    const all = await tx.get(poolRef.collection("waiting"));
    if (!mine.exists) return;

    const remaining = all.size - 1;
    tx.delete(waitingRef);

    const patch: Record<string, unknown> = {
      waitingCount: Math.max(0, remaining),
      updatedAt: Date.now(),
    };
    if (remaining < SIZE_MIN) patch.formingDeadline = null;
    tx.set(poolRef, patch, { merge: true });
  });

  return Response.json({ status: "left" });
}
