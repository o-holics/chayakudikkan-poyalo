// Shared document shapes for every new collection.
// All timestamps are epoch milliseconds (number) unless noted.

export const SIZE_MIN = 3;
export const SIZE_MAX = 6;
export const DEFAULT_SIZE_MIN = 3;
export const DEFAULT_SIZE_MAX = 5;

/** Nearby search radius in metres. */
export const NEARBY_RADIUS_M = 1500;
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

export type PoolWaiter = {
  uid: string;
  displayName: string;
  joinedAt: number;
  sizeMin: number;
  sizeMax: number;
  blockedUids: string[];
};

export type MatchPool = {
  spotId: string;
  spotName: string;
  waitingCount: number;
  formingDeadline: number | null;
  lockUntil: number | null;
  updatedAt: number;
};

export type Line = {
  quote: string; // Malayalam script
  translit: string; // Latin transliteration
  gloss: string; // English gloss
  film: string;
};

export type TableStatus = "forming" | "active" | "met" | "expired" | "cancelled";

export type TableMember = { uid: string; displayName: string };

export type TeaTable = {
  id: string;
  spotId: string;
  spotName: string;
  memberUids: string[];
  members: TableMember[];
  line: Line;
  status: TableStatus;
  createdAt: number;
  meetBy: number;
  expiresAt: number;
};

export type TableMessage = {
  id: string;
  senderUid: string;
  senderName: string;
  text: string;
  createdAt: number;
};

export type Presence = {
  uid: string;
  displayName: string;
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

export type Friend = { uid: string; displayName: string; since: number };
export type FriendRequest = { uid: string; displayName: string; createdAt: number };
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

/** Is a table of `n` acceptable to everyone in `waiters`? */
export function sizeSuitsAll(n: number, waiters: Pick<PoolWaiter, "sizeMin" | "sizeMax">[]): boolean {
  return n >= SIZE_MIN && waiters.every((w) => n >= w.sizeMin && n <= w.sizeMax);
}
