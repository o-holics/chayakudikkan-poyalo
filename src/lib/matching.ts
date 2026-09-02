import "server-only";
import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { distanceMeters } from "./geo";
import { randomLine } from "./lines";
import {
  MATCH_TIERS,
  MEET_WINDOW_MS,
  RELAX_LEAD_MS,
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

type Chosen = { spotId: string; spotName: string; point: { lat: number; lng: number } };

/**
 * The matcher decides where. A shared explicit preference wins; otherwise pick
 * the cafe (from everyone's nearby options) that's most central to the group,
 * nudged toward ones that show up on more people's lists.
 */
function pickSpot(members: Intent[]): Chosen {
  type Cand = { name: string; lat: number; lng: number; pref: number; opt: number };
  const cands = new Map<string, Cand>();
  const add = (r: { spotId: string; spotName: string; lat: number; lng: number }, kind: "pref" | "opt") => {
    const c = cands.get(r.spotId) ?? { name: r.spotName, lat: r.lat, lng: r.lng, pref: 0, opt: 0 };
    c[kind] += 1;
    cands.set(r.spotId, c);
  };
  for (const m of members) {
    if (m.spotPref) add(m.spotPref, "pref");
    for (const o of m.spotOptions ?? []) add(o, "opt");
  }

  const entries = [...cands.entries()];
  if (entries.length === 0) {
    // No candidates at all — meet at the group's centre with a generic label.
    const lat = members.reduce((s, m) => s + m.point.lat, 0) / members.length;
    const lng = members.reduce((s, m) => s + m.point.lng, 0) / members.length;
    return { spotId: `pt_${lat.toFixed(4)}_${lng.toFixed(4)}`, spotName: "a tea shop nearby", point: { lat, lng } };
  }

  const majority = entries.find(([, c]) => c.pref > members.length / 2);
  const chosen =
    majority ??
    entries
      .map(([id, c]) => {
        const p = { lat: c.lat, lng: c.lng };
        const spread = members.reduce((acc, m) => acc + distanceMeters(p, m.point), 0);
        const score = spread - (c.pref * 1200 + c.opt * 250); // metres of "credit" per vote
        return [id, c, score] as const;
      })
      .sort((a, b) => a[2] - b[2])[0];

  const [id, c] = chosen;
  return { spotId: id, spotName: c.name, point: { lat: c.lat, lng: c.lng } };
}

export type PlannedTable = { members: Intent[]; meetAt: number } & Chosen;

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
        const seedPref = seed.spotPref?.spotId;
        const pa = seedPref && a.spotPref?.spotId === seedPref ? 0 : 1;
        const pb = seedPref && b.spotPref?.spotId === seedPref ? 0 : 1;
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
      // Only seat someone below their chosen size in the final window before the lock.
      const relaxWindow = now >= seed.lockBy - RELAX_LEAD_MS;
      const meetsTrueMin = n >= Math.max(...slice.map((x) => x.sizeMin));
      if (!relaxWindow && !meetsTrueMin) continue;
      tables.push({ members: slice, meetAt: median(slice.map((x) => x.desiredAt)), ...pickSpot(slice) });
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
        spotPoint: plan.point,
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
