# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**StyleLab** is a fashion discovery and personal styling PWA built as a mobile-first web app. It helps users identify their personal aesthetic, explore curated fashion content, build a digital wardrobe, and plan daily outfits — powered by AI and a large hand-curated product catalog.

**Core problem it solves:** Most people lack a clear vocabulary for their own style. StyleLab gives users a framework (aesthetic labels like "old money," "streetwear," "dark academia") through an interactive quiz, then delivers personalized content and AI-driven daily outfit recommendations around that identity. The downstream goal is converting discovery into real purchases.

**Target audience:** Fashion-conscious Gen Z and younger Millennials (16–30) who engage with aesthetics culture on TikTok/Pinterest. Both men and women, with a gender preference filter throughout.

### Key Features

1. **Style Discovery Quiz** — Swipe-based quiz (like/skip clothing items) that computes affinity scores across 20+ aesthetics. Seasons and categories are set upfront to seed the item pool. Results stored in `styleScores` in AppContext.

2. **Onboarding Flow** — Post-signup 4-step wizard (occupation → brands → referral → shopping email) in `src/screens/onboarding/`. Completion saved to Firestore `users/{uid}` as `onboardingComplete: true`.

3. **Personalized Discovery Feed** — Infinite product feed driven by `useDiscoveryQueue.js`. Scores products against evolving style affinities (brand × 10, type × 15, color × 5, style × 0.5), injects outfit companions, enforces diversity (max 3 same brand / 4 same type per batch), and buffers 30 items ahead.

4. **Aesthetic Exploration** — 20+ fully fleshed-out aesthetic profiles (minimalist, preppy, Y2K, gorpcore, etc.) each with brand lists, outfit inspiration, color palettes, styling guides, Pinterest-linked galleries, and shopping sections. Users can pin aesthetics to a personal tab.

5. **Digital Closet** — Users upload outfit photos or search the product catalog; Claude Opus 4.7 (vision) analyzes images and extracts items. Items stored in `ClosetContext` with optional background removal ("prettify") via `prettify.js` (imgly WASM). Persisted to Firestore `users/{uid}/prefs/closet`.

6. **Daily Look Engine** — `DailyLookScreen` with 4 sub-tabs: **Today**, **My Log**, **Calendar**, **Trip**. The Today tab has a source selector (Closet / Liked / Both) so users can generate outfits from their digital closet, their liked quiz items, or both combined. `outfitAI.js` calls Claude Haiku to select 2–4 items filtered by season/occasion/weather, with session-level caching. Liked items are normalised to the ClosetItem shape before being passed to the AI. Outfit cards without stored photos auto-fetch images from Pexels. Outfit entries logged to `users/{uid}/prefs/outfitLog`.

7. **Outfit Calendar** — Monthly planner (`OutfitCalendarScreen`) where users plan daily outfit combinations from their closet. Saved to Firestore `users/{uid}/outfitPlans` collection.

8. **Trip Planner** — `TripPlannerScreen` uses Claude Haiku to generate packing lists and daily outfit plans for a trip destination, based on the user's closet items.

9. **Wardrobe Builder** — Guided capsule wardrobe wizard (`WardrobeBuildScreen`) — select pieces + budget + priorities → curated product recommendations from the catalog.

10. **Wishlist, Liked Items & Outfit Boards** — Liked items from quiz/feed, wishlist (buy intent), outfit boards for curating combinations. All Firestore-persisted per user via `WishlistContext`.

11. **Home Feed** — Hero aesthetic carousels (5 featured aesthetics), daily rotating fresh looks, Style Me Today CTA card, seasonal picks, trending styles, and a wardrobe builder CTA.

## Commands

```bash
npm run dev        # Start Vite dev server with HMR
npm run build      # Production build (Vite + chunk splitting)
npm run preview    # Preview production build locally
```

No test or lint scripts are currently configured.

## Stack

- **React 18 + Vite 5** — SPA, ES modules, CSS Modules per component
- **Firebase** — Auth (email/password + Google OAuth), Firestore (user data), Storage (closet photos)
- **Anthropic Claude API** — Vision analysis, outfit generation, and trip planning (`claude-haiku-4-5-20251001`) — all calls go through Firebase Functions proxy, never directly from the browser
- **Firebase Functions (Gen 2)** — Server-side proxy for all third-party API calls; holds keys securely. Deployed to `us-central1`. Functions: `anthropicVision`, `anthropicOutfit`, `anthropicTrip`, `getWeather`, `searchImages`
- **OpenWeatherMap** — Live weather for daily outfit recommendations, proxied via `getWeather` function
- **imgly/background-removal** — WASM-based background removal for closet photos ("prettify")
- **Pexels / Google Custom Search / Unsplash** — Image fetching and product search, proxied via `searchImages` function
- **Sentry** (`@sentry/react`) — Production error tracking. Initialised in `main.jsx`, enabled only in production builds (`import.meta.env.PROD`). DSN from `VITE_SENTRY_DSN`. All service errors route through `src/services/logger.js` → Sentry automatically.
- **PWA** — Vite PWA plugin with Workbox caching rules

## Architecture

### Screen Routing

Navigation is **not** React Router. `App.jsx` renders screens conditionally based on `state.screen` from `AppContext` and `activeTab` local state. The quiz flow is a linear state machine: `AUTH → WELCOME → ONBOARDING → SEASONS → CATEGORIES → DISCOVERY → RESULTS`. Once the quiz is complete, a tab bar appears for the main app.

`AppShell` in `App.jsx` owns tab state, the resume modal, and profile scroll targeting. Guide tour logic (step state, navigation, screen transitions) lives in `src/hooks/useGuideController.js` — `AppShell` calls it and receives `{ guideStep, startGuide, guideNext, guideBack, guideSkip, guideContextValue }`.

**Known debt:** `setActiveTab` (exposed as `handleTabChange`) is passed as a prop to `HomeScreen`, `ExploreScreen`, `AestheticScreen`, `DailyLookScreen`, `ProfileScreen`, and `ResultsScreen`. A NavigationContext would be cleaner but hasn't been done yet — touching all six screens carries regression risk.

Provider nesting order (outermost first):
`AuthProvider → AppProvider → ShopProvider → WishlistProvider → ClosetProvider → ExploreProvider`

### Context Providers

All global state lives in `src/context/`. Read the relevant context before touching related screens:

| Context | Owns |
|---|---|
| `AppContext` | Quiz flow state machine (`screen`, `styleScores`, `quizMode`, `gender`), screen transitions, item queue |
| `AuthContext` | Firebase Auth session, user profile CRUD |
| `ClosetContext` | Digital closet items (`closetItems`, `closetByCategory`), Firestore sync, add/update/remove. Also exposes `closetError` and `retryLoadCloset`. |
| `ExploreContext` | Pinned aesthetic tabs, Firestore sync for saved aesthetics |
| `ShopContext` | Shopping list with retailer filters |
| `WishlistContext` | Wishlist, liked items, outfit boards — all Firestore-persisted per user |
| `GuideContext` | Onboarding tour step state |

Guest users get session-only storage; Firestore sync only activates on sign-in.

### SCREENS Constants (`src/context/AppContext.jsx`)

```
AUTH, WELCOME, ONBOARDING, SEASONS, CATEGORIES, DISCOVERY, RESULTS, PROFILE
```

Tab bar is hidden on `AUTH`, `ONBOARDING`, `SEASONS`, `CATEGORIES`.

### Tab Bar Tabs (`src/components/TabBar.jsx`)

6-tab scrollable layout, left to right: **Home** | **Closet** | **Explore** | **Discover** (center, elevated) | **Daily** | **Profile**

Tab IDs used in `handleTabChange`:
- `home` → `HomeScreen`
- `closet` → `ClosetScreen` (3 sub-tabs: My Closet · Outfits · Liked)
- `explore` → `ExploreScreen`
- `quiz` → quiz flow (DiscoveryScreen / ResultsScreen)
- `daily` → `DailyLookScreen` (4 sub-tabs: Today · My Log · Calendar · Trip)
- `wardrobe-builder` → `WardrobeBuildScreen` (hidden from tab bar, navigated directly)
- `mystyle` → `MyStyleScreen` (legacy; still rendered if navigated to, e.g. from GuideTour, but not in the tab bar)
- `aesthetic:{id}` → `AestheticScreen` (dynamic, created via `openAestheticTab`)
- `profile` → `ProfileScreen`

**Closet sub-tab routing:** `closet:{subTab}` routes to `ClosetScreen` and sets the sub-tab (e.g. `closet:liked`, `closet:outfits`).

### Closet Data Model (`src/context/ClosetContext.jsx`)

```js
{
  id: string,
  name: string,
  category: 'tops' | 'bottoms' | 'outerwear' | 'dresses' | 'footwear' | 'accessories',
  color: string,
  brand: string,
  imageUrl: string,       // original upload URL
  thumbnailUrl: string,   // search result or upload URL
  prettifiedUrl: string,  // background-removed PNG (Firebase Storage)
  type: 'uploaded' | 'catalog',
  favorite: boolean,
  tags: string[],
  seasons: string[],      // 'spring' | 'summer' | 'fall' | 'winter'
  occasions: string[],    // 'casual' | 'work' | 'date' | 'gym' | 'errand' | 'formal' | 'outdoor'
  aiDetected: boolean,
  addedAt: number,
  updatedAt: number,
}
```

Persisted at `users/{uid}/prefs/closet` → `{ items: [...] }`.

`ClosetContext` exposes `closetError` (the raw Error or null) and `retryLoadCloset` (re-triggers the Firestore fetch for the current user, bypassing the already-loaded guard). `ClosetScreen` shows an error state with a Retry button when `closetError` is set. The fetch is extracted into `loadItems` (a `useCallback`) so both the mount effect and the retry button share the same logic.

**Context sync pattern (applies to all persisted contexts):** The initial `getDoc` uses the functional form of `setState` in `.then` so that any items added while the load was in-flight are preserved rather than overwritten. Items that arrived during the load window are prepended to the Firestore data.

### Discovery Queue (`src/hooks/useDiscoveryQueue.js`)

The core recommendation engine. Items are scored by affinity weights (brand, type, color, style) derived from quiz responses. A diversity injector prevents repetitive results. On cold start it shuffles randomly; subsequent batches are personalized. The queue is buffered and refills automatically.

Scoring weights: brand × 10, type × 15, parentType × 4, color × 5, style × 0.5, companion bonus × 8–12.

Exposes `seeded` (boolean, flips `true` after the first seed effect runs) so `DiscoveryScreen` can distinguish the brief pre-seed loading frame from a genuinely empty queue. When `seeded && !currentProduct`, the screen shows an error state with a `reset()` retry button.

### Outfit AI (`src/services/outfitAI.js`)

```js
generateOutfit({ closetItems, weather, occasion, dateStr, gender, occupation })
  → Promise<{ items, itemIds, reasoning, weatherNote, occasionTag, generatedAt } | null>
```

- Calls `anthropicOutfit` Firebase Function via `httpsCallable` — no Anthropic SDK on the client
- Model: controlled by `CLAUDE_HAIKU` constant in `functions/index.js` — change it there to upgrade all three Claude functions at once
- `closetItems` may be real ClosetItems or normalised liked items — both shapes are handled
- Selects 2–4 items: ≥1 top + ≥1 bottom (or dress), optional outerwear if temp < 16°C or precipitation
- Pre-filters to current season; further filters by occasion if ≥5 candidates remain
- Session-cached in `sessionStorage` by `stylelab_outfit_{dateStr}_{occasion}_{closetHash}`
- Returns `null` on API failure, malformed JSON, or pool < 3 items — callers must handle null

**Stale-closure pattern in `DailyLookScreen`:** `runGenerate` reads from `poolRef.current` (a `useRef` kept in sync via `useEffect`) rather than capturing `itemPool` directly. This avoids stale pool values when the function is called from effects or callbacks.

### Trip AI (`src/services/tripAI.js`)

```js
generateTrip({ destination, nights, closetItems, gender })
  → Promise<{ destination, nights, packingList, dailyOutfits, gapItems }>
```

- Calls `anthropicTrip` Firebase Function via `httpsCallable` (90s client timeout)
- Model: `CLAUDE_HAIKU` constant in `functions/index.js`, max_tokens 1500
- Passes minimal item metadata (id, name, category, color, seasons) — full ClosetItem objects stay client-side
- `TripPlannerScreen` re-hydrates items from `closetItems` after receiving the response

### Weather Service (`src/services/weather.js`)

- Calls `getWeather` Firebase Function via `httpsCallable` — passes `{ lat, lon }` from browser geolocation
- Coordinates rounded to 2 decimal places (~1 km precision) before caching — sufficient for weather, avoids storing exact address in sessionStorage
- Caches 30 min in `sessionStorage` under `stylelab_weather`; geolocation cached 1 hour
- Returns `null` silently if geolocation denied; logs and returns `null` on API failure
- `getWeatherEmoji(condition)` → emoji string

### Prettify Service (`src/services/prettify.js`)

- Uses `@imgly/background-removal` WASM (lazy-loaded on first call)
- `prettifyImage(source, onProgress) → Promise<Blob>`
- Accepts `File`, `Blob`, or URL string
- Result stored in Firebase Storage at `users/{uid}/wardrobe/prettified/{itemId}.png`

### Data Layer (`src/data/`)

Large static JS files — do not import these dynamically unless necessary, as Vite already splits them:

- `aestheticItems.js` (252 KB) — quiz item pool
- `products.js` (90 KB) — 600+ products with style weight objects
- `styles.js` (55 KB) — 20+ aesthetic definitions (colors, brands, queries)
- `looks.js`, `aestheticDepth.js`, `categories.js`, `labels.js`, `itemGuide.js`, `retailers.js`

### Styling

CSS Modules (`Component.module.css`) for component-scoped styles. Global theme variables in `src/index.css`. Dark mode is default; light mode toggled via `data-theme="light"` on the root element and persisted to `localStorage` (`stylelab_theme`). Primary accent: `#E8735A`. All semantic colors use CSS variables (`--bg`, `--surface`, `--text`, etc.).

### Environment Variables

**Client (`.env`) — `VITE_` prefix, bundled into the browser:**
- `VITE_FIREBASE_*` (6 keys) — intentionally public; Firebase security is enforced by Firestore rules and Auth
- `VITE_SENTRY_DSN` — Sentry project DSN; if empty Sentry is skipped entirely (safe for local dev)

**Server (`functions/.env`) — never sent to the browser:**
- `ANTHROPIC_API_KEY`
- `OPENWEATHER_KEY`
- `PEXELS_KEY`
- `GOOGLE_API_KEY` + `GOOGLE_CX`
- `UNSPLASH_KEY`

All server keys must also be set as environment variables in the Firebase console (Functions → Edit → Environment variables) for the deployed functions to read them. `functions/.env` is for local emulator use only.

### Firebase Functions Proxy (`functions/index.js`)

All third-party API calls that require secret keys go through Firebase callable functions. The browser never holds any API key except the Firebase config (which is intentionally public).

| Function | Proxies | Timeout |
|---|---|---|
| `anthropicVision` | Anthropic vision analysis | 90s |
| `anthropicOutfit` | Anthropic outfit generation | 60s |
| `anthropicTrip` | Anthropic trip planning | 120s |
| `getWeather` | OpenWeatherMap | 30s |
| `searchImages` | Pexels / Google CSE / Unsplash (via `source` param) | 30s |

**Auth enforcement:** Every function calls `requireAuth(request)` — unauthenticated calls throw `HttpsError('unauthenticated')` immediately. The Firebase SDK (`httpsCallable`) automatically passes the user's ID token on every call.

**Deployment:**
```bash
cd functions && npm install   # first time only
firebase deploy --only functions
```

**Local dev with emulator:** Set `VITE_USE_EMULATOR=true` in the client `.env` — `firebase.js` calls `connectFunctionsEmulator(functions, 'localhost', 5001)` conditionally. Run `firebase emulators:start --only functions` to start the emulator.

**Adding a new proxied API:** Add a new `onCall` export to `functions/index.js`, add the key to `functions/.env` and the Firebase console, then call it from the client with `httpsCallable(functions, 'functionName')`.

### Firestore Rules

Rules live in `firestore.rules` (repo root) and are deployed via `firebase deploy --only firestore:rules`. Every path is locked to owner-only access (`request.auth.uid == userId`); a catch-all denies everything else.

Covered paths: `users/{uid}`, `users/{uid}/prefs/{prefId}`, `users/{uid}/outfitPlans/{planId}`, `users/{uid}/quizzes/{quizId}`, `users/{uid}/uploadedItems/{itemId}`.

**When adding new persistence:**
- Prefer `getDoc`/`setDoc` on a `prefs/{key}` document with an array field — already covered by existing rules
- If you need a new subcollection (e.g. `users/{uid}/newCollection`), add a `match` block to `firestore.rules` and redeploy before writing any data — writes to uncovered paths will be silently rejected

### Image Cache (`src/services/cache.js`)

`createBoundedCache(max = 150)` returns a `{ has, get, set }` Map wrapper that evicts the oldest entry (FIFO, O(1)) once the limit is reached. Used by `google.js`, `pexels.js`, and `unsplash.js` instead of a bare `Map()` to prevent unbounded memory growth on long sessions. Default cap is 150 entries per cache. When adding a new service that caches responses, use this instead of `new Map()`.

### Error Logging (`src/services/logger.js`)

All service-level errors route through two functions:
- `logError(service, message, context)` — logs to `console.error` and sends to Sentry as an exception (or message if no Error object)
- `logWarn(service, message, context)` — logs to `console.warn` and sends to Sentry as a warning

Every service file (`google.js`, `pexels.js`, `unsplash.js`, `weather.js`) imports from here. When adding a new service, import `logError`/`logWarn` from `./logger` rather than calling `console.error` directly — this keeps Sentry wiring in one place.

Sentry is only active in production (`import.meta.env.PROD`). In dev, only the `console.*` output fires.

### Catalog Search (`src/components/CatalogSearchSheet.jsx`)

Tries Google Custom Search first (`fetchPhotos` from `google.js`), then falls back to Pexels (`fetchPhotosWithFallback` from `pexels.js`). Both call the `searchImages` Firebase Function with `source: 'google'` or `source: 'pexels'`. Google has a module-level `disabled` flag that flips to `true` when the function returns `{ quotaExceeded: true }` — fallback silently kicks in for the rest of the session. If both return empty, shows a generic "no results" error.

### Vite Chunk Strategy

`vite.config.js` manually splits vendors: `react-core`, `firebase` (includes `firebase/functions`), `data-styles`, `data-content`. The `@anthropic-ai/sdk` is no longer a client dependency — it lives in `functions/` only. When adding heavy new dependencies, add them to the appropriate manual chunk to avoid bloating the main bundle.

### Firestore Document Map

| Path | Contents |
|---|---|
| `users/{uid}` | Profile doc: `displayName`, `email`, `occupation`, `preferredBrands`, `referralSource`, `shoppingEmail`, `onboardingComplete`, timestamps |
| `users/{uid}/prefs/closet` | `{ items: ClosetItem[] }` |
| `users/{uid}/prefs/wishlist` | `{ items: WishlistItem[] }` |
| `users/{uid}/prefs/liked` | `{ items: LikedItem[] }` |
| `users/{uid}/prefs/outfitBoards` | `{ items: OutfitBoard[] }` |
| `users/{uid}/prefs/savedAesthetics` | `{ ids: string[] }` |
| `users/{uid}/prefs/shopList` | `{ items: ShopItem[] }` |
| `users/{uid}/prefs/outfitLog` | `{ entries: OutfitLogEntry[] }` |
| `users/{uid}/outfitPlans` | Subcollection — one doc per plan, `{ date, itemIds, savedAt }`. Covered by `firestore.rules`. |
