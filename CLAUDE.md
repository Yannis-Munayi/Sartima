# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project Overview

**Sartima** is a fashion discovery and personal styling PWA (mobile-first, `sartima.ca`; formerly StyleLab). It gives users a vocabulary for their own style through an aesthetic quiz (swipe-based, 51 aesthetics), then delivers a personalised discovery feed, AI outfit generation, a digital closet with wardrobe intelligence, brand discovery, and trip packing — powered by Claude Haiku, a ~7,500-product catalog, and a Stripe-billed Pro tier.

**Target audience:** Gen Z / younger Millennials (16–30) engaged with aesthetics culture on TikTok/Pinterest. Gender filter throughout. Age floor 16+ (affirmed at signup).

**Core features:**
1. **Style Quiz** — Swipe like/skip on clothing items; computes affinity scores across 51 aesthetics. Finite 40-item quiz or infinite free discovery mode. The Discover tab is hideable from Settings.
2. **Onboarding** — 4-step post-signup wizard (occupation → brands → referral → email). `onboardingComplete: true` saved to Firestore. Signup captures ToS/Privacy consent + 16+ age affirmation.
3. **Discovery Feed** — Infinite product feed scored by style affinity (`brand × 10`, `type × 15`, `color × 5`, `style × 0.5`). Diversity-enforced, 30-item buffer.
4. **Aesthetics** — 51 aesthetic profiles (minimalist, preppy, Y2K, gorpcore, dark academia…), each with Story/Items/Looks/Guide sub-tabs. Pinnable (free: 3).
5. **Brands** — Brands tab with 190 brand profiles (`src/data/brands.js`): story, lines, collections, shoppable catalog products. Visits feed the interest graph.
6. **Search** — Client-side text search over the full catalog with gender filter and photo↔gradient toggle.
7. **Digital Closet** — Upload photos or search catalog; Claude Vision extracts items. Optional WASM background removal ("prettify"). Wear tracking (`timesWorn`/`lastWorn`) on logged outfits. Free: 15 items.
8. **Outfits Tab** — 8 sub-tabs: closet, liked, Shop Scout (**default**), AI outfit generation, outfit boards + log, calendar (Pro), trip packer (Pro), laundry (Pro).
9. **Shop Scout** — Guided capsule wardrobe wizard: select pieces + budget + priorities → curated catalog recommendations personalised by the interest graph. Deep-linkable with a pre-selected piece (`wardrobe-builder:{pieceId}`).
10. **Wardrobe Intelligence** — Home notification-bell gap item (closet diffed against `capsuleBaseline.js` + AI outfit `missingCategory` signals, AI-written copy, 14-day dismissal), monthly Wardrobe Recap card (most-worn, closet ghosts, repeat rate), interest graph (`prefs/interests`).
11. **Virtual Try-On** — Replicate IDM-VTON; multi-piece chaining (bottoms → dresses → tops → outerwear), Pro-only with monthly allowance + purchasable credit packs.
12. **Home Feed** — Recap card, hero carousel + notification bell (closet prompt, wardrobe gap), daily outfit preview, fresh looks, brands-for-you, seasonal picks, trending aesthetics.
13. **Profile & Settings** — Top aesthetics, style evolution, quiz history, subscription management. SettingsSheet: gender, theme, units, occasion, seasons, notifications (FCM daily reminder), analytics consent, legal docs, data export (JSON), account deletion.
14. **Monetization** — Free/Pro/admin tiers via Firebase custom claims; Stripe Checkout (monthly/annual), billing portal, try-on packs, webhook-driven claim updates.
15. **Notifications** — Daily outfit push reminders: FCM + dedicated-scope service worker + 15-minute Cloud Scheduler function (timezone-aware).

---

## Commands

```bash
npm run dev        # Vite dev server with HMR
npm run build      # Production build (Vite + chunk splitting)
npm run preview    # Preview production build locally
npm run lint       # ESLint (eslint.config.js) — src/, functions/, scripts/, e2e/
npm run test:e2e   # Playwright e2e smoke tests (e2e/) — auto-starts the dev server
```

```bash
firebase deploy --only functions          # Deploy Cloud Functions
firebase deploy --only firestore:rules    # Deploy Firestore security rules
firebase emulators:start --only functions # Local function emulator
```

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + Vite 8, CSS Modules, PWA (`vite-plugin-pwa` 1 / Workbox); responsive (mobile bottom TabBar / desktop Sidebar) |
| Auth & DB | Firebase Auth (email/password + Google), Firestore, Storage, Analytics (consent-gated), Cloud Messaging |
| Billing | Stripe — Checkout, Billing Portal, webhook → custom claims (via Firebase Functions) |
| AI | Claude Haiku — vision, outfit gen, trip planning, gap reasoning (via Firebase Functions proxy) |
| Try-On | Replicate IDM-VTON (via `generateTryOn` Firebase Function) |
| Weather | OpenWeatherMap (via `getWeather` Firebase Function) |
| Images | Unsplash → Pexels fallback (via `searchImages` Firebase Function, `source: 'stock'`) |
| Background removal | `@imgly/background-removal` WASM (client-side, lazy) |
| Error tracking | Sentry (`@sentry/react`) — production only, DSN from `VITE_SENTRY_DSN` |

**No Anthropic or Stripe SDK on the client.** All Claude calls go through Firebase Functions. The model is controlled by the `CLAUDE_HAIKU` constant in `functions/index.js` — change it there to upgrade all four Claude functions at once.

---

## Environment Variables

**Client (`.env`) — `VITE_` prefix, bundled into the browser:**
- `VITE_FIREBASE_*` (7 keys incl. `MEASUREMENT_ID`) — intentionally public; security is enforced by Firestore rules + Auth
- `VITE_FIREBASE_VAPID_KEY` — web-push key for FCM; if unset, notification enable silently no-ops with a logged warning
- `VITE_SENTRY_DSN` — if empty, Sentry is skipped entirely (safe for local dev)
- `VITE_USE_EMULATOR=true` — connects Functions SDK to `localhost:5001`
- `VITE_HUB_ORIGINS` — optional, comma-separated: extra addresses of the owner's Jarvis hub (e.g. its Tailscale phone address) allowed to call the hub bridge. Localhost is always allowed.

**Server (`functions/.env`) — never sent to the browser:**
- `ANTHROPIC_API_KEY`
- `OPENWEATHER_KEY`
- `PEXELS_KEY`
- `GOOGLE_API_KEY` + `GOOGLE_CX` — only used by `scripts/backfill-images.js` (offline catalog tooling); not used at runtime
- `UNSPLASH_KEY`
- `REPLICATE_API_KEY`
- `GMAIL_APP_PASSWORD` — nodemailer app password; if absent, email notifications are silently skipped
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_MONTHLY`, `STRIPE_PRICE_ID_ANNUAL`, `STRIPE_PRICE_ID_TRYON_PACK` — declared per-function via the `secrets: [...]` option
- `APP_URL` — Stripe redirect base (default `https://sartima.ca`)

Server keys must also be set in the Firebase console (Functions → Edit → Environment variables) for deployed functions to read them. `functions/.env` is for the local emulator only.

---

## Detailed Reference

| Topic | File |
|-------|------|
| Routing, tab bar, sub-tabs, contexts, styling system | [docs/claude/architecture.md](docs/claude/architecture.md) |
| All screens, components, onboarding flow | [docs/claude/screens.md](docs/claude/screens.md) |
| All services, AI integrations, Firebase Functions table | [docs/claude/services-functions.md](docs/claude/services-functions.md) |
| Closet data model, Firestore paths, CSS variables, Vite chunks | [docs/claude/data-models.md](docs/claude/data-models.md) |

---

## Key Patterns to Know

**Navigation** — No React Router. `state.screen` (AppContext) drives the quiz flow; `activeTab` (AppShell local state) drives the main app. `handleTabChange(tabId)` is the single navigation function, exposed everywhere via `NavigationContext`'s `navigate()`. Special tab IDs: `aesthetic:{id}`, `brand:{id}` (remembers the tab to return to), `wardrobe-builder` / `wardrobe-builder:{pieceId}|{specificName}` (deep-link with pre-selected piece), `profile:quiz-history`, `closet:{subTab}` (redirects to `daily`), `mystyle:{subTab}`. Desktop (≥768px) shows a `Sidebar` instead of the bottom `TabBar`; both call the same `handleTabChange`. `useHashRouting` (`src/hooks/useHashRouting.js`) mirrors `activeTab` into `location.hash` (`aesthetic:y2k` ↔ `#/aesthetic/y2k`), so every tab has a shareable deep-link URL and browser back/forward walk the tab history.

**Jarvis hub bridge** — `components/HubBridge.jsx` (mounted in `App`) lets the owner's Jarvis assistant use Sartima when it frames the app: `services/hubBridge.js` is the postMessage protocol, `services/hubActions.js` the actions (profile, closet, outfit log, wishlist, catalog search). Actions go through the context functions, so persistence and plan limits match the UI. It does nothing when Sartima isn't in a frame.

**Context sync** — All persisted contexts use the functional `setState` form in Firestore `.then` callbacks so in-flight additions are never overwritten on load.

**Firebase Function calls** — Always use `httpsCallable(functions, 'functionName')`. Every function requires auth except `validateEmail` / `submitFeedback` / `submitCrashReport` / `searchImages` (guest browsing needs photos); the SDK passes the ID token automatically. Tier limits are re-enforced server-side — client `isAtLimit` checks are UX, not security.

**New persistence** — Prefer a `prefs/{key}` document (already covered by Firestore rules). New subcollections require a new `match` block in `firestore.rules` and a redeploy before any writes.

**Error logging** — Import `logError` / `logWarn` from `src/services/logger.js` in every service file. Never call `console.error` directly in services.

**Image cache** — Use `createBoundedCache()` from `src/services/cache.js` (not `new Map()`) in any service that caches API responses.

**CSS variables** — Never use hardcoded hex fallbacks in `var()`. Use `var(--bg-elevated)` for solid sheet/modal backgrounds. Theme is set via `data-theme` on `:root`; **light is the default** (`localStorage sartima_theme`). Accent is champagne gold `#B8956A` (dark) / `#8B6840` (light) — always via `var(--accent)`.

**Analytics** — Only via `trackEvent(name, params)` from `src/services/firebase.js` — it's a consent-gated no-op until the user accepts the analytics banner. Never call `logEvent` directly.

**Subscription / paywall** — Tiers are `free`, `pro`, `admin`. Firebase custom claims (`sartima_tier`, `sartima_role`) are the source of truth; `SubscriptionContext` reads them on mount and syncs usage counters live from `users/{uid}/prefs/usage`. To gate a feature: call `isAtLimit('featureName')` before the action; if true, call `openPaywall('featureName')` — both come from `useSubscription()`. Never gate features with raw hardcoded limits; always go through `SubscriptionContext` so free/pro/admin behave correctly. Monthly counters reset when `periodKey` (YYYY-MM) changes; `outfitGenerations` is a per-day gate checked against `lastOutfitDate`.
