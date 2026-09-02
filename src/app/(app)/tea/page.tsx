"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api";
import {
  latestDesiredAt,
  MIN_LEAD_MS,
  RELAX_LEAD_MS,
  TRAVEL_LEAD_MS,
  type SpotRef,
} from "@/lib/models";
import { useProfile } from "@/lib/useProfile";
import { useNearby } from "@/lib/useNearby";
import { usePendingIntent } from "@/lib/useTea";
import { useActiveTable } from "@/lib/useActiveTable";
import { Screen, Stack, Title, QuietText, Button, BottomAction } from "@/components/ui";
import { Doodle } from "@/components/Doodle";
import { AppTopBar } from "@/components/AppTopBar";

const RELAX_MINUTES = Math.round((TRAVEL_LEAD_MS + RELAX_LEAD_MS) / 60000);

function timeSlots(now: number) {
  const latest = latestDesiredAt(now);
  const earliest = now + MIN_LEAD_MS;
  const start = new Date(earliest);
  start.setMinutes(0, 0, 0);
  if (start.getTime() < earliest) start.setHours(start.getHours() + 1);
  const today = new Date(now).getDate();
  const out: { at: number; label: string }[] = [];
  for (let t = start.getTime(); t <= latest && out.length < 16; t += 3_600_000) {
    const d = new Date(t);
    const hr = d.getHours() % 12 === 0 ? 12 : d.getHours() % 12;
    const ampm = d.getHours() < 12 ? "am" : "pm";
    out.push({ at: t, label: `${d.getDate() === today ? "" : "tomorrow "}${hr} ${ampm}` });
  }
  return out;
}

function toLocalInput(ms: number): string {
  const d = new Date(ms);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function TeaPage() {
  const router = useRouter();
  const { profile } = useProfile();
  const { spots, areaLabel, center, loading: nearbyLoading, locate, hasLocation } = useNearby();
  const { intent } = usePendingIntent();
  const { table } = useActiveTable();

  const [slots, setSlots] = useState<{ at: number; label: string }[]>([]);
  const [bounds, setBounds] = useState<{ min: number; max: number } | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const [custom, setCustom] = useState(false);
  const [pref, setPref] = useState<SpotRef | null>(null);
  const [showSpots, setShowSpots] = useState(false);
  const [pairOk, setPairOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const now = Date.now();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSlots(timeSlots(now));
    setBounds({ min: now + MIN_LEAD_MS, max: latestDesiredAt(now) });
  }, []);

  useEffect(() => {
    if (table) router.replace(`/table/${table.id}`);
    else if (intent) router.replace("/home");
  }, [table, intent, router]);

  const point = profile?.homePoint ?? center ?? null;
  const spotOptions: SpotRef[] = spots
    .slice(0, 8)
    .map((s) => ({ spotId: s.id, spotName: s.name, lat: s.lat, lng: s.lng }));
  const canDeclare = chosen != null && (point != null || spotOptions.length > 0);

  const declare = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ status: string; tableId?: string }>("/api/tea/declare", {
        method: "POST",
        body: {
          point,
          areaLabel,
          spotPref: pref,
          spotOptions,
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

  return (
    <Screen>
      <AppTopBar back="/home" />

      <div className="mt-10 flex flex-1 flex-col">
        <Doodle name="cup" size={60} className="text-ink-soft" />
        <Stack gap={3} className="mt-6">
          <Title>up for tea?</Title>
          <QuietText>
            Say when. We&apos;ll gather a small table {areaLabel ? `near ${areaLabel}` : "near you"}, pick the
            spot, and lock it in 45 minutes before so everyone can get there.
          </QuietText>
        </Stack>

        {!hasLocation && !point ? (
          <div className="mt-8 rounded-2xl border border-line p-5">
            <Stack gap={3}>
              <QuietText>We need a rough idea of where you are first.</QuietText>
              <Button variant="ghost" full onClick={() => locate()}>
                use my location
              </Button>
            </Stack>
          </div>
        ) : (
          <div className="mt-8">
            <p className="mb-3 text-sm text-ink-soft">when do you want to sit down?</p>

            {!custom ? (
              <>
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
                <button
                  type="button"
                  className="mt-3 text-sm text-ink-soft underline decoration-line underline-offset-4"
                  onClick={() => {
                    setCustom(true);
                    setChosen(null);
                  }}
                >
                  pick an exact time
                </button>
              </>
            ) : (
              bounds && (
                <div>
                  <input
                    type="datetime-local"
                    min={toLocalInput(bounds.min)}
                    max={toLocalInput(bounds.max)}
                    onChange={(e) => {
                      const t = e.target.value ? new Date(e.target.value).getTime() : NaN;
                      setChosen(Number.isFinite(t) ? t : null);
                    }}
                    className="w-full rounded-xl border border-line bg-paper-raised px-4 py-3 text-base text-ink focus:border-ink focus:outline-none"
                  />
                  <p className="mt-2 text-xs text-ink-soft">from an hour out through tomorrow 6 am</p>
                  <button
                    type="button"
                    className="mt-2 text-sm text-ink-soft underline decoration-line underline-offset-4"
                    onClick={() => {
                      setCustom(false);
                      setChosen(null);
                    }}
                  >
                    back to quick times
                  </button>
                </div>
              )
            )}

            {/* optional spot preference */}
            <div className="mt-6">
              {pref ? (
                <p className="text-sm text-ink">
                  prefer <span className="font-medium">{pref.spotName}</span>{" "}
                  <button
                    type="button"
                    className="text-ink-soft underline decoration-line underline-offset-4"
                    onClick={() => setPref(null)}
                  >
                    clear
                  </button>
                </p>
              ) : showSpots ? (
                <div>
                  <p className="mb-2 text-sm text-ink-soft">a place you&apos;d like it to be</p>
                  {nearbyLoading ? (
                    <p className="text-sm text-ink-soft">looking around…</p>
                  ) : (
                    <ul className="max-h-52 divide-y divide-line overflow-y-auto rounded-xl border border-line">
                      {spots.map((s) => (
                        <li key={s.id}>
                          <button
                            type="button"
                            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-ink"
                            onClick={() => {
                              setPref({ spotId: s.id, spotName: s.name, lat: s.lat, lng: s.lng });
                              setShowSpots(false);
                            }}
                          >
                            <span className="truncate">{s.name}</span>
                            <span className="text-ink-soft">→</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <button
                    type="button"
                    className="mt-2 text-sm text-ink-soft underline decoration-line underline-offset-4"
                    onClick={() => setShowSpots(false)}
                  >
                    never mind, you choose
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="text-sm text-ink-soft underline decoration-line underline-offset-4"
                  onClick={() => setShowSpots(true)}
                >
                  somewhere specific?
                </button>
              )}
            </div>

            <label className="mt-6 flex items-start gap-3 text-sm text-ink">
              <input
                type="checkbox"
                checked={pairOk}
                onChange={(e) => setPairOk(e.target.checked)}
                className="mt-0.5 accent-ink"
              />
              <span>
                a pair is fine if it&apos;s still quiet
                <span className="block text-xs text-ink-soft">
                  only in the last ~{RELAX_MINUTES} min before your time
                </span>
              </span>
            </label>
          </div>
        )}

        {error && <p className="mt-6 text-sm text-ink">{error}</p>}

        <BottomAction>
          <Stack gap={2}>
            <Button full disabled={busy || !canDeclare} onClick={declare}>
              {busy ? "noting it down…" : "I'm up for tea"}
            </Button>
            <Button variant="quiet" onClick={() => router.back()}>
              back
            </Button>
          </Stack>
        </BottomAction>
      </div>
    </Screen>
  );
}
