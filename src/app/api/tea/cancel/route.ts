import { adminDb } from "@/lib/firebaseAdmin";
import { recountArea } from "@/lib/matching";
import { adminGate, isResponse, requireSession } from "@/lib/routeHelpers";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await requireSession(req);
  if (isResponse(session)) return session;
  const gate = adminGate();
  if (gate) return gate;

  const db = adminDb();
  const snap = await db
    .collection("teaIntents")
    .where("uid", "==", session.uid)
    .where("status", "==", "pending")
    .get();

  const now = Date.now();
  await Promise.all(
    snap.docs.map((d) => d.ref.set({ status: "cancelled", cancelledAt: now }, { merge: true })),
  );

  const areas = Array.from(new Set(snap.docs.map((d) => d.data().areaKey as string)));
  await Promise.all(areas.map((a) => recountArea(db, a, now).catch(() => {})));

  return Response.json({ status: "cancelled", count: snap.size });
}
