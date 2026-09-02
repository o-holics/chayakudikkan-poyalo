"use client";

import { useCallback, useEffect, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebaseClient";
import type { TableMessage } from "./models";

export function useTableChat(tableId: string, me: { uid: string; alias: string } | null) {
  const [messages, setMessages] = useState<TableMessage[]>([]);

  useEffect(() => {
    if (!tableId) return;
    const q = query(collection(db, "teaTables", tableId, "messages"), orderBy("createdAt", "asc"));
    return onSnapshot(
      q,
      (snap) => setMessages(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TableMessage, "id">) }))),
      () => {},
    );
  }, [tableId]);

  const send = useCallback(
    async (text: string) => {
      const clean = text.trim().slice(0, 500);
      if (!clean || !me) return;
      await addDoc(collection(db, "teaTables", tableId, "messages"), {
        senderUid: me.uid,
        senderAlias: me.alias,
        text: clean,
        createdAt: Date.now(),
      });
    },
    [tableId, me],
  );

  return { messages, send };
}

export function usePresence(tableId: string): Record<string, number | null> {
  const [present, setPresent] = useState<Record<string, number | null>>({});

  useEffect(() => {
    if (!tableId) return;
    return onSnapshot(
      collection(db, "teaTables", tableId, "presence"),
      (snap) => {
        const next: Record<string, number | null> = {};
        snap.forEach((d) => (next[d.id] = (d.data().arrivedAt as number | null) ?? null));
        setPresent(next);
      },
      () => {},
    );
  }, [tableId]);

  return present;
}

export async function setArrived(
  tableId: string,
  me: { uid: string; alias: string },
  arrived: boolean,
): Promise<void> {
  await setDoc(
    doc(db, "teaTables", tableId, "presence", me.uid),
    { uid: me.uid, alias: me.alias, arrivedAt: arrived ? Date.now() : null, leftAt: null },
    { merge: true },
  );
}
