import { adminDb } from "@/lib/firebaseAdmin";
import { finalizeTable } from "@/lib/tableAdmin";
import { adminGate, isResponse, requireSession } from "@/lib/routeHelpers";

export const runtime = "nodejs";

// Any member (or the cron) can nudge a table past its meet window.
export async function POST(req: Request) {
  const session = await requireSession(req);
  if (isResponse(session)) return session;
  const gate = adminGate();
  if (gate) return gate;

  const { tableId } = (await req.json().catch(() => ({}))) as { tableId?: string };
  if (!tableId) return Response.json({ error: "Which table?" }, { status: 400 });

  const db = adminDb();
  const tableRef = db.collection("teaTables").doc(tableId);
  const snap = await tableRef.get();
  if (!snap.exists) return Response.json({ status: "gone" });

  const table = snap.data()!;
  const memberUids: string[] = table.memberUids ?? [];
  if (!memberUids.includes(session.uid)) return Response.json({ status: "not-member" });
  if (table.status !== "active") return Response.json({ status: table.status });

  const now = Date.now();
  const meetBy = (table.meetBy as number) ?? 0;
  const expiresAt = (table.expiresAt as number) ?? 0;

  if (now >= expiresAt) {
    await finalizeTable(db, tableId, "expired", memberUids, now);
    return Response.json({ status: "expired" });
  }

  if (now >= meetBy) {
    const presence = await tableRef.collection("presence").get();
    const arrived = presence.docs.filter((d) => d.data().arrivedAt).length;
    const outcome = arrived >= 2 ? "met" : "expired";
    await finalizeTable(db, tableId, outcome, memberUids, now);
    return Response.json({ status: outcome });
  }

  return Response.json({ status: "active" });
}
