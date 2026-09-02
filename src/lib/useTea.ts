"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "./firebaseClient";
import { useAuth } from "@/components/AuthProvider";
import { INTEREST_WINDOW_MS, type TeaIntent } from "./models";

/** The current user's pending "up for tea" intent, if any. */
export function usePendingIntent(): { intent: TeaIntent | null; loading: boolean } {
  const { user } = useAuth();
  const [intent, setIntent] = useState<TeaIntent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIntent(null);
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, "teaIntents"),
      where("uid", "==", user.uid),
      where("status", "==", "pending"),
    );
    return onSnapshot(
      q,
      (snap) => {
        const d = snap.docs[0];
        setIntent(d ? ({ id: d.id, ...(d.data() as Omit<TeaIntent, "id">) }) : null);
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, [user]);

  return { intent, loading };
}

/** Live { areaKey -> people up for tea } from the server-kept aggregate. */
export function useAreaDemand(): Record<string, number> {
  const { user } = useAuth();
  const [demand, setDemand] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      collection(db, "areaDemand"),
      (snap) => {
        const next: Record<string, number> = {};
        snap.forEach((d) => {
          const n = (d.data().pending as number) ?? 0;
          if (n > 0) next[d.id] = n;
        });
        setDemand(next);
      },
      () => setDemand({}),
    );
  }, [user]);

  return demand;
}

/** Live { spotId -> people who looked here today }. */
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
          if (now - ((v.since as number) ?? 0) < INTEREST_WINDOW_MS && (v.hits as number) > 0) {
            next[d.id] = v.hits as number;
          }
        });
        setInterest(next);
      },
      () => setInterest({}),
    );
  }, [user]);

  return interest;
}
