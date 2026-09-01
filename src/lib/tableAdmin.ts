import "server-only";
import type { Firestore } from "firebase-admin/firestore";
import type { TableStatus } from "./models";

/**
 * Close a table: stamp its status, release every member's activeTableId,
 * and record the outcome in each member's history.
 */
export async function finalizeTable(
  db: Firestore,
  tableId: string,
  outcome: Exclude<TableStatus, "forming" | "active">,
  memberUids: string[],
  now = Date.now(),
): Promise<void> {
  const batch = db.batch();
  batch.set(db.collection("teaTables").doc(tableId), { status: outcome, closedAt: now }, { merge: true });

  for (const uid of memberUids) {
    const profileRef = db.collection("profiles").doc(uid);
    const snap = await profileRef.get();
    if (snap.exists && snap.data()!.activeTableId === tableId) {
      batch.set(profileRef, { activeTableId: null }, { merge: true });
    }
    batch.set(
      profileRef.collection("history").doc(tableId),
      { outcome, at: now },
      { merge: true },
    );
  }

  await batch.commit();
}
