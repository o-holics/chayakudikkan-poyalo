"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { apiFetch, ApiError } from "@/lib/api";
import { geohash } from "@/lib/geo";
import { AREA_GEOHASH_PRECISION, type TeaSpot } from "@/lib/models";
import { cachedSpot, type NearbySpot } from "@/lib/useNearby";
import { usePoolStatus, useSpotInterest } from "@/lib/usePools";
import { useActiveTable } from "@/lib/useActiveTable";
import { Screen, Stack, Title, QuietText, Button, BottomAction } from "@/components/ui";
import { Doodle } from "@/components/Doodle";
import { AppTopBar } from "@/components/AppTopBar";

export default function SpotPage() {
  const router = useRouter();
  const { id: spotId } = useParams<{ id: string }>();

  const [spot, setSpot] = useState<(TeaSpot | NearbySpot) | null>(() => cachedSpot(spotId) ?? null);
  const [notFound, setNotFound] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const areaKey = useMemo(
    () => (spot ? geohash(spot.lat, spot.lng, AREA_GEOHASH_PRECISION) : null),
    [spot],
  );

  const { table } = useActiveTable();
  const pool = usePoolStatus(areaKey);
  const interest = useSpotInterest();
  const lookedToday = interest[spotId] ?? 0;

  useEffect(() => {
    if (spot) return;
    getDoc(doc(db, "teaSpots", spotId))
      .then((snap) => (snap.exists() ? setSpot(snap.data() as TeaSpot) : setNotFound(true)))
      .catch(() => setNotFound(true));
  }, [spot, spotId]);

  useEffect(() => {
    if (table) router.replace(`/table/${table.id}`);
    else if (areaKey && pool.mine) router.replace(`/waiting/${areaKey}`);
  }, [table, pool.mine, areaKey, router]);

  const join = async () => {
    if (!spot) return;
    setJoining(true);
    setError(null);
    try {
      const res = await apiFetch<{ status: string; tableId?: string; areaKey?: string }>("/api/pool/join", {
        method: "POST",
        body: { spotId, spotName: spot.name, point: { lat: spot.lat, lng: spot.lng } },
      });
      if (res.status === "seated" && res.tableId) router.replace(`/table/${res.tableId}`);
      else router.replace(`/waiting/${res.areaKey ?? areaKey}`);
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

  const nearbyWaiting = pool.count;

  return (
    <Screen>
      <AppTopBar back="/home" />

      <div className="mt-10 flex flex-1 flex-col">
        <Doodle name="cup" size={64} className="text-ink-soft" />
        <Stack gap={3} className="mt-6">
          <Title>{spot?.name ?? "…"}</Title>
          {spot?.address && <QuietText>{spot.address}</QuietText>}
          <QuietText>
            {nearbyWaiting > 0
              ? `${nearbyWaiting} ${nearbyWaiting === 1 ? "person is" : "people are"} waiting for tea near here right now.`
              : lookedToday > 1
                ? `${lookedToday} people looked for tea here today — worth a wait.`
                : "Quiet right now. Wait here and we'll widen the search as time passes."}
          </QuietText>
        </Stack>

        {error && <p className="mt-6 text-sm text-ink">{error}</p>}

        <BottomAction>
          <Button full disabled={joining || !spot} onClick={join}>
            {joining ? "sitting down…" : "wait here for a table"}
          </Button>
        </BottomAction>
      </div>
    </Screen>
  );
}
