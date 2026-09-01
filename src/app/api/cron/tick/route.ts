import { adminDb, adminReady } from "@/lib/firebaseAdmin";
import { runPoolPass } from "@/lib/matching";
import { finalizeTable } from "@/lib/tableAdmin";

export const runtime = "nodejs";

// Safety net for terminal transitions when no client is around to nudge.
// Point a scheduler (GitHub Actions / cron-job.org) at this every ~60s.
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: "no" }, { status: 401 });
  }
  if (!adminReady()) return Response.json({ error: "admin not configured" }, { status: 503 });

  const db = adminDb();
  const now = Date.now();
  let formed = 0;
  let closed = 0;

  const pools = await db
    .collection("matchPools")
    .where("formingDeadline", "<=", now)
    .limit(50)
    .get();
  for (const p of pools.docs) {
    const d = p.data();
    if ((d.waitingCount ?? 0) < 3) continue;
    const res = await runPoolPass(db, p.id, d.spotName ?? "a tea shop", "deadline", now).catch(() => null);
    if (res) formed++;
  }

  const stale = await db
    .collection("teaTables")
    .where("status", "==", "active")
    .where("meetBy", "<=", now)
    .limit(50)
    .get();
  for (const t of stale.docs) {
    const d = t.data();
    const memberUids: string[] = d.memberUids ?? [];
    const presence = await t.ref.collection("presence").get();
    const arrived = presence.docs.filter((x) => x.data().arrivedAt).length;
    const outcome = now >= (d.expiresAt ?? 0) ? "expired" : arrived >= 2 ? "met" : "expired";
    await finalizeTable(db, t.id, outcome, memberUids, now).catch(() => {});
    closed++;
  }

  return Response.json({ ok: true, formed, closed });
}
