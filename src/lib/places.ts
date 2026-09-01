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

type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

// GET, not POST — some networks/WAFs block POST to the Overpass hosts.
// Try every mirror; a mirror that answers 200 with an empty set is treated as
// "keep looking" — some mirrors run stale or partial data.
async function queryOverpass(query: string): Promise<OverpassElement[]> {
  const suffix = `?data=${encodeURIComponent(query)}`;
  let lastErr: unknown;
  let sawResponse = false;

  for (const base of OVERPASS_MIRRORS) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 25_000);
      const res = await fetch(base + suffix, {
        headers: { Accept: "application/json", "User-Agent": UA },
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        lastErr = new Error(`${base} → ${res.status}`);
        continue;
      }
      const data = (await res.json()) as { elements?: OverpassElement[] };
      const elements = data.elements ?? [];
      sawResponse = true;
      if (elements.length > 0) return elements;
    } catch (e) {
      lastErr = e;
    }
  }

  if (sawResponse) return []; // every mirror answered, none had anything
  throw lastErr instanceof Error ? lastErr : new Error("all overpass mirrors failed");
}

function buildAddress(tags: Record<string, string>): string | undefined {
  const parts = [
    tags["addr:housenumber"],
    tags["addr:street"],
    tags["addr:suburb"] ?? tags["addr:neighbourhood"],
    tags["addr:city"] ?? tags["addr:town"] ?? tags["addr:village"],
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : undefined;
}

function makeSpot(
  osmType: string,
  osmId: number | string,
  name: string,
  lat: number,
  lng: number,
  address?: string,
  tags?: Record<string, string>,
): TeaSpot {
  const t = osmType.replace(/^(n|node)$/, "node").replace(/^(w|way)$/, "way").replace(/^(r|relation)$/, "relation");
  return {
    id: `osm_${t}_${osmId}`,
    name,
    ...(address ? { address } : {}),
    lat,
    lng,
    mapsUrl: `https://www.openstreetmap.org/${t}/${osmId}`,
    geoUrl: `geo:${lat},${lng}?q=${encodeURIComponent(name)}`,
    source: "osm",
    tags: {
      ...(tags?.amenity ? { amenity: tags.amenity } : {}),
      ...(tags?.shop ? { shop: tags.shop } : {}),
    },
    cachedAt: Date.now(),
  };
}

async function viaOverpass(point: LatLng, radiusM: number): Promise<TeaSpot[]> {
  const { lat, lng } = point;
  const a = `(around:${radiusM},${lat},${lng})`;
  const q =
    `[out:json][timeout:25];(` +
    `nwr[amenity=cafe]${a};` +
    `nwr[shop=tea]${a};` +
    `nwr[shop=coffee]${a};` +
    `nwr[cuisine~"tea",i]${a};` +
    `nwr[amenity=restaurant][cuisine~"tea",i]${a};` +
    `);out tags center 120;`;

  const elements = await queryOverpass(q);
  const seen = new Set<string>();
  const spots: TeaSpot[] = [];
  for (const el of elements) {
    const tags = el.tags ?? {};
    const name = tags.name?.trim();
    if (!name) continue;
    const lat2 = el.lat ?? el.center?.lat;
    const lng2 = el.lon ?? el.center?.lon;
    if (typeof lat2 !== "number" || typeof lng2 !== "number") continue;
    const spot = makeSpot(el.type, el.id, name, lat2, lng2, buildAddress(tags), tags);
    if (seen.has(spot.id)) continue;
    seen.add(spot.id);
    spots.push(spot);
  }
  return spots;
}

type NominatimPoi = {
  osm_type?: string;
  osm_id?: number;
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  category?: string;
  type?: string;
  address?: NominatimAddress;
};

const POI_TYPES = new Set(["cafe", "tea", "coffee", "restaurant", "fast_food", "bakery", "canteen"]);

async function viaNominatim(point: LatLng, radiusM: number): Promise<TeaSpot[]> {
  const { lat, lng } = point;
  const dLat = radiusM / 111_320;
  const dLng = radiusM / (111_320 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  const viewbox = `${lng - dLng},${lat + dLat},${lng + dLng},${lat - dLat}`;

  const seen = new Set<string>();
  const spots: TeaSpot[] = [];

  for (const term of ["[cafe]", "[tea]", "tea shop"]) {
    const url =
      `${NOMINATIM}/search?format=jsonv2&limit=40&bounded=1&addressdetails=1` +
      `&viewbox=${encodeURIComponent(viewbox)}&q=${encodeURIComponent(term)}`;
    let rows: NominatimPoi[] = [];
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (res.ok) rows = (await res.json()) as NominatimPoi[];
    } catch {
      /* try the next term */
    }
    for (const r of rows) {
      if (r.category && r.category !== "amenity" && r.category !== "shop") continue;
      if (r.type && !POI_TYPES.has(r.type)) continue;
      const name = r.name?.trim() || r.display_name.split(",")[0]?.trim();
      const lat2 = parseFloat(r.lat);
      const lng2 = parseFloat(r.lon);
      if (!name || !Number.isFinite(lat2) || !Number.isFinite(lng2)) continue;
      const spot = makeSpot(
        r.osm_type ?? "node",
        r.osm_id ?? `${lat2},${lng2}`,
        name,
        lat2,
        lng2,
        r.address ? buildAddress(r.address) : undefined,
      );
      if (seen.has(spot.id)) continue;
      seen.add(spot.id);
      spots.push(spot);
    }
  }
  return spots;
}

/**
 * Nearby cafes / tea shops from OpenStreetMap. Overpass first (best tea-shop
 * coverage); Nominatim as a fallback when Overpass is unreachable or empty.
 */
export async function fetchNearbySpots(point: LatLng, radiusM = NEARBY_RADIUS_M): Promise<TeaSpot[]> {
  let spots: TeaSpot[] = [];
  let overpassErr: unknown;
  try {
    spots = await viaOverpass(point, radiusM);
  } catch (e) {
    overpassErr = e;
  }
  if (spots.length > 0) return spots;

  try {
    spots = await viaNominatim(point, radiusM);
  } catch (e) {
    if (overpassErr) throw overpassErr;
    throw e;
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
