# Sartima — Full Project Breakdown

> The complete onboarding document for anyone coming to the project cold — product overview first, technical deep-dive second.
> Last updated: July 2026. (Formerly known as **StyleLab**; the rebrand to Sartima included a new logo, palette, and domain — `sartima.ca`.)

---

## Table of Contents

**Product**
1. [What Is Sartima?](#1-what-is-sartima)
2. [Problem Statement & Goals](#2-problem-statement--goals)
3. [Target Audience](#3-target-audience)
4. [Feature Tour](#4-feature-tour)
5. [Monetization — Free vs. Pro](#5-monetization--free-vs-pro)
6. [Legal & Privacy](#6-legal--privacy)

**Technical**
7. [Tech Stack](#7-tech-stack)
8. [Navigation & Screen Architecture](#8-navigation--screen-architecture)
9. [State Management](#9-state-management)
10. [Data Architecture (Firestore & Storage)](#10-data-architecture-firestore--storage)
11. [AI Integration](#11-ai-integration)
12. [Backend — Firebase Cloud Functions](#12-backend--firebase-cloud-functions)
13. [Billing — Stripe](#13-billing--stripe)
14. [Notifications](#14-notifications)
15. [The Catalog & Static Data](#15-the-catalog--static-data)
16. [Image & Media Pipeline](#16-image--media-pipeline)
17. [Security Model](#17-security-model)
18. [Performance & PWA](#18-performance--pwa)
19. [Observability & Error Handling](#19-observability--error-handling)
20. [Development Workflow](#20-development-workflow)
21. [Environment Variables](#21-environment-variables)
22. [Known Constraints & Technical Debt](#22-known-constraints--technical-debt)
23. [Glossary](#23-glossary)

For maintenance-focused reference docs, see [`docs/claude/`](docs/claude/): [architecture](docs/claude/architecture.md) · [screens](docs/claude/screens.md) · [services & functions](docs/claude/services-functions.md) · [data models](docs/claude/data-models.md).

---

## 1. What Is Sartima?

Sartima is a **mobile-first progressive web app (PWA)** that acts as a personal fashion assistant. It gives users a vocabulary for their own style — through a swipe-based quiz across **51 named aesthetics** — then turns that identity into a personalised discovery feed, a digital closet, AI daily outfits, and curated shopping.

The core loop:
1. **Swipe** on clothing items to build a live style-affinity profile.
2. **Explore** editorial aesthetic and brand profiles matched to that profile.
3. **Digitise** your real wardrobe (photo upload + AI vision, or catalog search).
4. **Wear** — AI generates a daily outfit from your closet, grounded in live weather and occasion; logging outfits feeds wear-tracking, monthly recaps, and gap detection.
5. **Shop** — the app spots what your wardrobe is missing and routes you to curated products from a ~7,500-item catalog spanning 190 profiled brands.

The habit loop (steps 4–5) is the business: daily outfit generation builds retention, wear data powers personal insight features (recap, closet ghosts, gaps), and gaps convert into shopping intent.

## 2. Problem Statement & Goals

**The problem:** most people can't articulate their own style. They know what they like when they see it but lack a framework to shop intentionally, build a coherent wardrobe, or communicate their aesthetic.

**What Sartima solves:**
- **Aesthetic vocabulary** — the quiz assigns names (51 aesthetics from Old Money to Gorpcore) so users can navigate style culture deliberately.
- **Discovery fatigue** — an infinite personalised feed scored against the user's evolving taste profile.
- **Wardrobe paralysis** — AI daily-outfit generation, grounded in weather, occasion, and what the user actually owns.
- **Aimless shopping** — gap detection + Shop Scout convert "I have nothing to wear" into a specific, budgeted shopping list.

**Business goals:** retention through daily-habit features (outfit of the day, push reminders, monthly recap); revenue through the Pro subscription and try-on credit packs (Stripe); conversion through retailer-linked catalog products.

## 3. Target Audience

| Segment | Description |
|---|---|
| **Primary** | Fashion-conscious Gen Z (16–24). Heavy TikTok/Pinterest users, fluent in aesthetics culture, mobile-first. |
| **Secondary** | Younger Millennials (25–30) wanting intentional wardrobe curation without fashion-expert overhead. |
| **Gender** | Men / Women / Both toggle wired through the entire app (quiz items, catalog, aesthetic content, search). |
| **Age floor** | 16+ (affirmed at signup; see Legal). |
| **Device** | Primarily smartphones (iOS Safari, Android Chrome). Desktop (≥768px) gets a sidebar layout. |

## 4. Feature Tour

### 4.1 Style Quiz & Discovery Feed
Pick seasons and categories, then swipe like/skip through clothing items. Each item carries `styleWeights` mapping it to aesthetics; every swipe updates the running `styleScores`. The finite 40-item quiz ends in a Results screen (top-3 aesthetics, persisted to quiz history); free discovery mode runs the same feed infinitely. The recommendation queue (`useDiscoveryQueue`) scores the catalog against the profile (brand ×10, type ×15, color ×5, style ×0.5, companion bonuses) with diversity enforcement and a 30-item buffer. The Discover tab can be hidden entirely from Settings for users who are done swiping.

### 4.2 Aesthetics Library
51 editorial aesthetic profiles (ExploreScreen → AestheticScreen) with Story / Items / Looks / Guide sub-tabs: cultural origin, key pieces, outfit galleries, colour palettes, brand lists, styling guides. Users pin aesthetics (free: 3) to personalise Home and filtering.

### 4.3 Brand Discovery
A Brands tab with **190 brand profiles** (`src/data/brands.js`): founding story, positioning, product lines/diffusion tiers, current and iconic past collections, key pieces, related brands — plus a Shop sub-tab filtered to that brand's catalog products. Brand visits feed the interest graph.

### 4.4 Search
Full-text client-side search over the ~7,500-product catalog with gender filtering, like/wishlist actions, and a photo↔gradient image toggle.

### 4.5 Digital Closet
Add items by **photo upload** (Claude Vision detects every garment with category, colour, and bounding box; user confirms) or **catalog search** (Google CSE → Pexels fallback). Optional **Prettify** removes the background client-side (WASM) and stores a PNG in Firebase Storage. Items carry seasons, occasions, tags, care symbols, favourites, and denormalised **wear data** (`timesWorn`, `lastWorn`). Free tier: 15 items, 3 AI scans/month.

### 4.6 Outfits Hub (8 sub-tabs)
My Closet · Liked · **Shop Scout** (default) · Today's Outfit · My Outfits · Calendar (Pro) · Trip (Pro) · Laundry (Pro).

- **Today's Outfit** — live weather (geolocation → OpenWeatherMap) + occasion + closet/liked source → Claude picks 2–4 items with reasoning. Cached per day+occasion. Logging the outfit records wear counts; sharing renders a 4:5 PNG card for `navigator.share`. If the wardrobe can't complete an outfit, the AI's `missingCategory` becomes a persistent gap signal.
- **My Outfits** — user-curated outfit boards (free: 1) + outfit log.
- **Calendar** — monthly planner assigning outfits to dates.
- **Trip** — destination + nights → AI packing list, day-by-day outfit plan, and gap purchases (Pro: 3/month).
- **Laundry** — care-symbol reference (Pro).

### 4.7 Shop Scout (Wardrobe Builder)
A guided capsule-wardrobe wizard: pick pieces (or accept the starter capsule) → set per-piece budget tiers → choose priorities (comfort, minimal, tailored, durability…) → get scored catalog recommendations, personalised by style scores and the interest graph, with complement suggestions. Saved products live in My List. Reachable from Home, the Outfits hub, and gap-card deep-links that pre-select the missing piece.

### 4.8 Wardrobe Intelligence
- **Gap detection** — instant client-side diff of the closet against a capsule baseline (tops 5, bottoms 3, outerwear 1, footwear 2, accessories 2), boosted by real outfit-generation failures. Surfaced as a dismissable Home card with AI-written personalised copy.
- **Monthly Wardrobe Recap** — Spotify-Wrapped-style card, once per month: outfits logged, most-worn item, "closet ghosts" (items never worn in 30 days), repeat rate.
- **Interest graph** — brand/type/style/colour affinities accumulated from likes and page visits, used to sharpen recommendations.

### 4.9 Virtual Try-On (Pro)
Upload an avatar photo, select up to 3 garments; the server chains Replicate IDM-VTON predictions in layer order (bottoms → dresses → tops → outerwear) and returns a composite. Cached per item-set + avatar; 30/month on Pro plus purchasable 30-piece credit packs.

### 4.10 Home Feed
Monthly recap card → hero aesthetic carousel → today's outfit preview → wardrobe gap card → fresh looks → brands-for-you → seasonal picks → trending aesthetics → wardrobe-builder CTA. A context-aware **guide tour** (per-tab chapters or full app walkthrough) is launchable from a floating button on every tab.

### 4.11 Onboarding & Auth
Email/password (with verification + MX-record email validation) or Google OAuth. Signup captures ToS/Privacy consent and a 16+ age affirmation. A 4-step post-signup wizard collects occupation, preferred brands, referral source, and an optional shopping email.

### 4.12 Profile & Settings
Top aesthetics, style evolution chart across quiz retakes, quiz history, subscription management (upgrade / billing portal). Settings sheet: gender, theme (light default / dark), temperature unit, default occasion, preferred seasons, closet sort, quiz-tab visibility, notification reminders, analytics consent, legal docs, **full data export (JSON)**, and **account deletion**.

## 5. Monetization — Free vs. Pro

Tiers: `free`, `pro`, `admin` — held as Firebase custom claims (`sartima_tier`, `sartima_role`), the single source of truth, enforced **both** client-side (`SubscriptionContext.isAtLimit` → `PaywallModal`) and server-side (usage transactions in Functions).

| Feature | Free | Pro |
|---|---|---|
| AI outfit generation | 1 / day | Unlimited |
| Closet items | 15 | Unlimited |
| AI vision scans | 3 / month | 30 / month |
| Liked items | 50 | Unlimited |
| Aesthetic pins | 3 | Unlimited |
| Outfit boards | 1 | Unlimited |
| Outfit calendar | — | ✅ |
| Trip planner | — | 3 / month |
| Virtual Try-On | — | 30 / month + $2.99 per 30-piece pack |
| Laundry tracking | — | ✅ |
| Gap-reasoning copy | 20 / month | 200 / month |

Monthly counters live in `users/{uid}/prefs/usage` (Functions-only writes) keyed by `periodKey` (YYYY-MM); outfit generation is a per-day gate on `lastOutfitDate`; try-on credit packs (`tryOnCredits`) never expire. Checkout, billing portal, and webhooks run through Stripe (see §13).

## 6. Legal & Privacy

Shipped July 2026 (drafts pending attorney review — see the draft notice in `src/data/legalContent.js`):

- **Privacy Policy & Terms of Service** rendered in-app (`LegalModal`), versioned by `LEGAL_VERSION`. Material changes bump the version → signed-in users see a re-consent banner until they acknowledge.
- **Consent capture at signup** — ToS/Privacy acceptance + 16+ age affirmation stored on the user doc (email and Google flows both).
- **Analytics consent** — Firebase Analytics initialises only after opt-in (cookie banner); `trackEvent` is a no-op otherwise.
- **Data export** — one-tap JSON download of profile, prefs, quiz history, plans, and uploads (excludes internal usage counters and Stripe IDs).
- **Account deletion** — server-side, retry-safe order: cancel Stripe subscription → delete Storage photos → recursively delete the Firestore tree → delete the Auth user.

---

## 7. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 (hooks only) + Vite, CSS Modules, PWA via `vite-plugin-pwa`/Workbox |
| Layout | Mobile bottom TabBar / desktop (≥768px) Sidebar |
| Auth & data | Firebase Auth (email/password + Google), Firestore, Storage, Analytics (consent-gated), Cloud Messaging |
| Backend | Firebase Cloud Functions Gen 2 (Node, `us-central1`) |
| AI | Claude Haiku (`claude-haiku-4-5-20251001`) — vision, outfits, trips, gap copy — via Functions proxy |
| Try-on | Replicate IDM-VTON via `generateTryOn` Function |
| Billing | Stripe Checkout + Billing Portal + webhooks |
| Weather | OpenWeatherMap via `getWeather` Function |
| Images | Pexels / Google CSE / Unsplash via `searchImages` Function |
| Background removal | `@imgly/background-removal` WASM (client-side, lazy) |
| Error tracking | Sentry (`@sentry/react`), production only |

**No Anthropic or Stripe SDK on the client.** All secret-bearing calls go through Firebase Functions.

## 8. Navigation & Screen Architecture

No React Router — navigation is state-driven (no URLs or browser history).

**Quiz flow** (`state.screen` in `AppContext`, linear): `AUTH → WELCOME → ONBOARDING → SEASONS → CATEGORIES → DISCOVERY → RESULTS`. Once complete, `activeTab` in `AppShell` drives the main app.

**7 tab destinations:** `home`, `explore` (Aesthetics), `brands`, `quiz` (Discover — hideable), `search`, `daily` (Outfits, closet-count badge), `profile`. Dynamic tab IDs: `aesthetic:{id}`, `brand:{id}` (remembers return tab), `wardrobe-builder[:{pieceId}|{name}]`, `mystyle[:{subTab}]`, `profile:quiz-history`. `handleTabChange(tabId)` is the single navigation function, exposed app-wide via `NavigationContext`.

The Outfits tab hosts 8 sub-tabs (default **Shop Scout**); Calendar/Trip/Laundry taps open the paywall for free users. Full details: [docs/claude/architecture.md](docs/claude/architecture.md).

## 9. State Management

React Context + hooks — no external store. Nesting (outermost first):

```
AuthProvider → SubscriptionProvider → InterestProvider → AppProvider
  → ShopProvider → WishlistProvider → ClosetProvider → ExploreProvider
    → (in AppShell) NavigationProvider → GuideProvider
```

| Context | Owns |
|---|---|
| `AppContext` | Quiz state machine, `styleScores`, gender; settings hooks (theme, temp unit, occasion, seasons, quiz-tab visibility, closet sort — all localStorage `sartima_*`) |
| `AuthContext` | Firebase session, signup/login/Google OAuth, consent capture |
| `SubscriptionContext` | Tier from custom claims, live usage via `onSnapshot`, `isAtLimit` / `openPaywall` |
| `InterestContext` | Read-side of the interest graph |
| `ClosetContext` | Closet items + Firestore sync + error/retry |
| `WishlistContext` | Liked, wishlist, outfit boards |
| `ExploreContext` | Pinned aesthetics; open aesthetic/brand page state |
| `ShopContext` | Shop Scout list |
| `GuideContext` / `NavigationContext` | Tour state / `navigate()` |

**Sync pattern:** every persisted context loads with `getDoc` and merges via the functional `setState` form so in-flight writes aren't clobbered; writes replace the whole prefs document. Guests get in-memory state with `LockedOverlay` gates on persistence features.

## 10. Data Architecture (Firestore & Storage)

```
users/{uid}                     profile + consent fields (legalVersion, ageAffirmed16Plus, …)
  ├── prefs/closet|wishlist|liked|outfitBoards|savedAesthetics|shopList|outfitLog
  ├── prefs/interests           brand/type/style/color affinities, visits, recent likes
  ├── prefs/notifications       fcmTokens[], reminderTime, timezone, enabled
  ├── prefs/gapSignals          missing-category hit counts
  ├── prefs/gapDismissals       per-category snooze timestamps
  ├── prefs/recapSeen           lastShownMonth
  ├── prefs/tryOnCache          try-on results
  ├── prefs/usage               usage counters (Functions-only writes; client reads live)
  ├── prefs/subscription        Stripe customer/subscription state (Functions-only writes)
  ├── outfitPlans/{planId}      calendar plans (subcollection)
  ├── quizzes/{quizId}          quiz history
  └── uploadedItems/{itemId}    user-contributed items
feedback/{docId}                Function-only writes
crashReports/{docId}            Function-only writes
```

Rules: owner-only on all user paths; `usage`/`subscription` are client-read-only; catch-all deny. Storage: `users/{uid}/wardrobe/**` and `users/{uid}/avatar/*`, owner-only, images < 10 MB. New persistence should go in a `prefs/{key}` doc (already covered by rules); new subcollections need a rules `match` + deploy first. Full map: [docs/claude/data-models.md](docs/claude/data-models.md).

## 11. AI Integration

All Claude calls run server-side through Functions; the model is the `CLAUDE_HAIKU` constant in `functions/index.js`. Four capabilities:

| Capability | Function | In → Out |
|---|---|---|
| Vision closet scan | `anthropicVision` | photo (base64) → up to 10 items with name/category/colour/description/bbox |
| Daily outfit | `anthropicOutfit` | wardrobe JSON + weather + occasion + occupation → `selectedIds`, `reasoning`, `weatherNote`, `missingCategory` |
| Trip planning | `anthropicTrip` | wardrobe metadata + destination + nights → `packingList`, `dailyOutfits`, `gapItems` |
| Gap copy | `anthropicGapReasoning` | category deficit + closet summary + top styles → 1–2 sentence stylist nudge |

Outfit rules enforced by prompt: ≥1 top + ≥1 bottom (or dress); outerwear only if <16°C or rain/snow; date used as a variety seed; `missingCategory` set when the wardrobe can't satisfy the rule. Clients cache generations in sessionStorage and must handle `null` (failure) returns.

## 12. Backend — Firebase Cloud Functions

17 functions: 4 Anthropic proxies, `getWeather`, `searchImages` (+ per-user rate limit), `proxyImage` (allow-listed hosts), `generateTryOn` (Replicate chaining + cooldown), `validateEmail` (public), `submitFeedback` / `submitCrashReport` (Firestore + Gmail email), `sendDailyOutfitReminders` (15-minute scheduler → FCM, timezone-aware, prunes dead tokens), 4 Stripe functions, and `deleteAccount`. Full table with timeouts: [docs/claude/services-functions.md](docs/claude/services-functions.md).

## 13. Billing — Stripe

- `createStripeCheckout` — monthly or annual subscription Checkout session (price IDs from function secrets); success redirects to `{APP_URL}?upgrade=success`, which triggers a client token refresh to pick up the new claim.
- `createStripeBillingPortal` — self-serve management for existing subscribers.
- `purchaseTryOnPack` — one-time payment adding 30 `tryOnCredits`.
- `stripeWebhook` (`onRequest`, signature-verified) — `checkout.session.completed` sets the `sartima_tier: 'pro'` claim and writes `prefs/subscription`; `customer.subscription.updated/deleted` sync status and downgrade the claim.

Secrets are declared per-function (`secrets: [...]`): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_MONTHLY|ANNUAL|TRYON_PACK`.

## 14. Notifications

Daily outfit push reminders via Firebase Cloud Messaging:
- Client acquires an FCM token (`VITE_FIREBASE_VAPID_KEY`) against a **dedicated-scope service worker** (`public/firebase-messaging-sw.js`) so it coexists with the Workbox SW; iOS Safari requires the PWA to be installed first (`isIOSStandaloneRequired` gates the UI).
- Prefs (`fcmTokens`, `reminderTime`, `timezone`, `enabled`) live in `prefs/notifications`.
- `sendDailyOutfitReminders` runs every 15 minutes, collection-group queries enabled prefs, converts each user's local time, and pushes "Your outfit's ready" with a `/?tab=daily` link.

## 15. The Catalog & Static Data

- **~7,500 products** in `src/data/products/` (9 files by parent type), merged by `products.js` into `PRODUCTS` + lookup maps. Every product carries brand, type/parentType, colour + hex, price range, seasons, gender, `styleWeights`, `outfitCompanions`, retailer `shopUrl` (+ fallback), a Google image query, and a gradient placeholder.
- **190 brand profiles** in `brands.js` (stories, lines, collections, key pieces) — brand names must match across `products.js` and `styles.js`.
- **51 aesthetics** in `styles.js` + deep content in `aestheticDepth.js`; 500+ quiz items in `aestheticItems.js`; curated looks, category trees, care symbols, legal copy, guide steps, capsule baseline.
- Catalog expansion process: [docs/claude/catalog-brand-expansion.md](docs/claude/catalog-brand-expansion.md) (target: a floor of 40 products per brand).

## 16. Image & Media Pipeline

- **Closet upload:** photo → Storage (`users/{uid}/wardrobe/{itemId}`) → optional Prettify (WASM background removal, lazy-loaded; CORS-blocked URLs fetched via `proxyImage`) → prettified PNG stored alongside.
- **Catalog search:** Google CSE first; on quota exhaustion a module flag silently falls back to Pexels for the session.
- **Product cards:** `resolveProductImage` picks inline image / Google query / gradient placeholder, with a user-facing toggle.
- **Share cards:** canvas-composed 1080×1350 PNG; every photo draw is isolated so a tainted image degrades to a colour swatch instead of failing the card.
- All image-service modules use `createBoundedCache(150)` — never a bare `Map`.

## 17. Security Model

- Firebase client keys are public by design; enforcement is Firestore/Storage rules + Auth.
- All third-party secrets (Anthropic, Stripe, Replicate, OpenWeatherMap, Pexels, Google, Unsplash, Gmail) exist only in Functions env/secrets.
- Every sensitive Function calls `requireAuth`; tier limits are re-checked server-side in Firestore transactions (client gating is UX, not security).
- `proxyImage` only fetches from an allow-list of image hosts; `searchImages` and `generateTryOn` have per-user rate limits/cooldowns.
- Passwords never touch Sartima (Firebase Auth); card data never touches Sartima (Stripe).

## 18. Performance & PWA

- Installable PWA, standalone/portrait, auto-updating service worker.
- Precache capped at 8 MB with the heavy data chunks (`data-products`, `data-catalog`, `data-content`) **excluded** from precache — they load over the network and rely on HTTP caching.
- Runtime caching: Pexels CacheFirst 7d, Firestore NetworkFirst 5min, Google Fonts CacheFirst 1y.
- Manual Vite chunks: `react-core`, `firebase`, `data-styles`, `data-content`, `data-products`, `data-catalog`.
- Lazy loading: FCM SDK, background-removal WASM, share-card module — all dynamic imports; gallery images gated by IntersectionObserver.
- Session caching: outfit generations, weather (30 min), gap-reasoning copy (per day).

## 19. Observability & Error Handling

- **Sentry** initialised in `main.jsx`, production only, DSN via `VITE_SENTRY_DSN` (empty = disabled). A Sentry `ErrorBoundary` wraps the app with a branded reload fallback.
- **Logger pattern:** services call `logError`/`logWarn` from `src/services/logger.js` (console + Sentry), never `console.error` directly.
- **Crash reporter** captures console/network diagnostics; users submit them via the Problem Report sheet → `crashReports/` + email.
- **Feedback sheet** → `feedback/` + email. Both collections are client-inaccessible.
- **Analytics** (Firebase) is consent-gated; `trackEvent` is a safe no-op pre-consent.

## 20. Development Workflow

```bash
npm run dev        # Vite dev server (HMR)
npm run build      # production build → dist/
npm run preview    # preview the build

firebase deploy --only functions          # deploy Cloud Functions
firebase deploy --only firestore:rules    # deploy Firestore rules
firebase deploy --only storage            # deploy Storage rules
firebase emulators:start --only functions # local Functions emulator (client: VITE_USE_EMULATOR=true)
```

No test suite or linting configured. Playwright is available as a dev dependency for manual screenshot-driven verification.

## 21. Environment Variables

**Client (`.env`, `VITE_` prefix — bundled into the browser):**

| Variable | Purpose |
|---|---|
| `VITE_FIREBASE_API_KEY` / `AUTH_DOMAIN` / `PROJECT_ID` / `STORAGE_BUCKET` / `MESSAGING_SENDER_ID` / `APP_ID` / `MEASUREMENT_ID` | Firebase config (intentionally public) |
| `VITE_FIREBASE_VAPID_KEY` | Web-push VAPID key for FCM (Console → Cloud Messaging) |
| `VITE_SENTRY_DSN` | Sentry DSN (empty = Sentry disabled) |
| `VITE_USE_EMULATOR` | `true` → Functions SDK targets `localhost:5001` |

**Server (`functions/.env` for the emulator; Firebase console env vars / secrets for deployed functions):**

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Claude |
| `OPENWEATHER_KEY` | Weather |
| `PEXELS_KEY`, `GOOGLE_API_KEY` + `GOOGLE_CX`, `UNSPLASH_KEY` | Image search |
| `REPLICATE_API_KEY` | Virtual try-on |
| `GMAIL_APP_PASSWORD` | Feedback/crash emails (absent = silently skipped) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_MONTHLY`, `STRIPE_PRICE_ID_ANNUAL`, `STRIPE_PRICE_ID_TRYON_PACK` | Billing (declared as function secrets) |
| `APP_URL` | Checkout redirect base (default `https://sartima.ca`) |

## 22. Known Constraints & Technical Debt

| Area | Issue | Impact |
|---|---|---|
| No test suite / linting | Regressions caught manually | High |
| No URL routing | No deep links, shareable URLs, or browser back | Medium — acceptable for a PWA, limits shareability |
| Prefs stored as single-doc arrays | Very large closets could approach Firestore's 1 MB doc limit | Future risk |
| Legal docs are drafts | Privacy/ToS not yet attorney-reviewed (in-app draft notice) | Must resolve before scale |
| In-process rate limits | try-on cooldown + search throttle reset on cold start | Low — good enough vs. accidental hammering |
| Interest-graph writes | read-modify-write (not transactional); rapid multi-tab use could drop increments | Low |
| Google CSE quota | Daily quota; per-session Pexels fallback handles exhaustion | Low-medium |
| Catalog size | ~6 MB static data; mitigated by chunk splitting + precache exclusion, still a network cost on first load | Medium |

## 23. Glossary

| Term | Meaning |
|---|---|
| **Aesthetic** | A named fashion style identity (51 defined, e.g. "old money", "gorpcore") |
| **styleScores** | Aesthetic-ID → affinity score map updated by every swipe (`AppContext`) |
| **ClosetItem** | Data model for a digital-closet item, incl. wear data |
| **Gap / gap signal** | A category deficit vs. the capsule baseline / an AI outfit failure recorded against a category |
| **Capsule baseline** | Per-category minimum counts a healthy wardrobe should have (`capsuleBaseline.js`) |
| **Closet ghost** | An item not worn in the trailing 30 days (recap feature) |
| **Interest graph** | Accumulated brand/type/style/colour affinities in `prefs/interests` |
| **Shop Scout** | The guided capsule-wardrobe shopping wizard (`WardrobeBuildScreen`) |
| **Prettify** | Client-side background removal on a clothing photo |
| **Try-on credits** | Purchased Try-On uses (`tryOnCredits`) consumed after the monthly allowance |
| **Tier / claims** | `free`/`pro`/`admin` from `sartima_tier`/`sartima_role` Firebase custom claims |
| **periodKey** | `YYYY-MM` key that resets monthly usage counters |
| **LEGAL_VERSION** | Version stamp on the legal docs; mismatch with the user doc triggers re-consent |
| **Guide tour** | Per-tab or full-app interactive walkthrough (`guideSteps.js` + `GuideTour`) |
| **CLAUDE_HAIKU** | The single model constant in `functions/index.js` for all Claude calls |
| **Bounded cache** | `createBoundedCache()` — FIFO-evicting Map for API response caches |
