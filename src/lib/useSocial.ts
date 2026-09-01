"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "./firebaseClient";
import { useAuth } from "@/components/AuthProvider";
import type { Blocked, HistoryEntry } from "./models";

function useSub<T>(path: string[] | null, order?: [string, "asc" | "desc"]) {
  const [items, setItems] = useState<T[]>([]);
  const key = path?.join("/") ?? "";
  useEffect(() => {
    if (!path) return;
    const base = collection(db, path[0], ...path.slice(1));
    const q = order ? query(base, orderBy(order[0], order[1])) : base;
    return onSnapshot(
      q,
      (snap) => setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as T)),
      () => setItems([]),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return items;
}

export function useBlocked() {
  const { user } = useAuth();
  return useSub<Blocked & { id: string }>(user ? ["profiles", user.uid, "blocks"] : null);
}

export function useHistory() {
  const { user } = useAuth();
  return useSub<HistoryEntry>(user ? ["profiles", user.uid, "history"] : null, ["at", "desc"]);
}
