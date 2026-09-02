import "server-only";
import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { distanceMeters } from "./geo";
import { randomLine } from "./lines";
import {
  MEET_WINDOW_MS,
  RELAX_TIERS,
  SIZE_MAX,
  TABLE_TTL_MS,
  type PoolWaiter,
  type TableMember,
} from "./models";

export type Waiter = PoolWaiter;

function blocked(a: Waiter, b: Waiter): boolean {
  return Boolean(a.blockedUids?.includes(b.uid) || b.blockedUids?.includes(a.uid));
}

/** The smallest table this waiter will accept (their choice, or their opt-in relax). */
function minFor(w: Waiter): number {
  return Math.max(2, w.relaxedMin ?? w.sizeMin);
}

export type PlannedGroup = { members: Waiter[]; spotId: string; spotName: string };

/**
 * Where the group meets. If most of them picked the same spot, that one.
 * Otherwise the proposed spot that's most central to everyone.
 */
function pickSpot(members: Waiter[]): { spotId: string; spotName: string } {
  const votes = new Map<string, { name: string; n: number }>();
  for (const m of members) {
    const v = votes.get(m.spotId) ?? { name: m.spotName, n: 0 };
    v.n += 1;
    votes.set(m.spotId, v);
  }

  let top: [string, { name: string; n: number }] | undefined;
  for (const entry of votes) if (!top || entry[1].n > top[1].n) top = entry;
  if (top && top[1].n > members.length / 2) return { spotId: top[0], spotName: top[1].name };

  let pick = [...votes.keys()][0];
  let pickName = votes.get(pick)!.name;
  let bestSum = Infinity;
  for (const candidate of votes.keys()) {
    const p = members.find((m) => m.spotId === candidate)!.point;
    const sum = members.reduce((acc, m) => acc + distanceMeters(p, m.point), 0);
    if (sum < bestSum) {
      bestSum = sum;
      pick = candidate;
      pickName = votes.get(candidate)!.name;
    }
  }
  return { spotId: pick, spotName: pickName };
}

function buildGroup(waiters: Waiter[], clusterM: number): PlannedGroup | null {
  const ordered = [...waiters].sort((a, b) => a.joinedAt - b.joinedAt);

  for (const seed of ordered) {
    const near = ordered
      .filter(
        (w) => w.uid !== seed.uid && !blocked(seed, w) && distanceMeters(seed.point, w.point) <= clusterM,
      )
      .sort((a, b) => {
        const pa = a.spotId === seed.spotId ? 0 : 1;
        const pb = b.spotId === seed.spotId ? 0 : 1;
        if (pa !== pb) return pa - pb;
        const da = distanceMeters(seed.point, a.point);
        const db = distanceMeters(seed.point, b.point);
        if (da !== db) return da - db;
        return a.joinedAt - b.joinedAt;
      });

    const chosen: Waiter[] = [seed];
    for (const w of near) {
      if (chosen.length >= SIZE_MAX) break;
      if (chosen.some((c) => blocked(c, w))) continue;
      if (chosen.length + 1 > Math.min(...chosen.concat(w).map((x) => x.sizeMax))) continue;
      chosen.push(w);
    }

    const cap = Math.min(SIZE_MAX, ...chosen.map((x) => x.sizeMax));
    for (let n = Math.min(cap, chosen.length); n >= 2; n -= 1) {
      const slice = chosen.slice(0, n);
      if (n < Math.max(...slice.map(minFor))) continue;
      return { members: slice, ...pickSpot(slice) };
    }
  }
  return null;
}

/** Form the best table possible right now, widening the search the longer people have waited. */
export function planGroup(waiters: Waiter[], now = Date.now()): PlannedGroup | null {
  if (waiters.length < 2) return null;
  const oldest = Math.min(...waiters.map((w) => w.joinedAt));
  const waited = now - oldest;
  const tier = [...RELAX_TIERS].reverse().find((t) => waited >= t.afterMs) ?? RELAX_TIERS[0];
  return buildGroup(waiters, tier.clusterM);
}

export type FormResult = { tableId: string; uids: string[] } | null;

/** One matching pass over an area pool, in a transaction. */
export async function runPoolPass(db: Firestore, areaKey: string, now = Date.now()): Promise<FormResult> {
  const poolRef = db.collection("matchPools").doc(areaKey);
  const waitingCol = poolRef.collection("waiting");

  return db.runTransaction(async (tx) => {
    const waitingSnap = await tx.get(waitingCol.orderBy("joinedAt"));
    const waiters = waitingSnap.docs.map((d) => d.data() as Waiter);

    const patchPool = (removed: string[]) => {
      const remaining = waiters.filter((w) => !removed.includes(w.uid));
      const nextDeadline =
        remaining.length >= 2
          ? Math.min(...remaining.map((w) => w.joinedAt)) + RELAX_TIERS[1].afterMs
          : null;
      tx.set(
        poolRef,
        { areaKey, waitingCount: remaining.length, formingDeadline: nextDeadline, updatedAt: now },
        { merge: true },
      );
    };

    const plan = planGroup(waiters, now);
    if (!plan) {
      patchPool([]);
      return null;
    }

    const tableId = `t_${now.toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const members: TableMember[] = plan.members.map((w) => ({ uid: w.uid, displayName: w.displayName }));
    const line = randomLine();

    tx.set(db.collection("teaTables").doc(tableId), {
      spotId: plan.spotId,
      spotName: plan.spotName,
      memberUids: members.map((m) => m.uid),
      members,
      line,
      status: "active",
      createdAt: now,
      meetBy: now + MEET_WINDOW_MS,
      expiresAt: now + TABLE_TTL_MS,
    });

    for (const w of plan.members) {
      tx.set(db.collection("profiles").doc(w.uid), { activeTableId: tableId }, { merge: true });
      tx.set(db.collection("profiles").doc(w.uid).collection("history").doc(tableId), {
        spotName: plan.spotName,
        line,
        members,
        outcome: "active",
        at: now,
      });
      tx.delete(waitingCol.doc(w.uid));
    }

    patchPool(members.map((m) => m.uid));
    return { tableId, uids: members.map((m) => m.uid) };
  });
}

export function tsToMs(v: unknown): number {
  if (v instanceof Timestamp) return v.toMillis();
  if (typeof v === "number") return v;
  return 0;
}
