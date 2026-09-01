"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebaseClient";
import { useProfile } from "./useProfile";
import type { TeaTable } from "./models";

export type ActiveTableState = { table: TeaTable | null; loading: boolean };

/** Follows profile.activeTableId to the live table doc. */
export function useActiveTable(): ActiveTableState {
  const { profile, loading: profileLoading } = useProfile();
  const [table, setTable] = useState<TeaTable | null>(null);
  const [loading, setLoading] = useState(true);

  const tableId = profile?.activeTableId ?? null;

  useEffect(() => {
    if (profileLoading) return;
    if (!tableId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTable(null);
      setLoading(false);
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    return onSnapshot(
      doc(db, "teaTables", tableId),
      (snap) => {
        setTable(snap.exists() ? ({ id: snap.id, ...(snap.data() as Omit<TeaTable, "id">) }) : null);
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, [tableId, profileLoading]);

  return { table, loading };
}

export function useTable(tableId: string): ActiveTableState {
  const [table, setTable] = useState<TeaTable | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tableId) return;
    return onSnapshot(
      doc(db, "teaTables", tableId),
      (snap) => {
        setTable(snap.exists() ? ({ id: snap.id, ...(snap.data() as Omit<TeaTable, "id">) }) : null);
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, [tableId]);

  return { table, loading };
}
