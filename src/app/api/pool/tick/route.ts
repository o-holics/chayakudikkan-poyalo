import { adminDb } from "@/lib/firebaseAdmin";
import { runPoolPass } from "@/lib/matching";
import { adminGate, isResponse, requireSession } from "@/lib/routeHelpers";

export const runtime = "nodejs";

// Called by a waiting client once the soft forming window has passed.
export async function POST(req: Request) {
  const session = await requireSession(req);
  if (isResponse(session)) return session;
  const gate = adminGate();
  if (gate) return gate;

  const body = (await req.json().catch(() => ({}))) as { spotId?: string };
  const spotId = body.spotId?.trim();
  if (!spotId) return Response.json({ error: "Which spot?" }, { status: 400 });

  const db = adminDb();
  const poolSnap = await db.collection("matchPools").doc(spotId).get();
  if (!poolSnap.exists) return Response.json({ status: "idle" });
  const spotName = (poolSnap.data()!.spotName as string) ?? "a tea shop";

  let formed = await runPoolPass(db, spotId, spotName, "deadline");
  if (formed && !formed.uids.includes(session.uid)) {
    formed = await runPoolPass(db, spotId, spotName, "deadline");
  }

  if (formed?.uids.includes(session.uid)) {
    return Response.json({ status: "seated", tableId: formed.tableId });
  }
  return Response.json({ status: "waiting" });
}
