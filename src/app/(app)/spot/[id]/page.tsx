"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { apiFetch, ApiError } from "@/lib/api";
import { cachedSpot, type NearbySpot } from "@/lib/useNearby";
import { usePoolStatus } from "@/lib/usePools";
import { useActiveTable } from "@/lib/useActiveTable";
import { Screen, Stack, Title, QuietText, Button, BottomAction } from "@/components/ui";
import { Doodle } from "@/components/Doodle";
import { AppTopBar } from "@/components/AppTopBar";
import type { TeaSpot } from "@/lib/models";

export default function SpotPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const spotId = params.id;

  const [spot, setSpot] = useState<(TeaSpot | NearbySpot) | null>(() => cachedSpot(spotId) ?? null);
  const [notFound, setNotFound] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { table } = useActiveTable();
  const pool = usePoolStatus(spotId);

  useEffect(() => {
    if (spot) return;
    getDoc(doc(db, "teaSpots", spotId))
      .then((snap) => {
        if (snap.exists()) setSpot(snap.data() as TeaSpot);
        else setNotFound(true);
      })
      .catch(() => setNotFound(true));
  }, [spot, spotId]);

  useEffect(() => {
    if (table) router.replace(`/table/${table.id}`);
    else if (pool.mine) router.replace(`/waiting/${encodeURIComponent(spotId)}`);
  }, [table, pool.mine, spotId, router]);

  const join = async () => {
    setJoining(true);
    setError(null);
    try {
      const res = await apiFetch<{ status: string; tableId?: string }>("/api/pool/join", {
        method: "POST",
        body: { spotId, spotName: spot?.name },
      });
      if (res.status === "seated" && res.tableId) router.replace(`/table/${res.tableId}`);
      else router.replace(`/waiting/${encodeURIComponent(spotId)}`);
    } catch (e) {
      if (e instanceof ApiError && e.code === "ADMIN_NOT_CONFIGURED") {
        setError("Tables aren't switched on yet. Hang tight — this is being set up.");
      } else {
        setError(e instanceof Error ? e.message : "Couldn't join just now.");
      }
      setJoining(false);
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
          <QuietText>
            {pool.count > 0 ? `${pool.count} already waiting here.` : "No one waiting yet — you could be first."}
          </QuietText>
        </Stack>

        {error && <p className="mt-6 text-sm text-ink">{error}</p>}

        <BottomAction>
          <Button full disabled={joining} onClick={join}>
            {joining ? "sitting down…" : "wait here for a table"}
          </Button>
        </BottomAction>
      </div>
    </Screen>
  );
}
