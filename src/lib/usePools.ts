"use client";

import { useEffect, useState } from "react";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebaseClient";
import { useAuth } from "@/components/AuthProvider";

/** Live { spotId -> waitingCount } across all pools. */
export function usePoolCounts(): Record<string, number> {
  const { user } = useAuth();
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      collection(db, "matchPools"),
      (snap) => {
        const next: Record<string, number> = {};
        snap.forEach((d) => {
          const c = (d.data().waitingCount as number) ?? 0;
          if (c > 0) next[d.id] = c;
        });
        setCounts(next);
      },
      () => setCounts({}),
    );
  }, [user]);

  return counts;
}

export type PoolStatus = {
  spotName: string | null;
  count: number;
  formingDeadline: number | null;
  waiters: { displayName: string }[];
  mine: boolean;
  loading: boolean;
};

/** Live status of one pool + its waiting list. */
export function usePoolStatus(spotId: string): PoolStatus {
  const { user } = useAuth();
  const [spotName, setSpotName] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const [formingDeadline, setDeadline] = useState<number | null>(null);
  const [waiters, setWaiters] = useState<{ displayName: string }[]>([]);
  const [mine, setMine] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !spotId) return;
    const unsubPool = onSnapshot(doc(db, "matchPools", spotId), (snap) => {
      const d = snap.data();
      setSpotName((d?.spotName as string) ?? null);
      setCount((d?.waitingCount as number) ?? 0);
      setDeadline((d?.formingDeadline as number | null) ?? null);
    });
    const unsubWaiting = onSnapshot(
      collection(db, "matchPools", spotId, "waiting"),
      (snap) => {
        setWaiters(snap.docs.map((x) => ({ displayName: (x.data().displayName as string) ?? "someone" })));
        setMine(snap.docs.some((x) => x.id === user.uid));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => {
      unsubPool();
      unsubWaiting();
    };
  }, [user, spotId]);

  return { spotName, count, formingDeadline, waiters, mine, loading };
}
