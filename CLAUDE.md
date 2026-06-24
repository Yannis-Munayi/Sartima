# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project Overview

**Sartima** is a fashion discovery and personal styling PWA (mobile-first). It gives users a vocabulary for their own style through an aesthetic quiz (swipe-based, 40+ aesthetics), then delivers a personalised discovery feed, AI outfit generation, a digital closet, and trip packing — all powered by Claude Haiku and a hand-curated catalog.

**Target audience:** Gen Z / younger Millennials (16–30) engaged with aesthetics culture on TikTok/Pinterest. Gender filter throughout.

**Core features:**
1. **Style Quiz** — Swipe like/skip on clothing items; computes affinity scores across 40+ aesthetics. Finite 40-item quiz or infinite free discovery mode.
2. **Onboarding** — 4-step post-signup wizard (occupation → brands → referral → email). `onboardingComplete: true` saved to Firestore.
3. **Discovery Feed** — Infinite product feed scored by style affinity (`brand × 10`, `type × 15`, `color × 5`, `style × 0.5`). Diversity-enforced, 30-item buffer.
4. **Aesthetics** — 40+ aesthetic profiles (minimalist, preppy, Y2K, gorpcore, dark academia…), each with brands, colour palette, archetype, styling guide, gallery. Pinnable.
5. **Digital Closet** — Upload photos or search catalog; Claude Vision extracts items. Optional WASM background removal ("prettify"). Persisted to Firestore.
6. **Outfits Tab** — 8 sub-tabs combining closet, liked items, AI outfit generation, outfit boards, calendar planner, trip packer, and laundry reference. Default sub-tab: **Shop Scout**.
7. **Shop Scout** — Guided capsule wardrobe wizard: select pieces + budget + priorities → curated catalog recommendations.
8. **Virtual Try-On** — Replicate IDM-VTON model; multi-piece chaining (bottoms → tops → outerwear).
9. **Home Feed** — Hero carousel, fresh looks, seasonal picks, trending aesthetics grid.
10. **Profile** — Identity: top aesthetics, style evolution, quiz history. Settings (gear icon ⚙) in a slide-up sheet: gender, theme, sign out.

---

## Commands

```bash
npm run dev        # Vite dev server with HMR
npm run build      # Production build (Vite + chunk splitting)
npm run preview    # Preview production build locally
```

```bash
firebase deploy --only functions          # Deploy Cloud Functions
firebase deploy --only firestore:rules    # Deploy Firestore security rules
firebase emulators:start --only functions # Local function emulator
```

No test or lint scripts configured.

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + Vite 5, CSS Modules, PWA (Workbox); responsive (mobile bottom TabBar / desktop Sidebar) |
| Auth & DB | Firebase Auth (email/password + Google), Firestore, Storage |
| AI | Claude Haiku — vision, outfit gen, trip planning (via Firebase Functions proxy) |
| Try-On | Replicate IDM-VTON (via `generateTryOn` Firebase Function) |
| Weather | OpenWeatherMap (via `getWeather` Firebase Function) |
| Images | Pexels / Google CSE / Unsplash (via `searchImages` Firebase Function) |
| Background removal | `@imgly/background-removal` WASM (client-side, lazy) |
| Error tracking | Sentry (`@sentry/react`) — production only, DSN from `VITE_SENTRY_DSN` |

**No Anthropic SDK on the client.** All Claude calls go through Firebase Functions. The model is controlled by the `CLAUDE_HAIKU` constant in `functions/index.js` — change it there to upgrade all three Claude functions at once.

---

## Environment Variables

**Client (`.env`) — `VITE_` prefix, bundled into the browser:**
- `VITE_FIREBASE_*` (6 keys) — intentionally public; security is enforced by Firestore rules + Auth
- `VITE_SENTRY_DSN` — if empty, Sentry is skipped entirely (safe for local dev)
- `VITE_USE_EMULATOR=true` — connects Functions SDK to `localhost:5001`

**Server (`functions/.env`) — never sent to the browser:**
- `ANTHROPIC_API_KEY`
- `OPENWEATHER_KEY`
- `PEXELS_KEY`
- `GOOGLE_API_KEY` + `GOOGLE_CX`
- `UNSPLASH_KEY`
- `REPLICATE_API_KEY`
- `GMAIL_APP_PASSWORD` — nodemailer app password; if absent, email notifications are silently skipped

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

**Navigation** — No React Router. `state.screen` (AppContext) drives the quiz flow; `activeTab` (AppShell local state) drives the main app. `handleTabChange(tabId)` is the single navigation function. Special tab IDs: `aesthetic:{id}`, `profile:quiz-history`, `closet:{subTab}` (redirects to `daily`), `mystyle:{subTab}` (sets sub-tab then activates `mystyle`). Desktop (≥768px) shows a `Sidebar` instead of the bottom `TabBar`; both call the same `handleTabChange`.

**Context sync** — All persisted contexts use the functional `setState` form in Firestore `.then` callbacks so in-flight additions are never overwritten on load.

**Firebase Function calls** — Always use `httpsCallable(functions, 'functionName')`. Every function requires auth; the SDK passes the ID token automatically.

**New persistence** — Prefer a `prefs/{key}` document (already covered by Firestore rules). New subcollections require a new `match` block in `firestore.rules` and a redeploy before any writes.

**Error logging** — Import `logError` / `logWarn` from `src/services/logger.js` in every service file. Never call `console.error` directly in services.

**Image cache** — Use `createBoundedCache()` from `src/services/cache.js` (not `new Map()`) in any service that caches API responses.

**CSS variables** — Never use hardcoded hex fallbacks in `var()`. Use `var(--bg-elevated)` for solid sheet/modal backgrounds. Light mode is `data-theme="light"` on `:root`.

**Subscription / paywall** — Tiers are `free`, `pro`, `admin`. Firebase custom claims (`sartima_tier`, `sartima_role`) are the source of truth; `SubscriptionContext` reads them on mount and syncs usage counters live from `users/{uid}/prefs/usage`. To gate a feature: call `isAtLimit('featureName')` before the action; if true, call `openPaywall('featureName')` — both come from `useSubscription()`. Never gate features with raw hardcoded limits; always go through `SubscriptionContext` so free/pro/admin behave correctly. Monthly counters reset when `periodKey` (YYYY-MM) changes; `outfitGenerations` is a per-day gate checked against `lastOutfitDate`.
