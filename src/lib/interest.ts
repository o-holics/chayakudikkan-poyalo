import "server-only";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { INTEREST_WINDOW_MS } from "./models";

/** Bump the "people looked for tea here today" counter. Best-effort. */
export async function bumpInterest(db: Firestore, spotId: string, spotName: string): Promise<void> {
  const ref = db.collection("interest").doc(spotId);
  const now = Date.now();
  try {
    const snap = await ref.get();
    const since = snap.exists ? (snap.data()!.since as number) ?? 0 : 0;
    if (!snap.exists || now - since > INTEREST_WINDOW_MS) {
      await ref.set({ spotId, spotName, hits: 1, since: now });
    } else {
      await ref.set({ spotName, hits: FieldValue.increment(1) }, { merge: true });
    }
  } catch {
    /* non-fatal */
  }
}
