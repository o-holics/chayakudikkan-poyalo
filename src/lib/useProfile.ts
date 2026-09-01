"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebaseClient";
import { useAuth } from "@/components/AuthProvider";
import type { Profile } from "./models";

export type ProfileState = { profile: Profile | null; loading: boolean };

export function useProfile(): ProfileState {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProfile(null);
      setLoading(false);
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const unsub = onSnapshot(
      doc(db, "profiles", user.uid),
      (snap) => {
        setProfile(snap.exists() ? (snap.data() as Profile) : null);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [user, authLoading]);

  return { profile, loading };
}
