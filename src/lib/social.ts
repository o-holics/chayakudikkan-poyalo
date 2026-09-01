"use client";

import { addDoc, collection, deleteDoc, doc, setDoc } from "firebase/firestore";
import { db } from "./firebaseClient";

// You meet, then you head home — no friends list. The only social memory the
// app keeps is a private block list and one-way reports.

export async function blockUser(meUid: string, target: { uid: string; displayName: string }) {
  await setDoc(doc(db, "profiles", meUid, "blocks", target.uid), {
    uid: target.uid,
    displayName: target.displayName,
    blockedAt: Date.now(),
  });
}

export async function unblockUser(meUid: string, targetUid: string) {
  await deleteDoc(doc(db, "profiles", meUid, "blocks", targetUid));
}

export async function reportUser(
  meUid: string,
  target: { uid: string; displayName: string },
  reason: string,
  note?: string,
) {
  await addDoc(collection(db, "safetyReports"), {
    reporterUid: meUid,
    reportedUid: target.uid,
    reportedName: target.displayName,
    reason,
    ...(note ? { note: note.slice(0, 500) } : {}),
    createdAt: Date.now(),
  });
}
