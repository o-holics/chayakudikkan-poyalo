"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { usePoolStatus } from "@/lib/usePools";
import { useActiveTable } from "@/lib/useActiveTable";
import { OFFER_RELAX_AFTER_MS } from "@/lib/models";
import { Screen, Stack, Title, QuietText, Button, Divider } from "@/components/ui";
import { Doodle } from "@/components/Doodle";
import { TeaGame } from "@/components/TeaGame";

function useElapsed(since: number | null): number {
  const [ms, setMs] = useState(0);
  useEffect(() => {
    if (!since) return;
    const tick = () => setMs(Date.now() - since);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [since]);
  return ms;
}

export default function WaitingPage() {
  const router = useRouter();
  const { areaKey } = useParams<{ areaKey: string }>();

  const pool = usePoolStatus(areaKey);
  const { table } = useActiveTable();
  const elapsed = useElapsed(pool.myJoinedAt);

  const [leaving, setLeaving] = useState(false);
  const [relaxing, setRelaxing] = useState(false);
  const [showGame, setShowGame] = useState(false);
  const [dismissedRelax, setDismissedRelax] = useState(false);
  const ticking = useRef(false);

  const spotLabel =
    pool.spotNames.length === 1 ? pool.spotNames[0] : pool.spotNames.length > 1 ? "a few nearby spots" : "the tea shop";

  useEffect(() => {
    if (table) router.replace(`/table/${table.id}`);
  }, [table, router]);

  useEffect(() => {
    if (!pool.loading && !pool.mine && !table) router.replace("/home");
  }, [pool.loading, pool.mine, table, router]);

  // Keep nudging the pool so the search widens with time.
  useEffect(() => {
    const id = setInterval(async () => {
      if (ticking.current) return;
      ticking.current = true;
      try {
        await apiFetch("/api/pool/tick", { method: "POST", body: { areaKey } });
      } catch {
        /* ignore */
      } finally {
        ticking.current = false;
      }
    }, 15000);
    return () => clearInterval(id);
  }, [areaKey]);

  const leave = async () => {
    setLeaving(true);
    try {
      await apiFetch("/api/pool/leave", { method: "POST", body: { areaKey } });
    } catch {
      /* ignore */
    }
    router.replace("/home");
  };

  const relax = async () => {
    setRelaxing(true);
    try {
      await apiFetch("/api/pool/relax", { method: "POST", body: { areaKey } });
    } catch {
      /* ignore */
    }
    setRelaxing(false);
  };

  const others = Math.max(0, pool.count - 1);
  const offerRelax =
    !pool.myRelaxed && !dismissedRelax && elapsed > OFFER_RELAX_AFTER_MS && pool.count < 3;

  return (
    <Screen>
      <div className="flex flex-1 flex-col items-center pt-10 text-center">
        <Doodle name="steam" size={64} className="text-ink-soft" />
        <Stack gap={3} className="mt-8 items-center">
          <Title>waiting for a table</Title>
          <QuietText>
            near {spotLabel}
            <br />
            {pool.count <= 1
              ? "just you so far"
              : `you and ${others} ${others === 1 ? "other" : "others"} so far`}
            {pool.myRelaxed && " · open to a smaller table"}
          </QuietText>
          {pool.formingDeadline != null && (
            <QuietText>if it&apos;s slow, we widen the search on its own</QuietText>
          )}
        </Stack>

        {offerRelax && (
          <div className="mt-8 w-full rounded-2xl border border-line p-5 text-left">
            <QuietText>It&apos;s quiet nearby tonight. Happy to sit with a smaller table — even just two?</QuietText>
            <div className="mt-3 flex gap-3">
              <Button onClick={relax} disabled={relaxing}>
                {relaxing ? "…" : "yes, smaller is fine"}
              </Button>
              <Button variant="quiet" onClick={() => setDismissedRelax(true)}>
                keep waiting
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8">
        {showGame ? (
          <div className="rounded-2xl border border-line p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-ink-soft">pass the time</span>
              <button
                type="button"
                className="text-xs text-ink-soft underline decoration-line underline-offset-4"
                onClick={() => setShowGame(false)}
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
            onClick={() => setShowGame(true)}
          >
            play something while you wait
          </button>
        )}
      </div>

      <Divider />

      <div className="mt-6 flex items-center justify-between">
        <QuietText>You can close the app — it&apos;ll be here when you&apos;re back.</QuietText>
        <Button variant="quiet" onClick={leave} disabled={leaving}>
          {leaving ? "…" : "leave"}
        </Button>
      </div>
    </Screen>
  );
}
