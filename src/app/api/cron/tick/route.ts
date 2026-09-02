import { adminDb, adminReady } from "@/lib/firebaseAdmin";
import { matchArea } from "@/lib/matching";
import { finalizeTable } from "@/lib/tableAdmin";

export const runtime = "nodejs";

// Forms tables from pending intents and closes tables past their meet time.
// Point a scheduler (GitHub Actions / cron-job.org) here every ~2–5 min.
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
  let expired = 0;
  let closed = 0;

  const pending = await db
    .collection("teaIntents")
    .where("status", "==", "pending")
    .limit(200)
    .get();
  const areas = Array.from(new Set(pending.docs.map((d) => d.data().areaKey as string)));
  for (const areaKey of areas) {
    const r = await matchArea(db, areaKey, now).catch(() => ({ formed: 0, expired: 0 }));
    formed += r.formed;
    expired += r.expired;
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
    closed += 1;
  }

  return Response.json({ ok: true, formed, expired, closed });
}
