"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { useProfile } from "@/lib/useProfile";
import { useNearby } from "@/lib/useNearby";
import { useHistory } from "@/lib/useSocial";
import { useAreaDemand, useSpotInterest, usePendingIntent } from "@/lib/useTea";
import { useActiveTable } from "@/lib/useActiveTable";
import { geohash, prettyDistance } from "@/lib/geo";
import { AREA_GEOHASH_PRECISION } from "@/lib/models";
import { Screen, Stack, Title, QuietText, Button, BottomAction } from "@/components/ui";
import { Doodle } from "@/components/Doodle";
import { AppTopBar } from "@/components/AppTopBar";
import { TeaGame } from "@/components/TeaGame";

function greeting() {
  const h = new Date().getHours();
  if (h >= 22 || h < 4) return "late one";
  if (h >= 17) return "evening";
  if (h >= 12) return "afternoon";
  return "morning";
}

function clock(ms: number) {
  return new Date(ms).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function GamePanel({ open, onToggle }: { open: boolean; onToggle: (v: boolean) => void }) {
  return open ? (
    <div className="rounded-2xl border border-line bg-paper-raised p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">pass the time</span>
        <button
          type="button"
          className="text-xs text-ink-soft underline decoration-line underline-offset-4 hover:text-ink"
          onClick={() => onToggle(false)}
        >
          hide
        </button>
      </div>
      <TeaGame />
    </div>
  ) : (
    <button
      type="button"
      className="flex w-full items-center justify-between rounded-2xl border border-line bg-paper-raised p-4 text-left transition-colors hover:border-ink/30"
      onClick={() => onToggle(true)}
    >
      <div className="flex items-center gap-3">
        <Doodle name="cup" size={24} className="text-ink-soft" />
        <div>
          <p className="text-sm font-medium text-ink">pass a minute?</p>
          <p className="text-xs text-ink-soft">play a quick memory game while waiting</p>
        </div>
      </div>
      <span className="text-xs font-medium text-ink-soft">play →</span>
    </button>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const { table } = useActiveTable();
  const { intent } = usePendingIntent();
  const { spots, areaLabel, center, loading: spotsLoading } = useNearby();
  const history = useHistory();
  const demand = useAreaDemand();
  const interest = useSpotInterest();

  const [cancelling, setCancelling] = useState(false);
  const [showGame, setShowGame] = useState(false);

  const myPoint = profile?.homePoint ?? center ?? null;
  const myArea = myPoint ? geohash(myPoint.lat, myPoint.lng, AREA_GEOHASH_PRECISION) : null;
  const upNearby = myArea ? (demand[myArea] ?? 0) : 0;
  const lookedNearby = spots.reduce((n, s) => n + (interest[s.id] ?? 0), 0);
  const liquidity =
    upNearby > (intent ? 1 : 0)
      ? `${upNearby} ${upNearby === 1 ? "person is" : "people are"} up for tea near you`
      : lookedNearby > 2
        ? `${lookedNearby} people looked for tea near you today`
        : null;
  const lastCup = history.find((h) => h.outcome === "met");

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.replace("/");
    else if (!profileLoading && !profile) router.replace("/onboarding");
  }, [authLoading, profileLoading, user, profile, router]);

  const cancelIntent = async () => {
    setCancelling(true);
    try {
      await apiFetch("/api/tea/cancel", { method: "POST" });
    } catch {
      /* ignore */
    }
    setCancelling(false);
  };

  return (
    <Screen wide>
      <AppTopBar />

      <Stack gap={2} className="mt-6">
        <Title>
          {greeting()}, {profile?.displayName ?? "friend"}
        </Title>
        {liquidity && <QuietText>{liquidity}.</QuietText>}
      </Stack>

      {table ? (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12 pb-24">
          <div className="lg:col-span-7">
            <Link href={`/table/${table.id}`} className="block rounded-2xl border border-line bg-paper-raised p-6 shadow-sm transition-all hover:border-ink/30">
              <p className="text-xs uppercase tracking-wide text-ink-soft">your table · say the line</p>
              <p className="mt-3 font-mal text-2xl leading-snug text-ink">{table.line.quote}</p>
              <p className="mt-2 text-sm text-ink-soft">
                {table.line.translit} — {table.line.film}
              </p>
              <p className="mt-4 text-sm font-medium text-ink">
                {table.spotName}
                {table.meetAt ? ` · around ${clock(table.meetAt)}` : ""} · {table.memberUids.length} of you
              </p>
            </Link>
          </div>
          <div className="lg:col-span-5">
            <GamePanel open={showGame} onToggle={setShowGame} />
          </div>
          <BottomAction>
            <Link href={`/table/${table.id}`}>
              <Button full>open the table</Button>
            </Link>
          </BottomAction>
        </div>
      ) : intent ? (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12 pb-24">
          {/* Left Column: Active Intent */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <div className="rounded-2xl border border-line bg-paper-raised p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">you&apos;re up for tea</span>
                <span className="rounded-full bg-ink/5 px-2.5 py-0.5 text-xs font-medium text-ink">active</span>
              </div>
              <p className="mt-3 text-xl font-semibold text-ink">
                {intent.spotPref?.spotName ?? (intent.areaLabel ? `near ${intent.areaLabel}` : "near you")}
              </p>
              <p className="mt-1 text-sm font-medium text-ink-soft">around {clock(intent.desiredAt)}</p>
              <QuietText className="mt-4">
                We&apos;ll gather a table and show it here by {clock(intent.lockBy)}. No need to keep this open — check
                back then.
              </QuietText>
              <div className="mt-5">
                <Button variant="quiet" onClick={cancelIntent} disabled={cancelling}>
                  {cancelling ? "…" : "never mind"}
                </Button>
              </div>
            </div>
          </div>

          {/* Right Column: Nearby & Game */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            {spots.length > 0 && (
              <div>
                <div className="mb-3 flex items-center justify-between px-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
                    tea spots {areaLabel ? `near ${areaLabel}` : "nearby"}
                  </span>
                  <span className="text-xs text-ink-soft">{spots.length} spots</span>
                </div>
                <ul className="divide-y divide-line rounded-2xl border border-line bg-paper-raised">
                  {spots.slice(0, 4).map((s) => (
                    <li key={s.id} className="flex items-center justify-between px-4 py-3.5">
                      <span className="min-w-0 pr-2">
                        <span className="block truncate text-sm font-medium text-ink">{s.name}</span>
                        <span className="mt-0.5 block text-xs text-ink-soft">{prettyDistance(s.distanceM)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <GamePanel open={showGame} onToggle={setShowGame} />
          </div>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-12 pb-24">
          {/* Left Column: CTA Card */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <div className="rounded-2xl border border-line bg-paper-raised p-6 shadow-sm">
              <Doodle name="kettle" size={64} className="text-ink" />
              <Stack gap={2} className="mt-4">
                <Title className="text-2xl">up for a cup?</Title>
                <QuietText>
                  Say when you&apos;re free. We gather a few people {areaLabel ? `near ${areaLabel}` : "nearby"}, pick the
                  spot, and lock it in 45 minutes before so everyone can get there.
                </QuietText>
                {!liquidity && <QuietText className="text-xs italic">Quiet right now — you could be the one who starts it.</QuietText>}
              </Stack>
              <div className="mt-5">
                <Link href="/tea" className="block">
                  <Button full>I&apos;m up for tea</Button>
                </Link>
              </div>
            </div>
          </div>

          {/* Right Column: Nearby Spots & Game Panel */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <div>
              <div className="mb-3 flex items-center justify-between px-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
                  tea spots {areaLabel ? `near ${areaLabel}` : "nearby"}
                </span>
                {spots.length > 0 && <span className="text-xs text-ink-soft">{spots.length} nearby</span>}
              </div>

              {spotsLoading && spots.length === 0 ? (
                <div className="rounded-2xl border border-line p-6 text-center text-sm text-ink-soft">
                  looking around for tea spots…
                </div>
              ) : spots.length === 0 ? (
                <div className="rounded-2xl border border-line p-6 text-center text-sm text-ink-soft">
                  No spots found right here yet.
                </div>
              ) : (
                <ul className="divide-y divide-line rounded-2xl border border-line bg-paper-raised">
                  {spots.slice(0, 5).map((s) => (
                    <li key={s.id}>
                      <Link href="/tea" className="flex items-center justify-between px-4 py-3.5 transition-colors hover:bg-ink/5">
                        <span className="min-w-0 pr-2">
                          <span className="block truncate text-sm font-medium text-ink">{s.name}</span>
                          <span className="mt-0.5 block text-xs text-ink-soft">
                            {prettyDistance(s.distanceM)}
                            {s.address ? ` · ${s.address}` : ""}
                          </span>
                        </span>
                        <span className="text-xs font-medium text-ink-soft">→</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <GamePanel open={showGame} onToggle={setShowGame} />

            {lastCup && (
              <div className="rounded-xl border border-line/60 bg-paper-raised/50 px-4 py-3 text-center text-xs text-ink-soft">
                last cup · <span className="font-medium text-ink">{lastCup.spotName}</span> ·{" "}
                {new Date(lastCup.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </div>
            )}
          </div>

          <BottomAction>
            <Link href="/tea" className="block">
              <Button full>I&apos;m up for tea</Button>
            </Link>
          </BottomAction>
        </div>
      )}
    </Screen>
  );
}
