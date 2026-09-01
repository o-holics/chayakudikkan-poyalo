import "server-only";
import type { LatLng, TeaSpot } from "./models";
import { NEARBY_RADIUS_M } from "./models";

const UA = "chayakudikkanpoyalo/1.0 (+https://chayakudikkanpoyalo.in)";
const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.osm.ch/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const NOMINATIM = "https://nominatim.openstreetmap.org";

// GET, not POST — some networks/WAFs block POST to the Overpass hosts.
async function queryOverpass(query: string): Promise<Response> {
  const suffix = `?data=${encodeURIComponent(query)}`;
  let lastErr: unknown;
  for (const base of OVERPASS_MIRRORS) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 25_000);
      const res = await fetch(base + suffix, {
        headers: { Accept: "application/json", "User-Agent": UA },
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (res.ok) return res;
      lastErr = new Error(`${base} → ${res.status}`);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("all overpass mirrors failed");
}

type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

function buildAddress(tags: Record<string, string>): string | undefined {
  const parts = [
    tags["addr:housenumber"],
    tags["addr:street"],
    tags["addr:suburb"] ?? tags["addr:neighbourhood"],
    tags["addr:city"] ?? tags["addr:town"] ?? tags["addr:village"],
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : undefined;
}

/** Nearby cafes / tea shops from OpenStreetMap. Names only, nearest-friendly. */
export async function fetchNearbySpots(point: LatLng, radiusM = NEARBY_RADIUS_M): Promise<TeaSpot[]> {
  const { lat, lng } = point;
  const a = `(around:${radiusM},${lat},${lng})`;
  const q =
    `[out:json][timeout:25];(` +
    `node[amenity=cafe]${a};way[amenity=cafe]${a};` +
    `node[shop=tea]${a};way[shop=tea]${a};` +
    `node[cuisine~tea]${a};` +
    `);out tags center 80;`;

  const res = await queryOverpass(q);
  const data = (await res.json()) as { elements?: OverpassElement[] };
  const now = Date.now();
  const seen = new Set<string>();
  const spots: TeaSpot[] = [];

  for (const el of data.elements ?? []) {
    const tags = el.tags ?? {};
    const name = tags.name?.trim();
    if (!name) continue;

    const lat2 = el.lat ?? el.center?.lat;
    const lng2 = el.lon ?? el.center?.lon;
    if (typeof lat2 !== "number" || typeof lng2 !== "number") continue;

    // Keep ids URL-safe and valid as Firestore doc ids (no ":" or "/").
    const id = `osm_${el.type}_${el.id}`;
    if (seen.has(id)) continue;
    seen.add(id);

    spots.push({
      id,
      name,
      address: buildAddress(tags),
      lat: lat2,
      lng: lng2,
      mapsUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
      geoUrl: `geo:${lat2},${lng2}?q=${encodeURIComponent(name)}`,
      source: "osm",
      tags: {
        ...(tags.amenity ? { amenity: tags.amenity } : {}),
        ...(tags.shop ? { shop: tags.shop } : {}),
      },
      cachedAt: now,
    });
  }
  return spots;
}

/** Turn a typed area ("Fort Kochi") into a rough point. */
export async function geocodeArea(query: string): Promise<(LatLng & { label: string }) | null> {
  const url = `${NOMINATIM}/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return null;
  const rows = (await res.json()) as { lat: string; lon: string; display_name: string }[];
  if (!rows.length) return null;
  return {
    lat: parseFloat(rows[0].lat),
    lng: parseFloat(rows[0].lon),
    label: shortLabel(rows[0].display_name),
  };
}

type NominatimAddress = Record<string, string>;

/** Turn a rough point into a short place name to show the person. */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const url = `${NOMINATIM}/reverse?format=json&zoom=14&lat=${lat}&lon=${lng}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return null;
  const row = (await res.json()) as { display_name?: string; address?: NominatimAddress };
  const a = row.address ?? {};
  const place =
    a.neighbourhood ?? a.suburb ?? a.quarter ?? a.village ?? a.town ?? a.city_district ?? a.city;
  const city = a.city ?? a.town ?? a.state_district ?? a.state;
  if (place && city && place !== city) return `${place}, ${city}`;
  if (place) return place;
  if (row.display_name) return shortLabel(row.display_name);
  return null;
}

function shortLabel(displayName: string): string {
  return displayName.split(",").slice(0, 2).join(",").trim();
}
