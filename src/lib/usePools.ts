"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebaseClient";
import { useAuth } from "@/components/AuthProvider";
import { INTEREST_WINDOW_MS } from "./models";

/** Live { areaKey -> waitingCount } across all pools. */
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

/** Live { spotId -> hits today } from the interest counters. */
export function useSpotInterest(): Record<string, number> {
  const { user } = useAuth();
  const [interest, setInterest] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      collection(db, "interest"),
      (snap) => {
        const now = Date.now();
        const next: Record<string, number> = {};
        snap.forEach((d) => {
          const v = d.data();
          const fresh = now - ((v.since as number) ?? 0) < INTEREST_WINDOW_MS;
          if (fresh && (v.hits as number) > 0) next[d.id] = v.hits as number;
        });
        setInterest(next);
      },
      () => setInterest({}),
    );
  }, [user]);

  return interest;
}

export type PoolStatus = {
  count: number;
  formingDeadline: number | null;
  waiters: { displayName: string; spotName: string }[];
  spotNames: string[];
  mine: boolean;
  myJoinedAt: number | null;
  myRelaxed: boolean;
  loading: boolean;
};

/** Live status of one area pool + its waiting list. */
export function usePoolStatus(areaKey: string | null): PoolStatus {
  const { user } = useAuth();
  const [formingDeadline, setDeadline] = useState<number | null>(null);
  const [waiters, setWaiters] = useState<{ displayName: string; spotName: string }[]>([]);
  const [mine, setMine] = useState(false);
  const [myJoinedAt, setMyJoinedAt] = useState<number | null>(null);
  const [myRelaxed, setMyRelaxed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !areaKey) return;
    const unsubPool = onSnapshot(doc(db, "matchPools", areaKey), (snap) => {
      setDeadline((snap.data()?.formingDeadline as number | null) ?? null);
    });
    const unsubWaiting = onSnapshot(
      collection(db, "matchPools", areaKey, "waiting"),
      (snap) => {
        setWaiters(
          snap.docs.map((x) => ({
            displayName: (x.data().displayName as string) ?? "someone",
            spotName: (x.data().spotName as string) ?? "",
          })),
        );
        const me = snap.docs.find((x) => x.id === user.uid);
        setMine(Boolean(me));
        setMyJoinedAt((me?.data().joinedAt as number) ?? null);
        setMyRelaxed(me?.data().relaxedMin != null);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => {
      unsubPool();
      unsubWaiting();
    };
  }, [user, areaKey]);

  const spotNames = useMemo(
    () => Array.from(new Set(waiters.map((w) => w.spotName).filter(Boolean))),
    [waiters],
  );

  return {
    count: waiters.length,
    formingDeadline,
    waiters,
    spotNames,
    mine,
    myJoinedAt,
    myRelaxed,
    loading,
  };
}
