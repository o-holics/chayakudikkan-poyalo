import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { finalizeTable } from "@/lib/tableAdmin";
import { adminGate, isResponse, requireSession } from "@/lib/routeHelpers";
import type { TableMember } from "@/lib/models";

export const runtime = "nodejs";

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

  const remaining = memberUids.filter((u) => u !== session.uid);

  // Always release the leaver.
  await db.collection("profiles").doc(session.uid).set({ activeTableId: null }, { merge: true });
  await db.collection("profiles").doc(session.uid).collection("history").doc(tableId).set(
    { outcome: "cancelled", at: Date.now() },
    { merge: true },
  );

  if (table.status !== "active") return Response.json({ status: "left" });

  if (remaining.length < 2) {
    await finalizeTable(db, tableId, "cancelled", remaining);
  } else {
    const members: TableMember[] = (table.members ?? []).filter((m: TableMember) => m.uid !== session.uid);
    await tableRef.set(
      { memberUids: remaining, members, leftUids: FieldValue.arrayUnion(session.uid) },
      { merge: true },
    );
  }

  return Response.json({ status: "left" });
}
