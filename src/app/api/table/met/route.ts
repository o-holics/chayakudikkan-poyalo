import { adminDb } from "@/lib/firebaseAdmin";
import { finalizeTable } from "@/lib/tableAdmin";
import { adminGate, isResponse, requireSession } from "@/lib/routeHelpers";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await requireSession(req);
  if (isResponse(session)) return session;
  const gate = adminGate();
  if (gate) return gate;

  const { tableId } = (await req.json().catch(() => ({}))) as { tableId?: string };
  if (!tableId) return Response.json({ error: "Which table?" }, { status: 400 });

  const db = adminDb();
  const snap = await db.collection("teaTables").doc(tableId).get();
  if (!snap.exists) return Response.json({ error: "That table's gone." }, { status: 404 });

  const table = snap.data()!;
  const memberUids: string[] = table.memberUids ?? [];
  if (!memberUids.includes(session.uid)) return Response.json({ error: "Not your table." }, { status: 403 });

  if (table.status === "active") {
    await finalizeTable(db, tableId, "met", memberUids);
  }
  return Response.json({ status: "met" });
}
