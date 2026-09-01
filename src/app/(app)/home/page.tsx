"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useProfile } from "@/lib/useProfile";
import { useNearby } from "@/lib/useNearby";
import { usePoolCounts } from "@/lib/usePools";
import { useActiveTable } from "@/lib/useActiveTable";
import { prettyDistance } from "@/lib/geo";
import { RADIUS_MAX_KM, RADIUS_MIN_KM } from "@/lib/models";
import { Screen, Stack, Title, QuietText, Button, Field } from "@/components/ui";
import { Doodle } from "@/components/Doodle";
import { AppTopBar } from "@/components/AppTopBar";

function RadiusControl({
  km,
  onChange,
}: {
  km: number;
  onChange: (n: number) => void;
}) {
  const btn =
    "flex h-8 w-8 items-center justify-center rounded-full border border-line text-ink transition-opacity active:opacity-60 disabled:opacity-30";
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-ink-soft">how far to look</span>
      <div className="flex items-center gap-3">
        <button type="button" className={btn} onClick={() => onChange(km - 1)} disabled={km <= RADIUS_MIN_KM} aria-label="closer">
          −
        </button>
        <span className="min-w-[3.5ch] text-center text-sm tabular-nums text-ink">{km} km</span>
        <button type="button" className={btn} onClick={() => onChange(km + 1)} disabled={km >= RADIUS_MAX_KM} aria-label="wider">
          +
        </button>
      </div>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h >= 22 || h < 4) return "late one";
  if (h >= 17) return "evening";
  if (h >= 12) return "afternoon";
  return "morning";
}

export default function HomePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const { table } = useActiveTable();
  const { spots, areaLabel, loading, error, radiusKm, run, locate, setRadiusKm, hasLocation } = useNearby();
  const counts = usePoolCounts();

  const [area, setArea] = useState("");
  const [changing, setChanging] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.replace("/");
    else if (!profileLoading && !profile) router.replace("/onboarding");
  }, [authLoading, profileLoading, user, profile, router]);

  return (
    <Screen>
      <AppTopBar />

      <Stack gap={3} className="mt-8">
        <Title>
          {greeting()}, {profile?.displayName ?? "friend"}
        </Title>
        {!table && (
          <QuietText>{areaLabel ? `Tea near ${areaLabel}.` : "Pick a spot and wait for a small table."}</QuietText>
        )}
      </Stack>

      {table ? (
        <Link
          href={`/table/${table.id}`}
          className="mt-8 block rounded-2xl border border-line bg-paper-raised p-5"
        >
          <p className="text-xs uppercase tracking-wide text-ink-soft">your table</p>
          <p className="mt-2 font-mal text-lg text-ink">{table.line.quote}</p>
          <p className="mt-1 text-sm text-ink-soft">
            {table.spotName} · {table.memberUids.length} of you
          </p>
        </Link>
      ) : (
        <div className="mt-8 flex flex-1 flex-col">
          {!hasLocation && (
            <div className="rounded-2xl border border-line p-5">
              <Stack gap={3}>
                <QuietText>We don&apos;t know where you are yet.</QuietText>
                <Button variant="ghost" full onClick={() => locate()}>
                  use my location
                </Button>
              </Stack>
            </div>
          )}

          {hasLocation && (
            <div className="mb-2">
              <RadiusControl km={radiusKm} onChange={setRadiusKm} />
            </div>
          )}

          {loading && <p className="mt-6 text-sm text-ink-soft">looking around…</p>}

          {error && !loading && (
            <div className="mt-6">
              <QuietText>{error}</QuietText>
              <Button variant="quiet" onClick={() => locate()}>
                try again
              </Button>
            </div>
          )}

          {!loading && !error && spots.length === 0 && hasLocation && (
            <div className="mt-10 flex flex-col items-center gap-4 text-center text-ink-soft">
              <Doodle name="kettle" size={72} />
              <p className="text-sm">
                Nothing within {radiusKm} km. Widen the search, or try another area.
              </p>
            </div>
          )}

          <ul className="mt-2 divide-y divide-line">
            {spots.map((s) => {
              const waiting = counts[s.id] ?? 0;
              return (
                <li key={s.id}>
                  <Link href={`/spot/${s.id}`} className="flex items-center justify-between gap-4 py-4">
                    <span className="min-w-0">
                      <span className="block truncate text-ink">{s.name}</span>
                      <span className="mt-0.5 block text-sm text-ink-soft">
                        {prettyDistance(s.distanceM)}
                        {waiting > 0 && ` · ${waiting} waiting`}
                      </span>
                    </span>
                    <span className="text-ink-soft">→</span>
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="mt-auto pt-8">
            {changing ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (area.trim().length >= 2) {
                    run({ q: area.trim() });
                    setChanging(false);
                  }
                }}
              >
                <Stack gap={2}>
                  <Field
                    placeholder="area name"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    autoFocus
                  />
                  <Button variant="quiet" type="submit">
                    look here
                  </Button>
                </Stack>
              </form>
            ) : (
              <button
                type="button"
                className="text-sm text-ink-soft underline decoration-line underline-offset-4"
                onClick={() => setChanging(true)}
              >
                somewhere else?
              </button>
            )}
          </div>
        </div>
      )}
    </Screen>
  );
}
