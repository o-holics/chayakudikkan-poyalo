import "server-only";
import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { distanceMeters } from "./geo";
import { randomLine } from "./lines";
import {
  MATCH_TIERS,
  MEET_WINDOW_MS,
  SIZE_MAX,
  TABLE_TTL_MS,
  TIME_CLUSTER_MS,
  type TableMember,
  type TeaIntent,
} from "./models";

export type Intent = TeaIntent;

function blocked(a: Intent, b: Intent): boolean {
  return Boolean(a.blockedUids?.includes(b.uid) || b.blockedUids?.includes(a.uid));
}

/** The smallest table this person will accept. */
function minFor(i: Intent): number {
  return Math.max(2, i.relaxedMin ?? i.sizeMin);
}

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

/** Where the group meets: shared preference wins, else the most central pick. */
function pickSpot(members: Intent[]): { spotId: string; spotName: string } {
  const votes = new Map<string, { name: string; n: number }>();
  for (const m of members) {
    const v = votes.get(m.spotId) ?? { name: m.spotName, n: 0 };
    v.n += 1;
    votes.set(m.spotId, v);
  }
  let top: [string, { name: string; n: number }] | undefined;
  for (const e of votes) if (!top || e[1].n > top[1].n) top = e;
  if (top && top[1].n > members.length / 2) return { spotId: top[0], spotName: top[1].name };

  let pick = [...votes.keys()][0];
  let pickName = votes.get(pick)!.name;
  let bestSum = Infinity;
  for (const c of votes.keys()) {
    const p = members.find((m) => m.spotId === c)!.point;
    const sum = members.reduce((acc, m) => acc + distanceMeters(p, m.point), 0);
    if (sum < bestSum) {
      bestSum = sum;
      pick = c;
      pickName = votes.get(c)!.name;
    }
  }
  return { spotId: pick, spotName: pickName };
}

export type PlannedTable = { members: Intent[]; spotId: string; spotName: string; meetAt: number };

/**
 * Try to form tables from the pending intents of one area.
 * Before an intent's lockBy we hold out for its owner's true sizeMin; once
 * lockBy passes we form the best table possible within everyone's minimum.
 */
export function planTables(intents: Intent[], now: number): { tables: PlannedTable[]; expire: string[] } {
  const pending = [...intents].sort((a, b) => a.lockBy - b.lockBy || a.desiredAt - b.desiredAt);
  const grouped = new Set<string>();
  const tables: PlannedTable[] = [];

  const earliestLockBy = Math.min(...pending.map((i) => i.lockBy));
  const leadLeft = earliestLockBy - now;
  const tier = MATCH_TIERS.find((t) => leadLeft > t.leadMsLeft) ?? MATCH_TIERS[MATCH_TIERS.length - 1];

  for (const seed of pending) {
    if (grouped.has(seed.uid)) continue;

    const cands = pending
      .filter(
        (c) =>
          c.uid !== seed.uid &&
          !grouped.has(c.uid) &&
          !blocked(seed, c) &&
          Math.abs(c.desiredAt - seed.desiredAt) <= TIME_CLUSTER_MS &&
          distanceMeters(seed.point, c.point) <= tier.clusterM,
      )
      .sort((a, b) => {
        const pa = a.spotId === seed.spotId ? 0 : 1;
        const pb = b.spotId === seed.spotId ? 0 : 1;
        if (pa !== pb) return pa - pb;
        const ta = Math.abs(a.desiredAt - seed.desiredAt);
        const tb = Math.abs(b.desiredAt - seed.desiredAt);
        if (ta !== tb) return ta - tb;
        return distanceMeters(seed.point, a.point) - distanceMeters(seed.point, b.point);
      });

    const chosen: Intent[] = [seed];
    for (const c of cands) {
      if (chosen.length >= SIZE_MAX) break;
      if (chosen.some((x) => blocked(x, c))) continue;
      if (chosen.length + 1 > Math.min(...chosen.concat(c).map((x) => x.sizeMax))) continue;
      chosen.push(c);
    }

    const cap = Math.min(SIZE_MAX, ...chosen.map((x) => x.sizeMax));
    for (let n = Math.min(cap, chosen.length); n >= 2; n -= 1) {
      const slice = chosen.slice(0, n);
      if (n < Math.max(...slice.map(minFor))) continue;
      const urgent = now >= seed.lockBy;
      const meetsTrueMin = n >= Math.max(...slice.map((x) => x.sizeMin));
      if (!urgent && !meetsTrueMin) continue;
      const spot = pickSpot(slice);
      tables.push({ members: slice, meetAt: median(slice.map((x) => x.desiredAt)), ...spot });
      slice.forEach((x) => grouped.add(x.uid));
      break;
    }
  }

  const expire = pending
    .filter((i) => !grouped.has(i.uid) && now >= i.lockBy)
    .map((i) => i.id);

  return { tables, expire };
}

export type MatchResult = { formed: number; expired: number };

export async function matchArea(db: Firestore, areaKey: string, now = Date.now()): Promise<MatchResult> {
  const intentsCol = db.collection("teaIntents");

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(
      intentsCol.where("areaKey", "==", areaKey).where("status", "==", "pending").limit(40),
    );
    const intents = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Intent, "id">) }));
    if (intents.length === 0) return { formed: 0, expired: 0 };

    const { tables, expire } = planTables(intents, now);

    for (const plan of tables) {
      const tableId = `t_${now.toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      const members: TableMember[] = plan.members.map((m) => ({ uid: m.uid, displayName: m.displayName }));
      const line = randomLine();

      tx.set(db.collection("teaTables").doc(tableId), {
        spotId: plan.spotId,
        spotName: plan.spotName,
        memberUids: members.map((m) => m.uid),
        members,
        line,
        status: "active",
        createdAt: now,
        meetAt: plan.meetAt,
        meetBy: plan.meetAt + MEET_WINDOW_MS,
        expiresAt: plan.meetAt + TABLE_TTL_MS,
      });

      for (const m of plan.members) {
        tx.set(db.collection("profiles").doc(m.uid), { activeTableId: tableId }, { merge: true });
        tx.set(db.collection("profiles").doc(m.uid).collection("history").doc(tableId), {
          spotName: plan.spotName,
          line,
          members,
          outcome: "active",
          at: now,
        });
        tx.set(intentsCol.doc(m.id), { status: "matched", tableId, matchedAt: now }, { merge: true });
      }
    }

    for (const id of expire) {
      tx.set(intentsCol.doc(id), { status: "expired", expiredAt: now }, { merge: true });
    }

    const goneIds = new Set([...tables.flatMap((t) => t.members.map((m) => m.id)), ...expire]);
    const remaining = intents.filter((i) => !goneIds.has(i.id)).length;
    tx.set(db.collection("areaDemand").doc(areaKey), { pending: remaining, updatedAt: now });

    return { formed: tables.length, expired: expire.length };
  });
}

/** Refresh the "people up for tea near here" aggregate for one area. */
export async function recountArea(db: Firestore, areaKey: string, now = Date.now()): Promise<void> {
  const snap = await db
    .collection("teaIntents")
    .where("areaKey", "==", areaKey)
    .where("status", "==", "pending")
    .get();
  await db.collection("areaDemand").doc(areaKey).set({ pending: snap.size, updatedAt: now });
}

export function tsToMs(v: unknown): number {
  if (v instanceof Timestamp) return v.toMillis();
  if (typeof v === "number") return v;
  return 0;
}
