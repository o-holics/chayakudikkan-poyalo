"use client";

import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { apiFetch } from "@/lib/api";
import { resetNearbyCache } from "@/lib/useNearby";
import { Button, Field, Stack } from "@/components/ui";
import type { Profile } from "@/lib/models";

export function LocationEditor({ uid, profile }: { uid: string; profile: Profile | null }) {
  const [editing, setEditing] = useState(false);
  const [area, setArea] = useState("");
  const [busy, setBusy] = useState<null | "loc" | "area">(null);
  const [msg, setMsg] = useState<string | null>(null);

  const current = profile?.areaLabel || (profile?.homePoint ? "a saved point" : "not set yet");

  const finish = () => {
    resetNearbyCache();
    setEditing(false);
    setBusy(null);
    setArea("");
    setMsg(null);
  };

  const useHere = () => {
    if (!("geolocation" in navigator)) {
      setMsg("This device won't share a location.");
      return;
    }
    setBusy("loc");
    setMsg(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        let label: string | null = null;
        try {
          label = (await apiFetch<{ label: string | null }>(`/api/geo/reverse?lat=${here.lat}&lng=${here.lng}`)).label;
        } catch {
          /* keep the point even without a name */
        }
        await updateDoc(doc(db, "profiles", uid), { homePoint: here, areaLabel: label ?? "" });
        finish();
      },
      () => {
        setBusy(null);
        setMsg("Couldn't reach your location.");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  };

  const useArea = async () => {
    if (area.trim().length < 2) return;
    setBusy("area");
    setMsg(null);
    try {
      await updateDoc(doc(db, "profiles", uid), { areaLabel: area.trim(), homePoint: null });
      finish();
    } catch {
      setBusy(null);
      setMsg("Couldn't save that.");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-ink">📍 {current}</span>
        <button
          type="button"
          className="text-sm text-ink-soft underline decoration-line underline-offset-4"
          onClick={() => setEditing((v) => !v)}
        >
          {editing ? "cancel" : "change"}
        </button>
      </div>

      {editing && (
        <Stack gap={3} className="mt-4 rounded-xl border border-line p-4">
          <Button variant="ghost" full disabled={busy !== null} onClick={useHere}>
            {busy === "loc" ? "finding you…" : "use my location"}
          </Button>
          <div className="flex items-center gap-3 text-ink-soft">
            <div className="h-px flex-1 bg-line" />
            <span className="text-xs">or</span>
            <div className="h-px flex-1 bg-line" />
          </div>
          <Field placeholder="type an area" value={area} onChange={(e) => setArea(e.target.value)} maxLength={60} />
          <Button full disabled={area.trim().length < 2 || busy !== null} onClick={useArea}>
            {busy === "area" ? "saving…" : "save area"}
          </Button>
          {msg && <span className="text-xs text-ink-soft">{msg}</span>}
        </Stack>
      )}
    </div>
  );
}
