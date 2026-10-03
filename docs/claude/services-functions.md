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

Shop Scout's engine and data: `PIECE_OPTIONS` (wizard piece list mapping to catalog `productTypes`), `STARTER_CAPSULE`, `BUDGET_TIERS`, `PRIORITIES`, plus `recommendProducts()` (scores catalog products against selected pieces, budget tier, priorities, style scores, and the interest graph) and `findComplements()` (suggests pieces that pair with the current selection).

---

### Interest Tracker (`src/services/interestTracker.js` + `InterestContext`)

Long-term interest graph in `prefs/interests`: brand/type/style/color affinities, brand & aesthetic visit counts, recent likes (capped at 20). `recordSignal`-style writes are debounced and batched per user; reads happen once per sign-in via `InterestContext`. Used to personalise Shop Scout results and gap reasoning context.

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
| `anthropicVision` | 90s | Claude Haiku (vision) | Outfit photo analysis — items, categories, colours, bounding boxes. Usage-limited (`visionUploads`). |
| `anthropicOutfit` | 60s | Claude Haiku | Daily outfit from wardrobe + weather/occasion. Free: 1/day. Returns `missingCategory` when the wardrobe can't complete an outfit. |
| `anthropicGapReasoning` | 30s | Claude Haiku | 1–2 sentence personalised "why fill this gap" copy for the Home notification-bell gap item. Usage-limited (`gapReasoning`). |
| `anthropicTrip` | 120s | Claude Haiku, max_tokens 1500 | Trip packing list + daily outfit plan. Usage-limited (`tripPlans`). |
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

**Model constant:** All Anthropic functions read from the `CLAUDE_HAIKU` constant in `functions/index.js` (`claude-haiku-4-5-20251001`). Change it there to upgrade every Claude call at once.

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
