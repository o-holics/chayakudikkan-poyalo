"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "./api";
import { DEFAULT_RADIUS_KM, RADIUS_MAX_KM, RADIUS_MIN_KM, type TeaSpot } from "./models";
import { useProfile } from "./useProfile";

export type NearbySpot = TeaSpot & { distanceM: number };

type NearbyResponse = {
  center: { lat: number; lng: number };
  areaLabel?: string;
  radiusKm: number;
  spots: NearbySpot[];
};

let cache: { spots: NearbySpot[]; areaLabel?: string } = { spots: [] };
export function cachedSpot(id: string): NearbySpot | undefined {
  return cache.spots.find((s) => s.id === id);
}

export type NearbyQuery = { lat: number; lng: number } | { q: string };

const RADIUS_KEY = "chaya-radius-km";

function initialRadius(): number {
  if (typeof window === "undefined") return DEFAULT_RADIUS_KM;
  try {
    const n = Number(localStorage.getItem(RADIUS_KEY));
    return n >= RADIUS_MIN_KM && n <= RADIUS_MAX_KM ? n : DEFAULT_RADIUS_KM;
  } catch {
    return DEFAULT_RADIUS_KM;
  }
}

export function useNearby() {
  const { profile, loading: profileLoading } = useProfile();
  const [spots, setSpots] = useState<NearbySpot[]>(cache.spots);
  const [areaLabel, setAreaLabel] = useState<string | undefined>(cache.areaLabel);
  const [loading, setLoading] = useState(cache.spots.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [radiusKm, setRadiusKmState] = useState(DEFAULT_RADIUS_KM);
  const started = useRef(false);
  const lastQuery = useRef<NearbyQuery | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRadiusKmState(initialRadius());
  }, []);

  const run = useCallback(async (query: NearbyQuery, km?: number) => {
    lastQuery.current = query;
    setLoading(true);
    setError(null);
    const base =
      "q" in query ? `q=${encodeURIComponent(query.q)}` : `lat=${query.lat}&lng=${query.lng}`;
    const kmParam = km ? `&radiusKm=${km}` : "";
    try {
      const data = await apiFetch<NearbyResponse>(`/api/spots/nearby?${base}${kmParam}`);
      cache = { spots: data.spots, areaLabel: data.areaLabel };
      setSpots(data.spots);
      setAreaLabel(data.areaLabel);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load nearby spots.");
    } finally {
      setLoading(false);
    }
  }, []);

  const locate = useCallback(
    (km?: number) => {
      if (!("geolocation" in navigator)) {
        setError("This device won't share a location.");
        return;
      }
      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => run({ lat: pos.coords.latitude, lng: pos.coords.longitude }, km ?? radiusKm),
        () => {
          setLoading(false);
          setError("Couldn't reach your location.");
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 120000 },
      );
    },
    [run, radiusKm],
  );

  const setRadiusKm = useCallback(
    (km: number) => {
      const clamped = Math.min(RADIUS_MAX_KM, Math.max(RADIUS_MIN_KM, km));
      setRadiusKmState(clamped);
      try {
        localStorage.setItem(RADIUS_KEY, String(clamped));
      } catch {
        /* ignore */
      }
      if (lastQuery.current) run(lastQuery.current, clamped);
    },
    [run],
  );

  useEffect(() => {
    if (started.current || profileLoading) return;
    started.current = true;
    if (cache.spots.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }
    const km = initialRadius();
    if (profile?.homePoint) run({ lat: profile.homePoint.lat, lng: profile.homePoint.lng }, km);
    else if (profile?.areaLabel) run({ q: profile.areaLabel }, km);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    else setLoading(false);
  }, [profile, profileLoading, run]);

  return {
    spots,
    areaLabel,
    loading,
    error,
    radiusKm,
    run,
    locate,
    setRadiusKm,
    hasLocation: Boolean(profile?.homePoint || profile?.areaLabel),
  };
}
