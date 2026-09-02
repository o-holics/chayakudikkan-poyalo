"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "./api";
import { DEFAULT_RADIUS_KM, RADIUS_MAX_KM, RADIUS_MIN_KM, type Profile, type TeaSpot } from "./models";
import { useProfile } from "./useProfile";

export type NearbySpot = TeaSpot & { distanceM: number };

type NearbyResponse = {
  center: { lat: number; lng: number };
  areaLabel?: string;
  radiusKm: number;
  spots: NearbySpot[];
};

export type NearbyQuery = { lat: number; lng: number } | { q: string };

function querySig(query: NearbyQuery, km: number): string {
  const where =
    "q" in query ? `q:${query.q.toLowerCase()}` : `${query.lat.toFixed(4)},${query.lng.toFixed(4)}`;
  return `${where}@${km}`;
}

function profileQuery(p: Profile | null): NearbyQuery | null {
  if (p?.homePoint) return { lat: p.homePoint.lat, lng: p.homePoint.lng };
  if (p?.areaLabel) return { q: p.areaLabel };
  return null;
}

// ── Persistent client cache ──────────────────────────────────────────
// The shop list barely changes; keep it locally so reopening the app is
// instant and doesn't hit the map API again. (Live waiting counts come
// from a separate realtime listener, so staleness here is harmless.)
const STORE_KEY = "chaya-nearby";
const CLIENT_TTL_MS = 3 * 24 * 60 * 60 * 1000;

type NearbyCache = { spots: NearbySpot[]; areaLabel?: string; center?: { lat: number; lng: number }; sig: string; fetchedAt: number };

function loadCache(): NearbyCache {
  if (typeof window === "undefined") return { spots: [], sig: "", fetchedAt: 0 };
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const c = JSON.parse(raw) as NearbyCache;
      if (Array.isArray(c.spots) && typeof c.sig === "string") return c;
    }
  } catch {
    /* ignore */
  }
  return { spots: [], sig: "", fetchedAt: 0 };
}

let cache: NearbyCache = loadCache();

function saveCache(next: NearbyCache) {
  cache = next;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function cachedSpot(id: string): NearbySpot | undefined {
  return cache.spots.find((s) => s.id === id);
}

export function resetNearbyCache() {
  cache = { spots: [], sig: "", fetchedAt: 0 };
  try {
    localStorage.removeItem(STORE_KEY);
  } catch {
    /* ignore */
  }
}

function cacheHitFor(sig: string): boolean {
  return cache.spots.length > 0 && cache.sig === sig && Date.now() - cache.fetchedAt < CLIENT_TTL_MS;
}

// ── Radius, remembered per device ────────────────────────────────────
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
  const [spots, setSpots] = useState<NearbySpot[]>([]);
  const [areaLabel, setAreaLabel] = useState<string | undefined>(undefined);
  const [center, setCenter] = useState<{ lat: number; lng: number } | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [radiusKm, setRadiusKmState] = useState(DEFAULT_RADIUS_KM);
  const started = useRef(false);
  const lastQuery = useRef<NearbyQuery | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRadiusKmState(initialRadius());
  }, []);

  const run = useCallback(async (query: NearbyQuery, km: number, force = false) => {
    lastQuery.current = query;
    const sig = querySig(query, km);
    if (!force && cacheHitFor(sig)) {
      setSpots(cache.spots);
      setAreaLabel(cache.areaLabel);
      setCenter(cache.center);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const base =
      "q" in query ? `q=${encodeURIComponent(query.q)}` : `lat=${query.lat}&lng=${query.lng}`;
    try {
      const data = await apiFetch<NearbyResponse>(`/api/spots/nearby?${base}&radiusKm=${km}`);
      saveCache({ spots: data.spots, areaLabel: data.areaLabel, center: data.center, sig, fetchedAt: Date.now() });
      setSpots(data.spots);
      setAreaLabel(data.areaLabel);
      setCenter(data.center);
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
        (pos) => run({ lat: pos.coords.latitude, lng: pos.coords.longitude }, km ?? radiusKm, true),
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
    const km = initialRadius();
    const pq = profileQuery(profile);
    if (!pq) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }
    run(pq, km);
  }, [profile, profileLoading, run]);

  return {
    spots,
    areaLabel,
    center,
    loading,
    error,
    radiusKm,
    run: (q: NearbyQuery) => run(q, radiusKm, true),
    refresh: () => lastQuery.current && run(lastQuery.current, radiusKm, true),
    locate,
    setRadiusKm,
    hasLocation: Boolean(profile?.homePoint || profile?.areaLabel),
  };
}
