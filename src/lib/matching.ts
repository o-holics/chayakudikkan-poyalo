import "server-only";
import { FieldValue, type Firestore, Timestamp } from "firebase-admin/firestore";
import { randomLine } from "./lines";
import {
  FORMING_WINDOW_MS,
  MEET_WINDOW_MS,
  SIZE_MAX,
  SIZE_MIN,
  TABLE_TTL_MS,
  type PoolWaiter,
  type TableMember,
} from "./models";

export type Waiter = PoolWaiter;

/** Do two waiters have a block edge either way? */
function blocked(a: Waiter, b: Waiter): boolean {
  return a.blockedUids?.includes(b.uid) || b.blockedUids?.includes(a.uid);
}

/**
 * Choose who sits, oldest first, skipping block conflicts. Returns the seated
 * slice (3..6) whose size suits every member, or null if no table is possible.
 */
export function chooseSeating(waiters: Waiter[]): Waiter[] | null {
  const ordered = [...waiters].sort((a, b) => a.joinedAt - b.joinedAt);

  const chosen: Waiter[] = [];
  for (const w of ordered) {
    if (chosen.length >= SIZE_MAX) break;
    if (chosen.some((c) => blocked(c, w))) continue;
    chosen.push(w);
  }

  for (let n = Math.min(SIZE_MAX, chosen.length); n >= SIZE_MIN; n--) {
    const slice = chosen.slice(0, n);
    if (slice.every((w) => n >= w.sizeMin && n <= w.sizeMax)) return slice;
  }
  return null;
}

type FormResult = { tableId: string; uids: string[] } | null;

/**
 * One matching pass for a spot, inside a transaction.
 * mode "eager" (on join): only forms when a table of ≥5 is ready, or the whole
 * pool forms one happy table. mode "deadline" (on tick): forms the best table
 * it can once the soft window has passed.
 */
export async function runPoolPass(
  db: Firestore,
  spotId: string,
  spotName: string,
  mode: "eager" | "deadline",
  now = Date.now(),
): Promise<FormResult> {
  const poolRef = db.collection("matchPools").doc(spotId);
  const waitingCol = poolRef.collection("waiting");

  return db.runTransaction(async (tx) => {
    const poolSnap = await tx.get(poolRef);
    const waitingSnap = await tx.get(waitingCol.orderBy("joinedAt"));
    const waiters = waitingSnap.docs.map((d) => d.data() as Waiter);

    const pool = poolSnap.exists ? poolSnap.data()! : null;
    const deadline: number | null = pool?.formingDeadline ?? null;

    const patchPool = (formedCount: number) => {
      const remaining = waiters.length - formedCount;
      const nextDeadline =
        remaining >= SIZE_MIN
          ? formedCount > 0
            ? now + FORMING_WINDOW_MS
            : (deadline ?? now + FORMING_WINDOW_MS)
          : null;
      tx.set(
        poolRef,
        {
          spotId,
          spotName,
          waitingCount: remaining,
          formingDeadline: nextDeadline,
          lockUntil: null,
          updatedAt: now,
        },
        { merge: true },
      );
    };

    if (waiters.length < SIZE_MIN) {
      patchPool(0);
      return null;
    }

    const seating = chooseSeating(waiters);

    const shouldForm =
      seating !== null &&
      (mode === "deadline"
        ? deadline !== null && now >= deadline
        : seating.length >= 5 || seating.length === waiters.length);

    if (!seating || !shouldForm) {
      patchPool(0);
      return null;
    }

    const tableId = `t_${now.toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const tableRef = db.collection("teaTables").doc(tableId);
    const members: TableMember[] = seating.map((w) => ({ uid: w.uid, displayName: w.displayName }));
    const line = randomLine();

    tx.set(tableRef, {
      spotId,
      spotName,
      memberUids: members.map((m) => m.uid),
      members,
      line,
      status: "active",
      createdAt: now,
      meetBy: now + MEET_WINDOW_MS,
      expiresAt: now + TABLE_TTL_MS,
    });

    for (const w of seating) {
      tx.set(
        db.collection("profiles").doc(w.uid),
        { activeTableId: tableId },
        { merge: true },
      );
      tx.set(db.collection("profiles").doc(w.uid).collection("history").doc(tableId), {
        spotName,
        line,
        members,
        outcome: "active",
        at: now,
      });
      tx.delete(waitingCol.doc(w.uid));
    }

    patchPool(seating.length);
    return { tableId, uids: members.map((m) => m.uid) };
  });
}

export function tsToMs(v: unknown): number {
  if (v instanceof Timestamp) return v.toMillis();
  if (typeof v === "number") return v;
  return 0;
}

export { FieldValue, SIZE_MIN, SIZE_MAX };
