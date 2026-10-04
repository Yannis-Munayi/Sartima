# Services & Firebase Functions

## Client Services (`src/services/`)

### Discovery Queue (`src/hooks/useDiscoveryQueue.js`)

The discovery feed and the 40-item quiz deck. Ranking is the taste model (below); the hook keeps a local copy of the stored taste profile, applies each swipe to it immediately, and asks `rankFeed` for the next batch. Queue is buffered 30 items ahead and refills when ≤8 remain. Excluded from every batch: items queued or swiped this visit, items in the profile's recent `touches` (acted on in earlier visits), and the other gender's catalog. Cold start (no evidence, no quiz, no aesthetic tally) is a Fisher–Yates shuffle (`src/services/shuffle.js`). Closet context: catalog-backed closet items plus `useClosetGaps` deficits (only once the closet has items), plus categories the user said they lack at onboarding.

The quiz result (`styleScores`) is unchanged and separate from the model: liked items' `styleWeights` summed on top of the persisted `styleAffinities` and the onboarding warm start. `slotOf(productId)` returns the feed slot an item was served in (`exploit` / `adjacent` / `wildcard` / `cold`); `DiscoveryScreen` passes it on its `like` / `skip` signals, and `feed_swipe` analytics carries it.

Exposes `seeded` (boolean — flips `true` after first seed effect) so `DiscoveryScreen` can distinguish the brief pre-seed loading frame from a genuinely empty queue. When `seeded && !currentProduct`, the screen shows an error state with a `reset()` retry button.

---

### Outfit AI (`src/services/outfitAI.js`)

```js
generateOutfit({ closetItems, weather, occasion, dateStr, gender, occupation })
  → Promise<{ items, itemIds, reasoning, weatherNote, occasionTag, missingCategory, generatedAt } | null>
```

- Calls `anthropicOutfit` Firebase Function via `httpsCallable`
- Selects 2–4 items: ≥1 top + ≥1 bottom (or dress), optional outerwear if temp < 16°C or precipitation
- Pre-filters to current season; further filters by occasion if ≥5 candidates remain
- `closetItems` may be real ClosetItems or normalised liked items — both shapes handled
- Session-cached: `stylelab_outfit_{dateStr}_{occasion}_{closetHash}`
- Returns `null` on API failure, malformed JSON, or pool < 3 items — callers must handle null
- If the wardrobe can't complete an outfit, the response's `missingCategory` names the blocking category — `TodayTab` persists it via `recordGapSignal` so the Home notification bell's gap item can react

**Stale-closure pattern:** the generation callback reads from a `poolRef.current` (kept in sync via `useEffect`) rather than capturing the item pool directly — avoids stale pool values in effects/callbacks.

---

### Wear Tracking (`src/services/wearTracking.js`)

`recordWear(closetItems, itemIds, updateClosetItem, dateStr)` — bumps `timesWorn` / `lastWorn` on each closet item when an outfit is logged. Denormalised: piggybacks on `ClosetContext.updateClosetItem`, so the fields ride inside `prefs/closet` with no new document or rules. Liked (non-closet) items are skipped. Feeds the "Least worn" closet sort and the monthly recap.

---

### Wardrobe Recap (`src/hooks/useWardrobeRecap.js` + `src/services/recapSeen.js`)

`useWardrobeRecap(user)` aggregates the trailing 30 days of outfit-log entries (via `useOutfitLog`) + closet wear data into: outfits logged, unique items worn, most-worn item, "closet ghosts" (never worn in the window), and repeat rate. Returns `null` while loading.

`recapSeen.js` stores `lastShownMonth` in `prefs/recapSeen` so `WardrobeRecapCard` surfaces once per month (fails closed — doesn't nag if the read errors).

---

### Closet Gaps (`src/hooks/useClosetGaps.js`, `gapSignals.js`, `gapDismissals.js`, `gapReasoning.js`)

One coherent "what's missing" surface with two triggers:

- **`useClosetGaps(extraSeverity)`** — instant, free: diffs per-category closet counts against `CAPSULE_BASELINE` (`src/data/capsuleBaseline.js`; dresses intentionally has no floor) and ranks deficits.
- **`gapSignals.js`** — persists `missingCategory` hits from outfit generation to `prefs/gapSignals` (`recordGapSignal` / `loadGapSignals`); `useGapSignals()` shapes them as the `extraSeverity` bump.
- **`gapDismissals.js`** — per-category snooze (14 days) in `prefs/gapDismissals`.
- **`gapReasoning.js`** — calls `anthropicGapReasoning` for 1–2 sentences of personalised stylist copy; sessionStorage-cached per day+category+owned-count; returns `''` on failure.

Consumed by `useHomeNotifications`, which surfaces the top gap as an item in the Home `NotificationBell` panel and deep-links to `wardrobe-builder:{pieceId}`. The reasoning call only fires once the user opens the panel.

---

### Wardrobe Recommend (`src/services/wardrobeRecommend.js`)

Shop Scout's engine and data: `PIECE_OPTIONS` (wizard piece list mapping to catalog `productTypes`), `STARTER_CAPSULE`, `BUDGET_TIERS`, `PRIORITIES`, plus `recommendProducts()` (scores catalog products against selected pieces, budget tier, priorities, style scores, and the interest graph) and `findComplements()` (suggests pieces that pair with the current selection). Step 1 opens with "You're short on": `useGapPieces` takes the same closet gaps as the Home bell (`useClosetGaps` + `useGapSignals`, honouring bell dismissals; signed in with 3+ closet items only). `gapPieceOption()` turns each gap into the best-fitting piece in that category that isn't already in the closet (matched on item names), falling back to `GAP_PIECE_FOR_CATEGORY`. Next comes "Picked for your style": `drawnPieceOptions()` ranks catalog garment types by style fit (via `makeFacetRanker` in `styleRanking.js`). A type that is a basic piece's headline type (its first `productTypes` entry) shows as that basic piece; any other type becomes a personal piece with id `type:{catalogType}`. Always resolve piece ids with `getPieceOption(id)`, never `PIECE_BY_ID` directly, so personal pieces work in every step. `matchesScoutGender()` is the shared gender filter: catalog tags are `men`/`women`/`unisex`, and "Both" sees everything.

---

### Taste Model (`src/services/tasteModel.js` + `src/services/tasteProfile.js`)

The discovery feed's ranking algorithm. `tasteModel.js` is pure (no React, Firestore or catalog imports); every tunable number lives in its `DEFAULTS`.

- **Learning** — signed, decaying tallies stored as `{v, t}` and decayed when read (half-lives: aesthetics 60d, brand/type 90d, colour 45d, searches 3d, session layer 20min). Event strengths: like 3, save 5, closet add 6, pin 8, hide −6; a skip only gently penalises aesthetics the product is tagged 4+ on. Brand/type/colour learn a smoothed liked-per-shown rate. One counted event per type per item per day, with diminishing returns on repeats; `unlike` / `unsave` reverse a like / save.
- **Scoring** (`scoreAll`) — cosine match of the product's style vector against the learned affinity, plus type/brand/colour rates, price fit, closet fit (gaps + `outfitCompanions`), search boost, an exploration bonus for little-seen aesthetics, near-duplicate penalty, and a 0–0.02 random tie-break. A prior (quiz result + popularity) dominates for new profiles and fades as evidence grows.
- **Feed** (`rankFeed`) — the main items go through MMR re-ranking for variety; ~15% of each batch is reserved for adjacent-aesthetic and wildcard slots. Each entry carries a `parts` breakdown.

`tasteProfile.js` is the Sartima adapter: the shared model instance (`getTasteModel()`, built on first use, ~100 ms on desktop), catalog normalisation (`priceRange` tier → representative price; flat `outfitCompanions` split into types and product ids), `applySignals()` (interestTracker signals → model events), `loadTasteProfile(interests)` (copies the stored profile, or seeds accounts that predate it from their legacy `styleAffinities`), and `tasteCloset()`. It imports the whole catalog — load it with `import()` from eager modules.

Not wired yet (the model supports them): `search` events, `hide`, `worn`, view dwell time (`view` signals without `dwellMs` are ignored), and `createBatchLog()`.

---

### Interest Tracker (`src/services/interestTracker.js` + `InterestContext`)

Long-term interest graph in `prefs/interests`: brand/type/style/color affinities, brand & aesthetic visit counts, recent likes (capped at 20), and the taste model's profile under `taste`. `recordSignal`-style writes are debounced (2s) and batched per user; reads happen once per sign-in via `InterestContext`. The legacy tallies personalise Shop Scout results, gap reasoning context, and the browse-tab ranking below; `taste` drives the discovery feed.

The tallies merge as deltas. `taste` can't (it decays and compacts itself), so each flush replays the queued signals onto the stored profile inside the same transaction. A taste-model failure keeps the stored profile and still writes the tallies. `skip`, `unlike` and `unsave` feed only the taste model; `closetAdd` counts as a save in the tallies.

---

### Style Ranking (`src/services/styleRanking.js` + `src/hooks/useStyleAffinity.js`)

Personal ordering for the Aesthetics, Brands and Search tabs. `useStyleAffinity()` returns `{ affinity, interests, hasProfile }`. `affinity` is a 0–1 aesthetic map from `blendStyleAffinities()`, which blends the live quiz result (`state.styleScores`) with the persisted `styleAffinities`. The live half is needed because `InterestContext` doesn't reload after a quiz, so without it a quiz finished this session wouldn't reorder anything. The service is pure:
- `splitByMatch` / `sortByScore`: strongest first, ties keep their incoming order
- `scoreBrands`: a brand's best-matching aesthetic counts fully and each further one half as much, plus smaller boosts from liked brands and brand-page visits
- `buildSearchSuggestions`: brand / piece / colour chips drawn from the 200 most-aligned catalog products, scored by aligned weight × √(over-representation vs the whole catalog), boosted by the interest graph's brand/type/colour tallies. Values need minimum catalog depth so every chip opens a real results page; vague types, colour combos and substring repeats ("Coat" vs "Overcoat") are skipped

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
- Supports multi-piece chaining: bottoms → dresses → tops → outerwear layer ordering (max 3 pieces, server-side)
- Results cached per-user in Firestore to avoid re-running the same try-on
- 30-second cooldown per user enforced server-side; Pro-only (30/month + purchasable credit packs)

---

### Weather (`src/services/weather.js`)

- Calls `getWeather` Firebase Function — passes `{ lat, lon }` from browser geolocation
- Coordinates rounded to 2 decimal places (~1 km precision) before caching
- Caches 30 min in `sessionStorage` under `stylelab_weather`; geolocation position cached 1 hour
- Returns `null` silently if geolocation denied; logs + returns `null` on API failure
- `getWeatherEmoji(condition)` → emoji string

---

### Signup Email Check (`src/services/emailValidation.js`, `functions/emailValidation.js`)

- `validateSignupEmail(email)` → `{ error, suggestion }`, used by both signup surfaces (SignupFlow's `EmailStep` and `AuthScreen` signup mode) before the user can move on
- Server (`validateEmail`, public): rejects bad syntax, `noreply@`-style addresses, throwaway domains (`disposable-email-domains-js` list, subdomains included), reserved names (`example.com`, `.test`…), and domains with no mail server (NXDOMAIN, no MX, or RFC 7505 null MX). Popular providers skip DNS
- Typos of popular providers (`gamil.com`, `outlok.com`) return `suggestion` — even when the typo domain has a real mail server, since several are typosquatted. The UI shows "Did you mean …?"; tapping fills the field, submitting the same address again keeps it
- Fails open: a DNS outage throws `unavailable` and the client lets signup proceed (logged via `logWarn`) — the post-signup verification email stays the backstop. It can't prove a specific mailbox exists (any name passes at gmail.com)

---

### Notifications (`src/services/notifications.js`, `notificationPrefs.js`, `iosDetect.js`)

Daily outfit push reminders via Firebase Cloud Messaging:

- **`notifications.js`** — lazy-imports the FCM SDK; `requestNotificationToken()` registers the dedicated service worker `public/firebase-messaging-sw.js` at scope `/firebase-cloud-messaging-push-scope` (so it coexists with the root-scope Workbox SW), requests permission, and returns a token using `VITE_FIREBASE_VAPID_KEY` (null if unsupported/denied/unset). `onForegroundMessage(cb)` for in-app messages.
- **`notificationPrefs.js`** — persists `{ fcmTokens[], reminderTime, timezone, enabled }` to `prefs/notifications`; `saveNotificationToken`, `saveReminderTime`, `disableNotifications`.
- **`iosDetect.js`** — dependency-free `isIOSStandaloneRequired()`: iOS Safari only delivers web push to an installed (Add to Home Screen) PWA, so the Settings UI gates on it.
- Delivery is done by the scheduled `sendDailyOutfitReminders` Function (below).

---

### Share Card (`src/services/shareCard.js`)

Canvas composition of a 1080×1350 (4:5, IG-safe) PNG outfit card for `navigator.share({ files })`. Each item photo draw is isolated — a CORS-tainted or failed image falls back to a colour swatch instead of breaking the card. Used from `TodayTab`'s share button.

---

### Data Export (`src/services/dataExport.js`)

`downloadAllUserData(uid)` — client-side GDPR-style export: fetches the profile doc, all user-facing `prefs/*` docs, and the `quizzes` / `outfitPlans` / `uploadedItems` subcollections into a single JSON download. Deliberately excludes `prefs/usage` and `prefs/subscription` (internal counters + Stripe IDs). Triggered from Settings → Data & privacy.

---

### Subscription Service (`src/services/subscriptionService.js`)

Thin wrappers over the Stripe Functions: `createCheckoutSession(uid, plan)` (monthly/annual → redirects to Stripe Checkout), `openBillingPortal()`, `purchaseTryOnPackSession()`, plus `loadUsage` / `loadSubscription` reads. Tier/limit logic lives in `SubscriptionContext`, not here.

---

### Prettify (`src/services/prettify.js`)

- Uses `@imgly/background-removal` WASM, lazy-loaded on first call
- `prettifyImage(source, onProgress) → Promise<Blob>`
- Accepts `File`, `Blob`, or URL string (CORS-restricted URLs go through `proxyImage` first)
- Result stored in Firebase Storage at `users/{uid}/wardrobe/prettified/{itemId}.png`

---

### Image Services

**`stockPhotos.js`** — Stock photography via `searchImages` Function (`source: 'stock'`): Unsplash first, Pexels fallback. The provider chain runs server-side so a fallback doesn't cost a second rate-limited call. Bounded cache + in-flight dedupe; at most 4 calls in flight (the rest queue); a `resource-exhausted` reply is retried after 2s/5s/10s instead of moving on. `fetchPhotosWithFallback(queries)` tries alternate queries in order and is the primary export.

**`productImage.js`** — `resolveProductImage` / `getAltProductImage`: picks a product card's image (curated inline `image`/`imageMen` URL, else a stock photo for `pexelsQuery ?? name`, else the card's gradient placeholder). Used with `ProductImageToggle`.

**`CatalogSearchSheet`** searches stock photos (Unsplash → Pexels). If nothing comes back, shows a generic "no results" error.

---

### Cache (`src/services/cache.js`)

`createBoundedCache(max = 150)` returns a `{ has, get, set }` Map wrapper that evicts the oldest entry (FIFO, O(1)) once the limit is reached. Used by `stockPhotos.js`. **When adding a new service that caches responses, use this instead of `new Map()`.**

---

### Logger (`src/services/logger.js`)

```js
logError(service, message, context)  // → console.error + Sentry exception
logWarn(service, message, context)   // → console.warn  + Sentry warning
```

All service files import from here instead of calling `console.error` directly — keeps Sentry wiring in one place. Sentry only active in production (`import.meta.env.PROD`). In dev, only the `console.*` output fires.

---

### Crash Reporter (`src/services/crashReporter.js`)

Collects client-side diagnostics (browser info, error logs, network failures) and submits via the `submitCrashReport` Firebase Function. Used by `CrashReportSheet`. Initialised in `main.jsx` before React mounts.

---

### Firebase Init (`src/services/firebase.js`)

Initialises Auth, Firestore, Storage, Functions, and **consent-gated Analytics**: `getAnalyticsConsent()` / `setAnalyticsConsent(granted)` persist to `localStorage` (`sartima_analytics_consent`); `enableAnalytics()` only runs after consent; `trackEvent(name, params)` is a safe no-op until then. Calls `connectFunctionsEmulator('localhost', 5001)` when `VITE_USE_EMULATOR=true` in dev.

---

## Firebase Functions (`functions/index.js`)

All third-party API calls requiring secret keys go through Firebase Gen 2 callable functions deployed to `us-central1`. The browser never holds any API key except the public Firebase config.

**Auth enforcement:** Every function except `validateEmail`, `submitFeedback`, `submitCrashReport`, and `searchImages` (guest browsing needs photos; guests are rate-limited by IP) calls `requireAuth(request)` — unauthenticated calls throw `HttpsError('unauthenticated')`. The Firebase SDK passes the user's ID token automatically on every `httpsCallable` call.

**Tier enforcement:** `getUserTier(request.auth.token)` reads the `sartima_role` / `sartima_tier` custom claims straight off the decoded ID token (no Admin SDK round-trip). `checkAndIncrementUsage(uid, field, limit)` runs a Firestore transaction on `users/{uid}/prefs/usage` — monthly counters reset when `periodKey` (YYYY-MM) changes. Server limits (`TIER_LIMITS`): free = 3 vision uploads, 0 trips, 0 try-ons, 20 gap reasonings; pro = 30 / 3 / 30 / 200; admin = unlimited. Free outfit generation is a per-day gate on `lastOutfitDate`. Pro try-ons drain the monthly allowance first, then purchased `tryOnCredits` (never reset).

| Function | Timeout | Proxies / Model | Purpose |
|----------|---------|-----------------|---------|
| `validateEmail` | 10s | DNS MX lookup | Pre-signup email check (no auth): syntax, throwaway domains, mail server, typo suggestion — `functions/emailValidation.js` |
| `anthropicVision` | 90s | `generateJson` (vision) | Outfit photo analysis — items, categories, colours, bounding boxes. The model returns `box_2d` `[ymin, xmin, ymax, xmax]` on a 0–1000 scale (Gemini schema-enforced); `boxToBbox` converts to `{x,y,w,h}` percentages, or `null` if invalid. Usage-limited (`visionUploads`, refunded on AI failure). |
| `anthropicOutfit` | 60s | `generateJson` | Daily outfit from wardrobe + weather/occasion. Free: 1/day (`lastOutfitDate` cleared again if the AI call fails). Returns `missingCategory` when the wardrobe can't complete an outfit. |
| `anthropicGapReasoning` | 30s | `generateJson` | 1–2 sentence personalised "why fill this gap" copy for the Home notification-bell gap item. Usage-limited (`gapReasoning`, refunded on failure). |
| `anthropicTrip` | 120s | `generateJson`, 1500-token answer | Trip packing list + daily outfit plan. Usage-limited (`tripPlans`, refunded on failure). |
| `getWeather` | 30s | OpenWeatherMap | Geolocation weather (lat/lon → temp, condition, humidity, wind) |
| `searchImages` | 30s | Unsplash / Pexels | Image search via `source` param: `'stock'` (default; any unknown/retired source such as `'google'` too) tries Unsplash then Pexels in one call; `'unsplash'` / `'pexels'` hit one provider. Unsplash 403/429 → skipped for 15 min. In-memory result cache (6h TTL, 2,000 entries; cache hits skip the rate limit). In-process token bucket per uid, or per IP for guests (burst 60, refill 1/s). No auth required. |
| `proxyImage` | 30s | Fetch (CORS bypass) | Server-side image proxy for allowed hosts (pexels, googleusercontent, unsplash, gstatic thumbnails) → base64 data URL |
| `generateTryOn` | 300s | Replicate IDM-VTON (`cuuupid/idm-vton`, pinned version) | Multi-garment try-on chained server-side (≤3 pieces, layer-ordered). 30s cooldown/user. Pro-only; monthly allowance then credits. |
| `submitFeedback` | 30s | Firebase Admin + Gmail | Stores feedback in Firestore + emails the owner |
| `submitCrashReport` | 30s | Firebase Admin + Gmail | Logs diagnostics to Firestore + emails the owner |
| `sendDailyOutfitReminders` | scheduled | FCM | Runs **every 15 minutes** (Cloud Scheduler). Collection-group query on `prefs` where `enabled == true`; sends a push to users whose local `reminderTime` falls in the current 15-min bucket (timezone-aware); prunes stale FCM tokens. |
| `createStripeCheckout` | 30s | Stripe | Subscription checkout session (monthly/annual price IDs); creates/reuses the Stripe customer; redirects back with `?upgrade=success` |
| `createStripeBillingPortal` | 30s | Stripe | Billing portal session for existing subscribers |
| `purchaseTryOnPack` | 30s | Stripe | One-time checkout for 30 try-on credits (Pro only) |
| `stripeWebhook` | 60s | Stripe (onRequest) | Signature-verified, idempotent (returns 500 on failure so Stripe retries). `checkout.session.completed` / `async_payment_succeeded` (only once `payment_status` is paid) → merges `sartima_tier: 'pro'` into claims + writes `prefs/subscription`, or credits `tryOnCredits` +30 for packs (deduped via `fulfilledCheckouts/{sessionId}`). `customer.subscription.updated` → active restores Pro; `past_due`/`unpaid` starts a **7-day grace period** (`graceEndsAt`, client shows `PaymentDueModal`). `customer.subscription.deleted` → user cancellations keep Pro until the paid period ends; non-payment ends at grace end. Delayed downgrades go in `billingDowngrades/{uid}`. |
| `enforceBillingDowngrades` | scheduled | Admin SDK | Runs **every 60 minutes**. Applies `billingDowngrades/{uid}` entries whose `downgradeAt` has passed → claim `free`. |
| `deleteAccount` | 120s | Stripe + Admin SDK | Full account deletion in retry-safe order: cancel Stripe subscription → delete Storage (`wardrobe/`, `avatar/`) → `recursiveDelete` the Firestore user tree → delete the Auth user last. |

**AI provider (`functions/ai.js`):** All four AI callables (still named `anthropic*` so the client never changes) call `generateJson({ prompt, image?, maxTokens, schema?, budgetMs })`, which returns parsed JSON. Provider failures throw `HttpsError('unavailable')`, and unparseable replies throw `'internal'`. The provider is Gemini when `GEMINI_API_KEY` is set, otherwise Claude; `AI_PROVIDER=gemini|anthropic` forces one.
- **Gemini** goes over plain REST with no SDK. It tries `GEMINI_MODELS` in order (`gemini-3.8-flash` → `gemini-3.1-flash-lite` → `gemini-2.5-flash`), moving to the next on 429/5xx/timeouts within `budgetMs`, because the free tier frequently returns 503 "high demand". Thinking is kept low, since thinking tokens count against `maxOutputTokens`. `responseMimeType: application/json`, plus `responseJsonSchema` when a schema is given.
- **Claude** uses the `CLAUDE_HAIKU` constant (`claude-haiku-4-5-20251001`).
- **Free-tier caveat:** Google may use free-tier Gemini content to improve its products. The privacy policy (`legalContent.js`) discloses this; revisit it if you move to a paid tier.

**Email helper:** `sendEmail(subject, text)` uses nodemailer + `GMAIL_APP_PASSWORD`; silently skipped when the env var is absent.

**Stripe secrets** are declared per-function via the `secrets: [...]` option: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_MONTHLY`, `STRIPE_PRICE_ID_ANNUAL`, `STRIPE_PRICE_ID_TRYON_PACK`. `APP_URL` (default `https://sartima.ca`) builds the redirect URLs.

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

**Adding a new proxied API:** Add an `onCall` export to `functions/index.js`, add the key to `functions/.env` and the Firebase console env vars (or `secrets:` for Stripe-style secrets), then call via `httpsCallable(functions, 'functionName')` on the client.
