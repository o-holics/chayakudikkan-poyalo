# chayakudikanpooyalo — rebuild plan

> Branch: `feature/chayakudikanpoono` · Domain: `chayakudikanpooyalo.in`
> Firebase project stays (`kudikkan-poyalo`); all-new collections.

---

## 1. What this is

A quiet app for late-night chai lovers. You open it, it already shows tea shops near
you, you tap one, and it waits with you until a small table of **3–6 people** comes
together. The table gets a **Malayalam movie dialogue** as its sign — you walk up,
say the line, and share a cup. Afterwards it's just a soft memory in your history.

**It is not a matching app.** No swiping, no filters, no profiles to browse, no
"compatibility". Nobody should feel like they're doing work. The whole thing is
calm, slow, and mostly automatic.

## 2. Feel / design language

From the reference: warm paper, black ink, one hand-drawn doodle, big calm type,
tiny muted subtext, lots of empty space.

| Token | Light (identity) | Night |
| --- | --- | --- |
| `--paper` | `#F4F2EC` | `#141312` |
| `--ink` | `#111111` | `#EDEAE2` |
| `--ink-soft` | `#8A8A85` | `#7C7A73` |
| `--line` | `#E4E1D8` | `#2A2825` |
| `--accent` | `#111111` (ink itself; no color accent) | `#EDEAE2` |

- Theme follows system, plus a manual toggle persisted in `localStorage`.
- One humanist sans (Inter is fine). Large headline, generous leading, sentence case.
- Microcopy is soft and short: "put the kettle on", "someone's nearby",
  "a table is forming", "say the line".
- Motion: 300–500ms opacity/translate fades, ease-out. **No** pulse, ping, bounce,
  spinner-churn. A loading state is a still line of text.
- Hand-drawn single-stroke SVG doodles (kettle, cup, steam, moon, chair, flower),
  reused across onboarding and empty states. Inline, theme-aware via `currentColor`.
- Layout: one column, `max-width: 26rem`, centered, big tap targets, primary action
  anchored to the bottom. Mobile-first; desktop just centers the same column.
- PWA: `manifest.ts`, `theme-color`, apple-touch meta, installable "add to home screen".

## 3. Flow

```
open ─▶ (not signed in) welcome ─▶ sign in
     └▶ (signed in, no profile) onboarding
     └▶ (signed in, profile) home
```

### Onboarding (3 soft steps, everything pre-filled)
1. **Name** — "what should we call you?" one field.
2. **Location** — "so we can find tea near you". Asks browser geolocation with a
   gentle prompt; "type an area instead" fallback. Stores a coarse point + label.
3. **Table size** — two steppers, "smallest table" and "biggest table", both bound
   to **3–6**, default **3–5**. Copy: "how many is good company?"
Then → home. No tutorial wall; home itself is obvious.

### Home
- Uses the stored location immediately — nearby tea shops are already listed,
  nearest first, each with a quiet "· 2 waiting" when someone's there.
- Tap a shop → **spot** screen → "wait here for a table".
- If you're already waiting or seated, home shows that first with a way back to it.

### Waiting
- Still screen: shop name, a doodle, "waiting for a table" and a soft count
  ("you + 2 so far"). No countdown pressure; if a soft deadline exists it reads
  "forming soon", not a ticking clock.
- One quiet "leave" link.

### Table (seated)
- The **line** shown large (Malayalam script), with transliteration + film name small.
- Who's coming (first names + doodle avatars).
- "open in maps" link. "I'm here" toggle. "we met" closes it warmly.
- A calm group chat below (see §6).

### After
- Table slides into **history**: shop, the line, who was there, the date. Nothing else.

## 4. Architecture

- **Client**: Firebase Auth (client SDK) + Firestore **client SDK with `onSnapshot`**
  for every read (nearby waiting counts, waiting room, table, chat, presence).
  No polling anywhere.
- **Server** (Next 16 route handlers, Node runtime): **Firebase Admin SDK**. Every
  handler does `admin.auth().verifyIdToken(bearer)` for real. All *authoritative*
  writes are Admin-only — pool membership, table creation, `activeTableId`, history,
  lifecycle transitions. Client SDK is blocked from those paths by security rules
  (`allow write: if false`); it only writes social data (chat message, friend
  request, block, report) under scoped rules.
- **`proxy.ts`** (Next 16 renamed middleware → proxy): cheap optimistic redirect
  only (has session cookie? → allow app routes). Never the auth boundary — routes
  verify the token themselves. Per Next docs, proxy is not for session/authz.
- **Matching**: reactive and transaction-guarded, **no Cloud Functions**.
  - `pool/join`: transaction on `matchPools/{spotId}`. If the waiting set can
    already satisfy everyone's size range → form the table now. Else set/refresh a
    soft `formingDeadline` (~2 min).
  - Any waiting client past `formingDeadline` calls `pool/tick`; it transactionally
    forms the best table it can (≥3, within ranges) or clears the deadline.
  - Same opportunistic + transactional pattern for table lifecycle
    (`table/tick` → `met` / `expired`).
  - **P6** adds `POST /api/cron/tick` (bearer `CRON_SECRET`, hit by GitHub Actions
    / cron-job.org every ~60s) as a safety net for terminal transitions.

### Next 16 notes (verified against `node_modules/next/dist/docs`)
- Route handlers: not cached by default; `params` is a Promise, type with
  `RouteContext<'/api/x/[id]'>`, `await ctx.params`.
- Pages: `params`/`searchParams` are Promises; client pages use `use(params)` or
  `useParams`.
- `proxy.ts` at `src/` level, named `proxy` export + `config.matcher`.

## 5. Data model (new top-level collections)

```
teaSpots/{spotId}              spotId = "osm:node/123456"
  name, address, lat, lng, mapsUrl, source:"osm", tags{}, cachedAt

nearbyCache/{geohash6}         placeIds[], center{lat,lng}, fetchedAt   (TTL ~7d)

matchPools/{spotId}            spotId, waitingCount, formingDeadline|null,
                               lockUntil|null, updatedAt
  waiting/{uid}                uid, displayName, joinedAt, sizeMin, sizeMax, blockedUids[]

teaTables/{tableId}            spotId, spotName, memberUids[], members[]{uid,displayName},
                               line{ quote, translit, gloss, film },
                               status: forming|active|met|expired|cancelled,
                               createdAt, meetBy (+30m), expiresAt (+3h)
  messages/{msgId}             senderUid, senderName, text, createdAt
  presence/{uid}               arrivedAt|null, leftAt|null

profiles/{uid}                 displayName, areaLabel, homePoint{lat,lng},
                               sizeMin(3), sizeMax(5), createdAt,
                               activeTableId|null, stats{ shared, missed }
  friends/{uid}                uid, displayName, since
  friendRequests/{uid}         from uid, displayName, createdAt
  blocks/{uid}                 uid, displayName, blockedAt
  history/{tableId}            spotName, line, members[], outcome, at

safetyReports/{reportId}       reporterUid, reportedUid, reason, note, createdAt   (create-only)
```

No gender field anywhere — dropped as matching-flavoured.

### Security rules (`firestore.rules`) — shape
- `teaSpots/**`, `nearbyCache/**`, `matchPools/**`, `teaTables/{t}` doc,
  `profiles/{u}.activeTableId`, `profiles/{u}/history/**` → `allow write: if false`.
  Admin SDK bypasses; these are server-owned.
- `teaSpots`, `nearbyCache` → `allow read: if request.auth != null`.
- `matchPools/{s}` + `waiting/**` → read if `request.auth != null` (counts only;
  no sensitive data stored there).
- `teaTables/{t}` → read if `request.auth.uid in resource.data.memberUids`;
  `messages` create if sender is a member and `senderUid == request.auth.uid`;
  `presence/{uid}` write self only.
- `profiles/{u}` → read if signed in; update self, whitelisted fields only
  (`displayName`, `areaLabel`, `homePoint`, `sizeMin`, `sizeMax`).
- `profiles/{u}/friends|blocks` → owner only. `friendRequests/{from}` → create
  allowed when `from == request.auth.uid`; delete by owner.
- `safetyReports/{id}` → `create` if `reporterUid == request.auth.uid`; no read.

`firestore.indexes.json`: `matchPools/*/waiting` by `joinedAt` asc;
`profiles/*/history` by `at` desc; `teaTables/*/messages` by `createdAt` asc.

## 6. Nearby via OpenStreetMap (free, no key, no billing)

`GET /api/spots/nearby?lat=&lng=` (Admin-verified):
1. geohash6 the point → check `nearbyCache/{gh}` (fresh < 7d) → return cached ids.
2. Miss → Overpass API `POST https://overpass-api.de/api/interpreter`:
   `node(around:1500,lat,lng)[amenity=cafe]; node(around:1500,...)[shop=tea];`
   (+ `way`/`relation` centers). Keep name'd results.
3. Upsert each into `teaSpots/{osm:type/id}` with lat/lng/name/address, build
   `mapsUrl = https://www.openstreetmap.org/{type}/{id}` (and a `geo:` link for the
   "open in maps" button).
4. Write `nearbyCache/{gh}`. Return spots + haversine distance, nearest first.
- Client: home reads this once per session/area, then `onSnapshot`s
  `matchPools` for the live "N waiting" badges.
- Overpass etiquette: 1 req per area load, cached hard; abstract behind
  `src/lib/places.ts` so a different provider can drop in later.

## 7. The line (`src/lib/lines.ts`)

~30 short, well-known Malayalam film dialogues, each:
`{ quote (Malayalam), translit (Latin), gloss (English), film }`.
One per table, chosen at formation, shown big with small attribution. Short quotes,
attributed — fine to use. List is editable; start curated and safe (nothing crude).

## 8. Matching algorithm (`src/lib/matching.ts`)

`formTable(spotId, waiting[])`:
1. Sort by `joinedAt` asc (fairness; randomness at n≤6 is cosmetic — the *line* and
   seating are what feel random).
2. Greedy fill up to 6, skipping anyone with a block edge to someone already in.
3. Let `n` = chosen count. Valid only if `n >= 3` **and** for every member
   `sizeMin <= n <= sizeMax`. If the newest member blocks a table, drop them and retry.
4. On `join`: try to form immediately; if not, set `formingDeadline = now + 120s`
   (only once ≥3 are waiting).
5. On `tick` past deadline: form the largest valid `n` (relaxing toward each
   member's `sizeMin`); if still impossible, clear the deadline and keep waiting.
6. Create `teaTables/{id}` (random line, `meetBy = now+30m`, `expiresAt = now+3h`),
   then a batched write: per member set `profiles/{uid}.activeTableId`, write
   `history/{id}` stub, delete `matchPools/{spotId}/waiting/{uid}`, decrement count.

`leave`: delete `waiting/{uid}`, decrement, clear `formingDeadline` if count < 3.

Table lifecycle (`table/tick`, transaction-guarded, any member or cron):
`active` → `met` when a member taps "we met" (or all present); → `expired` if
`meetBy` passes with < 3 present; leaving with < 2 left → `cancelled`. On any
terminal state: clear each member's `activeTableId`, finalize `history` outcome.

## 9. Routes & files

### Add
```
src/lib/firebaseClient.ts      auth + firestore client singletons
src/lib/firebaseAdmin.ts       admin app singleton (FIREBASE_SERVICE_ACCOUNT_KEY)
src/lib/session.ts             verifyBearer(req) -> { uid } | 401
src/lib/models.ts              TS types for every doc above
src/lib/matching.ts            formTable, compatibility, lifecycle
src/lib/places.ts              Overpass fetch + geohash cache
src/lib/lines.ts               Malayalam dialogues
src/lib/theme.ts               light/night token application + toggle
src/lib/geo.ts                 haversine, geohash6

src/components/ui/             Screen, Stack, Button, QuietText, Field, Stepper
src/components/Doodle.tsx      named inline SVG doodles
src/components/PersonSheet.tsx friend / block / report actions (calm bottom sheet)

src/app/manifest.ts
src/app/(auth)/welcome/page.tsx
src/app/(auth)/sign-in/page.tsx
src/app/(app)/onboarding/page.tsx     name / location / size, pre-filled
src/app/(app)/home/page.tsx           nearby spots, live waiting counts
src/app/(app)/spot/[id]/page.tsx      wait here
src/app/(app)/waiting/[spotId]/page.tsx
src/app/(app)/table/[id]/page.tsx     line, members, presence, chat
src/app/(app)/friends/page.tsx
src/app/(app)/you/page.tsx            history + settings (theme, size, blocked)

src/app/api/spots/nearby/route.ts
src/app/api/pool/join/route.ts
src/app/api/pool/leave/route.ts
src/app/api/pool/tick/route.ts
src/app/api/table/tick/route.ts
src/app/api/table/leave/route.ts
src/app/api/table/met/route.ts
src/app/api/profile/route.ts          GET/PUT
src/app/api/friends/route.ts          request / respond / remove
src/app/api/safety/route.ts           block / unblock / report
src/app/api/cron/tick/route.ts        (P6)

firebase.json, firestore.rules, firestore.indexes.json
scripts/README (how to run rules emulator; no seed needed — spots come from OSM)
```

### Keep (rework)
`src/lib/clientApp.ts` → folded into `firebaseClient.ts` · `AuthProvider.tsx`
(drop the unsigned-JWT + hand-rolled cookie; store a short session cookie only as a
proxy hint, refresh via `onIdTokenChanged`) · `globals.css` (new tokens) ·
`layout.tsx` (metadata, theme-color, fonts) · Tailwind v4 setup.

### Delete
`src/lib/firebase.ts` (REST hack) · `src/lib/queue.ts` · `src/lib/auth.ts` ·
all `src/app/api/**` (old) · `src/app/dashboard` · `src/app/onboarding` (old) ·
`src/app/login` · `src/app/profile` · `src/app/friends` (old) ·
`src/app/spots/[id]` · `ReportModal.tsx` · `UserActionModal.tsx` ·
`src/app/page.tsx` redirect (replace with entry router).

## 10. Env (`.env.local`, already gitignored via `.env*`)
```
# existing NEXT_PUBLIC_FIREBASE_* stay
FIREBASE_SERVICE_ACCOUNT_KEY = <service account JSON, one line>   # console → project settings → service accounts
CRON_SECRET = <random>                                            # P6 only
```
No Google Maps key. No billing.

## 11. Build phases (each ends runnable)

- **P0 foundations** *(additive; no deletions)* — branch ✓, read Next 16 docs ✓,
  add `firebase-admin` dep, `firebaseClient/Admin/session`, `models.ts`, `geo.ts`,
  theme tokens in `globals.css` + `theme.ts`, `Doodle` set, `ui/` primitives,
  `firebase.json` + rules/indexes stubs, `manifest.ts`, fix `layout.tsx` metadata.
- **P1 auth + onboarding + shell** — rework `AuthProvider`, `proxy.ts`, entry router,
  `welcome` / `sign-in`, onboarding (name / location / size), `profile` route,
  `useProfile` realtime hook. *(Old pages deleted here — checkpoint with user first.)*
- **P2 nearby + pool** — `places.ts` + `spots/nearby`, `geo` permission flow, `home`
  with live counts, `spot` screen, `pool/join|leave`, `waiting` screen with
  `onSnapshot` + soft deadline + client `tick`.
- **P3 table + meetup** — `matching.ts`, table formation, `table` screen (line,
  members, maps link), presence, `table/tick`, `met`/`expired`, history finalize.
- **P4 chat** — `teaTables/{id}/messages` realtime + calm composer (client SDK).
- **P5 safety + friends** — block (excludes from pools, hides messages), report →
  `safetyReports`, friend request / accept from table-mates, friends + you pages.
- **P6 hardening** — tighten + emulator-test rules, composite indexes, `cron/tick` +
  external scheduler, empty/loading/error copy pass, happy-path e2e, README, deploy
  notes for `chayakudikanpooyalo.in`.

## 12. Risks
- No Cloud Functions in MVP → terminal transitions need a live client until P6 cron.
- Admin SDK needs the service-account key at runtime (local `.env.local`; host secret on deploy).
- Overpass is a shared free endpoint — hard-cache per area, one request per load,
  provider abstracted for a swap later.
- Old `users/spots/groups/reports` docs stay in the project as dead data; delete
  from console once the rebuild is live.
