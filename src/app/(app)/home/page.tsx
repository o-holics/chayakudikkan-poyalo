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
import { geohash } from "@/lib/geo";
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
    <div className="rounded-2xl border border-line p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-ink-soft">pass the time</span>
        <button
          type="button"
          className="text-xs text-ink-soft underline decoration-line underline-offset-4"
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
      className="text-sm text-ink-soft underline decoration-line underline-offset-4"
      onClick={() => onToggle(true)}
    >
      pass a minute?
    </button>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const { table } = useActiveTable();
  const { intent } = usePendingIntent();
  const { spots, areaLabel, center } = useNearby();
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
    <Screen>
      <AppTopBar />

      <Stack gap={3} className="mt-8">
        <Title>
          {greeting()}, {profile?.displayName ?? "friend"}
        </Title>
        {liquidity && <QuietText>{liquidity}.</QuietText>}
      </Stack>

      {table ? (
        <div className="mt-8 flex flex-1 flex-col">
          <Link href={`/table/${table.id}`} className="block rounded-2xl border border-line bg-paper-raised p-6">
            <p className="text-xs uppercase tracking-wide text-ink-soft">your table · say the line</p>
            <p className="mt-3 font-mal text-2xl leading-snug text-ink">{table.line.quote}</p>
            <p className="mt-2 text-sm text-ink-soft">
              {table.line.translit} — {table.line.film}
            </p>
            <p className="mt-4 text-sm text-ink">
              {table.spotName}
              {table.meetAt ? ` · around ${clock(table.meetAt)}` : ""} · {table.memberUids.length} of you
            </p>
          </Link>
          <BottomAction>
            <Link href={`/table/${table.id}`}>
              <Button full>open the table</Button>
            </Link>
          </BottomAction>
        </div>
      ) : intent ? (
        <div className="mt-8 flex flex-1 flex-col">
          <div className="rounded-2xl border border-line p-6">
            <p className="text-xs uppercase tracking-wide text-ink-soft">you&apos;re up for tea</p>
            <p className="mt-3 text-lg text-ink">
              {intent.spotPref?.spotName ?? (intent.areaLabel ? `near ${intent.areaLabel}` : "near you")}
            </p>
            <p className="mt-1 text-sm text-ink-soft">around {clock(intent.desiredAt)}</p>
            <QuietText className="mt-4">
              We&apos;ll gather a table and show it here by {clock(intent.lockBy)}. No need to keep this open — check
              back then.
            </QuietText>
            <div className="mt-4">
              <Button variant="quiet" onClick={cancelIntent} disabled={cancelling}>
                {cancelling ? "…" : "never mind"}
              </Button>
            </div>
          </div>

          <div className="mt-6">
            <GamePanel open={showGame} onToggle={setShowGame} />
          </div>
        </div>
      ) : (
        <div className="mt-8 flex flex-1 flex-col">
          <Doodle name="kettle" size={72} className="text-ink-soft" />
          <Stack gap={3} className="mt-6">
            <Title>up for a cup?</Title>
            <QuietText>
              Say when you&apos;re free. We gather a few people {areaLabel ? `near ${areaLabel}` : "nearby"}, pick the
              spot, and lock it in 45 minutes before so everyone can get there.
            </QuietText>
            {!liquidity && <QuietText>Quiet right now — you could be the one who starts it.</QuietText>}
          </Stack>

          <div className="mt-8">
            <GamePanel open={showGame} onToggle={setShowGame} />
          </div>

          {lastCup && (
            <p className="mt-8 text-xs text-ink-soft">
              last cup · {lastCup.spotName} ·{" "}
              {new Date(lastCup.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </p>
          )}

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
