# Services & Firebase Functions

## Client Services (`src/services/`)

### Discovery Queue (`src/hooks/useDiscoveryQueue.js`)

Core recommendation engine. Items scored by affinity weights derived from quiz responses. Diversity injector prevents repetitive results. Cold start shuffles randomly; subsequent batches are personalised. Queue is buffered 30 items ahead and refills automatically.

Scoring weights: `brand × 10`, `type × 15`, `parentType × 4`, `color × 5`, `style × 0.5`, companion bonus `× 8–12`.

Exposes `seeded` (boolean — flips `true` after first seed effect) so `DiscoveryScreen` can distinguish the brief pre-seed loading frame from a genuinely empty queue. When `seeded && !currentProduct`, the screen shows an error state with a `reset()` retry button.

---

### Outfit AI (`src/services/outfitAI.js`)

```js
generateOutfit({ closetItems, weather, occasion, dateStr, gender, occupation })
  → Promise<{ items, itemIds, reasoning, weatherNote, occasionTag, generatedAt } | null>
```

- Calls `anthropicOutfit` Firebase Function via `httpsCallable`
- Selects 2–4 items: ≥1 top + ≥1 bottom (or dress), optional outerwear if temp < 16°C or precipitation
- Pre-filters to current season; further filters by occasion if ≥5 candidates remain
- `closetItems` may be real ClosetItems or normalised liked items — both shapes handled
- Session-cached: `stylelab_outfit_{dateStr}_{occasion}_{closetHash}`
- Returns `null` on API failure, malformed JSON, or pool < 3 items — callers must handle null

**Stale-closure pattern:** `runGenerate` in `DailyLookScreen` reads from `poolRef.current` (kept in sync via `useEffect`) rather than capturing `itemPool` directly — avoids stale pool values in effects/callbacks.

---

### Trip AI (`src/services/tripAI.js`)

```js
generateTrip({ destination, nights, closetItems, gender })
  → Promise<{ destination, nights, packingList, dailyOutfits, gapItems }>
```

- Calls `anthropicTrip` Firebase Function (90s client timeout)
- Passes minimal item metadata (id, name, category, color, seasons) — full ClosetItem objects stay client-side
- `TripPlannerScreen` re-hydrates items from `closetItems` after receiving the response

---

### Virtual Try-On (`src/services/tryOn.js`)

- Calls `generateTryOn` Firebase Function (Replicate IDM-VTON model)
- Supports multi-piece chaining: bottoms → tops → outerwear layer ordering
- Results cached per-user in Firestore to avoid re-running the same try-on
- 30-second cooldown per user enforced server-side

---

### Weather (`src/services/weather.js`)

- Calls `getWeather` Firebase Function — passes `{ lat, lon }` from browser geolocation
- Coordinates rounded to 2 decimal places (~1 km precision) before caching
- Caches 30 min in `sessionStorage` under `stylelab_weather`; geolocation position cached 1 hour
- Returns `null` silently if geolocation denied; logs + returns `null` on API failure
- `getWeatherEmoji(condition)` → emoji string

---

### Prettify (`src/services/prettify.js`)

- Uses `@imgly/background-removal` WASM, lazy-loaded on first call
- `prettifyImage(source, onProgress) → Promise<Blob>`
- Accepts `File`, `Blob`, or URL string
- Result stored in Firebase Storage at `users/{uid}/wardrobe/prettified/{itemId}.png`

---

### Image Services

**`pexels.js`** — Pexels API via `searchImages` Function (`source: 'pexels'`). Bounded cache, fallback query chain for aesthetic mood boards. `fetchPhotosWithFallback` is the primary export.

**`google.js`** — Google Custom Search via `searchImages` Function (`source: 'google'`). Module-level `disabled` flag flips to `true` when function returns `{ quotaExceeded: true }` — fallback to Pexels kicks in silently for the rest of the session.

**`unsplash.js`** — Unsplash API via `searchImages` Function (`source: 'unsplash'`). Secondary source for backgrounds and inspiration imagery.

**`CatalogSearchSheet`** tries Google first, falls back to Pexels. If both return empty, shows a generic "no results" error.

---

### Cache (`src/services/cache.js`)

`createBoundedCache(max = 150)` returns a `{ has, get, set }` Map wrapper that evicts the oldest entry (FIFO, O(1)) once the limit is reached. Used by `google.js`, `pexels.js`, and `unsplash.js`. **When adding a new service that caches responses, use this instead of `new Map()`.**

---

### Logger (`src/services/logger.js`)

```js
logError(service, message, context)  // → console.error + Sentry exception
logWarn(service, message, context)   // → console.warn  + Sentry warning
```

All service files import from here instead of calling `console.error` directly — keeps Sentry wiring in one place. Sentry only active in production (`import.meta.env.PROD`). In dev, only the `console.*` output fires.

---

### Crash Reporter (`src/services/crashReporter.js`)

Collects client-side diagnostics (browser info, error logs, network failures) and submits via the `submitCrashReport` Firebase Function. Used by `CrashReportSheet`.

---

### Firebase Init (`src/services/firebase.js`)

Initialises Auth, Firestore, Storage, and Functions. Calls `connectFunctionsEmulator('localhost', 5001)` when `VITE_USE_EMULATOR=true`.

---

## Firebase Functions (`functions/index.js`)

All third-party API calls requiring secret keys go through Firebase Gen 2 callable functions deployed to `us-central1`. The browser never holds any API key except the public Firebase config.

**Auth enforcement:** Every function calls `requireAuth(request)` — unauthenticated calls throw `HttpsError('unauthenticated')` immediately. The Firebase SDK passes the user's ID token automatically on every `httpsCallable` call.

| Function | Timeout | Proxies / Model | Purpose |
|----------|---------|-----------------|---------|
| `validateEmail` | 10s | DNS MX lookup | Pre-signup email domain validation |
| `anthropicVision` | 90s | Claude Haiku (vision) | Outfit photo analysis — detects items, bounding boxes, categories, colours |
| `anthropicOutfit` | 60s | Claude Haiku | Daily outfit generation from wardrobe + weather/occasion |
| `anthropicTrip` | 120s | Claude Haiku, max_tokens 1500 | Trip packing list + daily outfit plan |
| `getWeather` | 30s | OpenWeatherMap | Geolocation weather (lat/lon → temp, condition, humidity, wind) |
| `searchImages` | 30s | Pexels / Google CSE / Unsplash | Image search via `source` param; used for mood boards + catalog search |
| `proxyImage` | 30s | Fetch (CORS bypass) | Server-side image proxy for allowed hosts (pexels, google, unsplash) → base64 data URL |
| `generateTryOn` | 300s | Replicate IDM-VTON | AI virtual try-on; chains multiple garments with layer ordering; 30s cooldown/user |
| `submitFeedback` | 30s | Firebase Admin + Gmail | Stores feedback in Firestore + emails `ytmunayi@gmail.com` |
| `submitCrashReport` | 30s | Firebase Admin + Gmail | Logs diagnostics to Firestore + emails `ytmunayi@gmail.com` |

**Model constant:** All three Anthropic functions read from `CLAUDE_HAIKU` constant in `functions/index.js`. Change it there to upgrade all Claude calls at once.

---

### Deployment

```bash
cd functions && npm install   # first time only
firebase deploy --only functions
firebase deploy --only firestore:rules
```

**Local emulator:** Set `VITE_USE_EMULATOR=true` in client `.env`, then:
```bash
firebase emulators:start --only functions
```

**Adding a new proxied API:** Add an `onCall` export to `functions/index.js`, add the key to `functions/.env` and the Firebase console env vars, then call via `httpsCallable(functions, 'functionName')` on the client.
