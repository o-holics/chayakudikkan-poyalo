"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { apiFetch, ApiError } from "@/lib/api";
import { MIN_LEAD_MS, type TeaSpot } from "@/lib/models";
import { cachedSpot, type NearbySpot } from "@/lib/useNearby";
import { usePendingIntent, useSpotInterest } from "@/lib/useTea";
import { useActiveTable } from "@/lib/useActiveTable";
import { Screen, Stack, Title, QuietText, Button, BottomAction } from "@/components/ui";
import { Doodle } from "@/components/Doodle";
import { AppTopBar } from "@/components/AppTopBar";

function timeSlots(now: number): { at: number; label: string }[] {
  const slots: { at: number; label: string }[] = [];
  for (let day = 0; day <= 1; day += 1) {
    const base = new Date(now);
    base.setDate(base.getDate() + day);
    for (let h = 16; h <= 23; h += 1) {
      const d = new Date(base);
      d.setHours(h, 0, 0, 0);
      const at = d.getTime();
      if (at < now + MIN_LEAD_MS) continue;
      const hr = h % 12 === 0 ? 12 : h % 12;
      const ampm = h < 12 ? "am" : "pm";
      slots.push({ at, label: `${day === 0 ? "today" : "tomorrow"} ${hr} ${ampm}` });
    }
  }
  return slots.slice(0, 12);
}

export default function SpotPage() {
  const router = useRouter();
  const { id: spotId } = useParams<{ id: string }>();

  const [spot, setSpot] = useState<(TeaSpot | NearbySpot) | null>(() => cachedSpot(spotId) ?? null);
  const [notFound, setNotFound] = useState(false);
  const [picking, setPicking] = useState(false);
  const [chosen, setChosen] = useState<number | null>(null);
  const [pairOk, setPairOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { table } = useActiveTable();
  const { intent } = usePendingIntent();
  const interest = useSpotInterest();
  const [slots, setSlots] = useState<{ at: number; label: string }[]>([]);
  const lookedToday = interest[spotId] ?? 0;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSlots(timeSlots(Date.now()));
  }, []);

  useEffect(() => {
    if (spot) return;
    getDoc(doc(db, "teaSpots", spotId))
      .then((snap) => (snap.exists() ? setSpot(snap.data() as TeaSpot) : setNotFound(true)))
      .catch(() => setNotFound(true));
  }, [spot, spotId]);

  useEffect(() => {
    if (table) router.replace(`/table/${table.id}`);
    else if (intent) router.replace("/home");
  }, [table, intent, router]);

  const declare = async () => {
    if (!spot || chosen == null) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ status: string; tableId?: string }>("/api/tea/declare", {
        method: "POST",
        body: {
          spotId,
          spotName: spot.name,
          point: { lat: spot.lat, lng: spot.lng },
          desiredAt: chosen,
          pairOk,
        },
      });
      if (res.status === "matched" && res.tableId) router.replace(`/table/${res.tableId}`);
      else router.replace("/home");
    } catch (e) {
      if (e instanceof ApiError && e.code === "ADMIN_NOT_CONFIGURED") {
        setError("Tables aren't switched on yet. Hang tight — this is being set up.");
      } else {
        setError(e instanceof Error ? e.message : "Couldn't note that down.");
      }
      setBusy(false);
    }
  };

  if (notFound) {
    return (
      <Screen>
        <AppTopBar back="/home" />
        <div className="mt-16 flex flex-col items-center gap-4 text-center text-ink-soft">
          <Doodle name="pin" size={72} />
          <QuietText>Open this one from the list on home.</QuietText>
        </div>
      </Screen>
    );
  }

  return (
    <Screen>
      <AppTopBar back="/home" />

      <div className="mt-10 flex flex-1 flex-col">
        <Doodle name="cup" size={64} className="text-ink-soft" />
        <Stack gap={3} className="mt-6">
          <Title>{spot?.name ?? "…"}</Title>
          {spot?.address && <QuietText>{spot.address}</QuietText>}
          {!picking && (
            <QuietText>
              {lookedToday > 1
                ? `${lookedToday} people looked for tea here today.`
                : "Say when you'd like to sit down. We'll gather a small table and lock it in 45 minutes before, so everyone can get there."}
            </QuietText>
          )}
        </Stack>

        {picking && (
          <div className="mt-8">
            <p className="mb-3 text-sm text-ink-soft">when do you want to sit down?</p>
            <div className="flex flex-wrap gap-2">
              {slots.map((s) => (
                <button
                  key={s.at}
                  type="button"
                  onClick={() => setChosen(s.at)}
                  className={`rounded-full border px-3.5 py-2 text-sm transition-colors ${
                    chosen === s.at ? "border-ink bg-ink text-paper" : "border-line text-ink"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <label className="mt-5 flex items-center gap-3 text-sm text-ink">
              <input
                type="checkbox"
                checked={pairOk}
                onChange={(e) => setPairOk(e.target.checked)}
                className="accent-ink"
              />
              a pair is fine if it&apos;s quiet
            </label>
          </div>
        )}

        {error && <p className="mt-6 text-sm text-ink">{error}</p>}

        <BottomAction>
          {picking ? (
            <Stack gap={2}>
              <Button full disabled={busy || chosen == null} onClick={declare}>
                {busy ? "noting it down…" : "I'm up for tea"}
              </Button>
              <Button variant="quiet" onClick={() => setPicking(false)}>
                back
              </Button>
            </Stack>
          ) : (
            <Button full disabled={!spot} onClick={() => setPicking(true)}>
              I&apos;m up for tea here
            </Button>
          )}
        </BottomAction>
      </div>
    </Screen>
  );
}
