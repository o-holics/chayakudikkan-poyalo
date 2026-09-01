"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { usePoolStatus } from "@/lib/usePools";
import { useActiveTable } from "@/lib/useActiveTable";
import { cachedSpot } from "@/lib/useNearby";
import { Screen, Stack, Title, QuietText, Button } from "@/components/ui";
import { Doodle } from "@/components/Doodle";

export default function WaitingPage() {
  const router = useRouter();
  const params = useParams<{ spotId: string }>();
  const spotId = params.spotId;

  const pool = usePoolStatus(spotId);
  const { table } = useActiveTable();
  const [leaving, setLeaving] = useState(false);
  const ticking = useRef(false);

  const spotName = pool.spotName ?? cachedSpot(spotId)?.name ?? "the tea shop";

  // Move on once a table forms.
  useEffect(() => {
    if (table) router.replace(`/table/${table.id}`);
  }, [table, router]);

  // If we're somehow not in this pool anymore, go back.
  useEffect(() => {
    if (!pool.loading && !pool.mine && !table) router.replace("/home");
  }, [pool.loading, pool.mine, table, router]);

  // Nudge the server to form a partial table once the soft window passes.
  useEffect(() => {
    const id = setInterval(async () => {
      if (ticking.current || !pool.formingDeadline) return;
      if (Date.now() < pool.formingDeadline) return;
      ticking.current = true;
      try {
        await apiFetch("/api/pool/tick", { method: "POST", body: { spotId } });
      } catch {
        /* ignore — will retry */
      } finally {
        ticking.current = false;
      }
    }, 4000);
    return () => clearInterval(id);
  }, [pool.formingDeadline, spotId]);

  const leave = async () => {
    setLeaving(true);
    try {
      await apiFetch("/api/pool/leave", { method: "POST", body: { spotId } });
    } catch {
      /* ignore */
    }
    router.replace("/home");
  };

  const others = Math.max(0, pool.count - 1);
  const forming = pool.formingDeadline != null;

  return (
    <Screen center>
      <div className="rise flex flex-col items-center text-center">
        <Doodle name="steam" size={72} className="text-ink-soft" />
        <Stack gap={3} className="mt-8 items-center">
          <Title>waiting for a table</Title>
          <QuietText>
            at {spotName}
            <br />
            {pool.count <= 1
              ? "just you so far — sit tight"
              : `you and ${others} ${others === 1 ? "other" : "others"} so far`}
          </QuietText>
          {forming && <QuietText>a table is coming together…</QuietText>}
        </Stack>
      </div>

      <div className="mt-16">
        <Button variant="quiet" onClick={leave} disabled={leaving}>
          {leaving ? "stepping away…" : "leave"}
        </Button>
      </div>
    </Screen>
  );
}
