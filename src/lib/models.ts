// Shared document shapes for every new collection.
// All timestamps are epoch milliseconds (number) unless noted.

export const SIZE_MIN = 3;
export const SIZE_MAX = 6;
export const DEFAULT_SIZE_MIN = 3;
export const DEFAULT_SIZE_MAX = 5;
/** Only ever reached when someone opts in to a smaller table. */
export const RELAXED_MIN = 2;

/** Areas are city-sized; proximity grouping happens inside them. */
export const AREA_GEOHASH_PRECISION = 4;

/** A table is locked in this long before its meet time, so people can travel. */
export const TRAVEL_LEAD_MS = 45 * 60 * 1000;

/**
 * How early before the lock a "a pair is fine" opt-in starts to apply — i.e.
 * we only seat someone below their chosen size in this final window.
 */
export const RELAX_LEAD_MS = 25 * 60 * 1000;

/** The daily boundary: tea can be scheduled up to the next 6am. */
export const DAY_BOUNDARY_HOUR = 6;

/** Two people can share a table if their wanted times are within this. */
export const TIME_CLUSTER_MS = 75 * 60 * 1000;

/** You must want tea at least this far ahead (time to form + travel). */
export const MIN_LEAD_MS = 60 * 60 * 1000;

/** Spatial search widens as the lock deadline approaches. */
export const MATCH_TIERS = [
  { leadMsLeft: 30 * 60 * 1000, clusterM: 1800 },
  { leadMsLeft: 10 * 60 * 1000, clusterM: 3500 },
  { leadMsLeft: -Infinity, clusterM: 9000 },
] as const;

/** A day's "people looked here" counter resets after this. */
export const INTEREST_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Default nearby search radius in metres, and the range a person can widen to. */
export const NEARBY_RADIUS_M = 2000;
export const DEFAULT_RADIUS_KM = 2;
export const RADIUS_MIN_KM = 1;
export const RADIUS_MAX_KM = 15;
/** How long a nearby-cache entry stays fresh. */
export const NEARBY_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Soft window before a partial table (3–5) is formed. */
export const FORMING_WINDOW_MS = 120 * 1000;
/** How long after forming the group has to meet. */
export const MEET_WINDOW_MS = 30 * 60 * 1000;
/** Hard expiry for a table doc. */
export const TABLE_TTL_MS = 3 * 60 * 60 * 1000;

export type LatLng = { lat: number; lng: number };

export type TeaSpot = {
  id: string; // "osm:node/123456"
  name: string;
  address?: string;
  lat: number;
  lng: number;
  mapsUrl: string; // openstreetmap.org link
  geoUrl: string; // geo: URI for "open in maps"
  source: "osm";
  tags?: Record<string, string>;
  cachedAt: number;
};

export type NearbyCache = {
  geohash: string;
  center: LatLng;
  spotIds: string[];
  fetchedAt: number;
};

export type Profile = {
  uid: string;
  displayName: string;
  areaLabel?: string;
  homePoint?: LatLng;
  sizeMin: number;
  sizeMax: number;
  createdAt: number;
  onboardedAt?: number | null;
  activeTableId?: string | null;
  stats?: { shared: number; missed: number };
};

export type IntentStatus = "pending" | "matched" | "expired" | "cancelled";

export type SpotRef = { spotId: string; spotName: string; lat: number; lng: number };

export type TeaIntent = {
  id: string;
  uid: string;
  displayName: string;
  /** Where this person is — the matcher gathers people and picks the spot. */
  point: LatLng;
  areaKey: string;
  areaLabel?: string;
  /** Optional hint: a place they'd like it to be. */
  spotPref?: SpotRef | null;
  /** Nearby cafes the matcher may choose from. */
  spotOptions: SpotRef[];
  /** When they want to sit down (epoch ms). */
  desiredAt: number;
  /** Latest moment the table may be formed: desiredAt - TRAVEL_LEAD_MS. */
  lockBy: number;
  sizeMin: number;
  sizeMax: number;
  /** Set when they said a pair is fine. */
  relaxedMin?: number | null;
  blockedUids: string[];
  createdAt: number;
  status: IntentStatus;
  tableId?: string | null;
};

export type SpotInterest = {
  spotId: string;
  spotName: string;
  hits: number;
  since: number;
};

export type Line = {
  quote: string; // Malayalam script
  translit: string; // Latin transliteration
  gloss: string; // English gloss
  film: string;
};

export type TableStatus = "forming" | "active" | "met" | "expired" | "cancelled";

/** In a meetup, people are known only by a per-table alias. */
export type TableMember = { uid: string; alias: string };

export type TeaTable = {
  id: string;
  spotId: string;
  spotName: string;
  spotPoint?: LatLng;
  memberUids: string[];
  members: TableMember[];
  line: Line;
  status: TableStatus;
  createdAt: number;
  /** When the group has agreed to sit down. */
  meetAt: number;
  /** Grace period after meetAt before the table is considered a no-show. */
  meetBy: number;
  expiresAt: number;
};

export type TableMessage = {
  id: string;
  senderUid: string;
  senderAlias: string;
  text: string;
  createdAt: number;
};

export type Presence = {
  uid: string;
  alias: string;
  arrivedAt: number | null;
  leftAt: number | null;
};

export type HistoryEntry = {
  id: string; // tableId
  spotName: string;
  line: Line;
  members: TableMember[];
  outcome: TableStatus;
  at: number;
};

export type Blocked = { uid: string; displayName: string; blockedAt: number };

export type SafetyReport = {
  reporterUid: string;
  reportedUid: string;
  reportedName?: string;
  reason: string;
  note?: string;
  createdAt: number;
};

export const REPORT_REASONS = [
  "Made the table feel unsafe",
  "Wasn't who they said they were",
  "Rude or abusive",
  "Never showed, wasted the table",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export function clampSize(n: number): number {
  return Math.max(SIZE_MIN, Math.min(SIZE_MAX, Math.round(n)));
}

/** The latest you can want tea for: the next 6am boundary after `now`. */
export function latestDesiredAt(now: number): number {
  const d = new Date(now);
  d.setHours(DAY_BOUNDARY_HOUR, 0, 0, 0);
  if (d.getTime() <= now) d.setDate(d.getDate() + 1);
  let t = d.getTime();
  if (t < now + MIN_LEAD_MS) t += 24 * 60 * 60 * 1000;
  return t;
}
