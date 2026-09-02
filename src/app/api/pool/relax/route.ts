import { adminDb } from "@/lib/firebaseAdmin";
import { runPoolPass } from "@/lib/matching";
import { RELAXED_MIN } from "@/lib/models";
import { adminGate, isResponse, requireSession } from "@/lib/routeHelpers";

export const runtime = "nodejs";

// The waiter has said they're OK with a smaller table (even a pair).
export async function POST(req: Request) {
  const session = await requireSession(req);
  if (isResponse(session)) return session;
  const gate = adminGate();
  if (gate) return gate;

  const body = (await req.json().catch(() => ({}))) as { areaKey?: string };
  const areaKey = body.areaKey?.trim();
  if (!areaKey) return Response.json({ error: "Which pool?" }, { status: 400 });

  const db = adminDb();
  const waitingRef = db.collection("matchPools").doc(areaKey).collection("waiting").doc(session.uid);
  const snap = await waitingRef.get();
  if (!snap.exists) return Response.json({ status: "idle" });

  await waitingRef.set({ relaxedMin: RELAXED_MIN }, { merge: true });

  let formed = await runPoolPass(db, areaKey);
  if (formed && !formed.uids.includes(session.uid)) formed = await runPoolPass(db, areaKey);

  if (formed?.uids.includes(session.uid)) {
    return Response.json({ status: "seated", tableId: formed.tableId });
  }
  return Response.json({ status: "waiting" });
}
