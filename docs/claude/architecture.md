# Architecture

## Screen Routing

Navigation is **not** React Router. `App.jsx` renders screens conditionally based on two pieces of state:

- `state.screen` from `AppContext` — controls the **quiz flow** (a linear state machine)
- `activeTab` local state in `AppShell` — controls the **main app** once the quiz is complete

**Quiz flow** (linear, one-way):
```
AUTH → WELCOME → ONBOARDING → SEASONS → CATEGORIES → DISCOVERY → RESULTS
```

Once the quiz is complete the tab bar appears and `activeTab` drives rendering.

`AppShell` in `App.jsx` owns: tab state, resume modal, profile scroll targeting, wardrobe-builder deep-link params, and the **legal re-consent check** (compares `users/{uid}.legalVersion` against `LEGAL_VERSION` from `src/data/legalContent.js` on sign-in; mismatch shows `LegalUpdateBanner`, otherwise `AnalyticsConsentBanner` may show). Guide tour logic lives in `src/hooks/useGuideController.js` — `AppShell` calls it and receives `{ guideStep, activeSteps, startGuide, guideNext, guideBack, guideSkip, guideContextValue }`.

**Desktop:** `useIsDesktop()` (media query ≥768px) switches the layout to a fixed `Sidebar` + scrollable main pane. Mobile shows the bottom `TabBar`. Both call the same `handleTabChange`.

---

## Tab Bar (`src/components/TabBar.jsx`) / Sidebar (`src/components/Sidebar.jsx`)

7 destinations, left to right (TabBar scrolls horizontally):

| # | Tab ID | Label | Screen | Notes |
|---|--------|-------|--------|-------|
| 1 | `home` | Home | `HomeScreen` | |
| 2 | `explore` | Aesthetics | `ExploreScreen` | |
| 3 | `brands` | Brands | `BrandsScreen` | Also active for `brand:{id}` tabs |
| 4 | `quiz` | Discover | `DiscoveryScreen` / `ResultsScreen` | Center, elevated. **Hideable** via `useShowQuizTab()` (Settings → App Behavior; `localStorage sartima_show_quiz_tab`, synced across components by a custom event) |
| 5 | `search` | Search | `SearchScreen` | Catalog text search |
| 6 | `daily` | Outfits | `DailyLookScreen` | Badge: closet item count ("9+" when > 9) |
| 7 | `profile` | Profile / first name | `ProfileScreen` | Avatar initial when signed in |

Tab bar is **hidden** on: `AUTH`, `ONBOARDING`, `SEASONS`, `CATEGORIES`.

**Additional tab IDs handled by `handleTabChange` but not shown in the bar:**
- `aesthetic:{id}` → `AestheticScreen` (dynamic, opened via `openAestheticTab`)
- `brand:{id}` → `BrandScreen` (opened via `openBrandTab(id, fromTab)` — remembers the tab to return to on back)
- `wardrobe-builder` → `WardrobeBuildScreen` full-screen (also embedded in Outfits > Shop Scout)
- `wardrobe-builder:{pieceId}` or `wardrobe-builder:{pieceId}|{specificName}` → deep-link that pre-selects a piece (used by the Home gap card)
- `mystyle` / `mystyle:{subTab}` → `MyStyleScreen` (legacy)
- `closet:{subTab}` → redirects to `daily`
- `profile:quiz-history` → navigates to ProfileScreen and scrolls to the quiz history section

First tap of `quiz` from the WELCOME screen auto-starts the infinite feed (`GO_TO_DISCOVERY_DIRECT`) with no season/category gates. If a finite quiz is in progress, tapping `quiz` shows the Resume modal instead.

---

## DailyLookScreen Sub-tabs

`DailyLookScreen` is the Outfits tab and contains 8 scrollable sub-tabs. **Default: `scout`.**

| Order | ID | Label | Renders | Gating |
|---|---|---|---|---|
| 1 | `closet` | My Closet | `<ClosetScreen singleTab="closet" />` | |
| 2 | `liked` | Liked | `<ClosetScreen singleTab="liked" />` | |
| 3 | `scout` | Shop Scout | `<WardrobeBuildScreen onBack={...} />` ← **default** | |
| 4 | `today` | Today's Outfit | `<TodayTab />` (AI outfit generation) | Free: 1 generation/day |
| 5 | `outfits` | My Outfits | `<MyOutfitsTab />` (boards + log + creator) | Free: 1 board |
| 6 | `calendar` | Calendar | `<OutfitCalendarScreen />` | **Pro** (`openPaywall('outfitCalendar')`) |
| 7 | `trip` | Trip | `<TripPlannerScreen />` | **Pro** (`openPaywall('tripPlans')`) |
| 8 | `laundry` | Laundry | `<LaundryTab />` | **Pro** (`openPaywall('laundry')`) |

Pro-gated sub-tabs intercept the tap and open the paywall instead of switching. Guide-driven navigation (`forceSubTab`) bypasses the gate intentionally — it's a feature preview, not an unlock.

**`singleTab` prop on `ClosetScreen`:** When `singleTab="closet"` or `singleTab="liked"` is passed, `ClosetScreen` skips its screen wrapper and sub-tab bar and renders only the named sub-component directly. Components use React context — no prop drilling needed.

---

## Context Providers

All global state lives in `src/context/`.

| Context | Owns |
|---|---|
| `AppContext` | Quiz flow state machine (`screen`, `styleScores`, `quizMode`, `gender`), screen transitions, item queue. Exports `SCREENS` enum plus settings hooks: `useTheme()`, `useTempUnit()`, `useDefaultOccasion()`, `usePreferredSeasons()`, `useShowQuizTab()`, `useClosetSort()` (all localStorage-backed, `sartima_*` keys). |
| `AuthContext` | Firebase Auth session, signup/login/logout, Google OAuth (`signInWithGoogle` returns `{ isNewUser }`), email verification, consent capture (`signup` stores `legalVersion` / `legalAcceptedAt` / `ageAffirmed16Plus`; `recordConsent` does the same for new Google users). Logout clears legacy localStorage keys. |
| `SubscriptionContext` | Tier (`free`/`pro`/`admin`) from Firebase custom claims (`sartima_tier`, `sartima_role`), live usage counters (`onSnapshot` on `prefs/usage`), `isAtLimit(feature)`, `openPaywall(feature)`, `closePaywall`, `isPro`, `refreshSubscription` (force token refresh — triggered by `?upgrade=success` after Stripe checkout). |
| `InterestContext` | Read-side of the interest graph (`prefs/interests`) — loads once per sign-in; consumed by Shop Scout scoring and the Home gap card. Writes go through `src/services/interestTracker.js`. |
| `ClosetContext` | `closetItems`, `closetByCategory`, `totalClosetCount`, Firestore sync, add/update/remove. Exposes `closetError` + `retryLoadCloset`. |
| `ExploreContext` | Pinned aesthetic tabs (`savedAesthetics`, Firestore-synced) **and** open aesthetic/brand page state (`openAesthetic`, `openBrand`, `brandFromTab`, `openAestheticTab`, `openBrandTab`, `closeBrandTab`). |
| `ShopContext` | Shopping list with retailer filters (Shop Scout "My List") |
| `WishlistContext` | `wishlist`, `liked`, `outfitBoards`, `saveOutfitBoard`, `deleteOutfitBoard` — all Firestore-persisted |
| `GuideContext` | Guide tour state (`isActive`, `currentStep`, `activeGuideKey`, `isFullTour`) — provided by `AppShell` from `useGuideController` |
| `NavigationContext` | `navigate()` = `handleTabChange` — cross-screen navigation without prop drilling |

**Provider nesting order** (outermost → innermost):
```
AuthProvider → SubscriptionProvider → InterestProvider → AppProvider
  → ShopProvider → WishlistProvider → ClosetProvider → ExploreProvider
    → (inside AppShell) NavigationProvider → GuideProvider
```

Guest users get session-only storage; Firestore sync only activates on sign-in.

**Context sync pattern (all persisted contexts):** The initial `getDoc` uses the functional form of `setState` in `.then` so items added while the load was in-flight are preserved rather than overwritten.

---

## SCREENS Enum (`src/context/AppContext.jsx`)

```js
AUTH        = 'auth'
WELCOME     = 'welcome'
ONBOARDING  = 'onboarding'
SEASONS     = 'seasons'
CATEGORIES  = 'categories'
DISCOVERY   = 'discovery'
RESULTS     = 'results'
PROFILE     = 'profile'
```

---

## Guide System

- **Content:** `src/data/guideSteps.js` — one step array per main tab (`GUIDE_ORDER = ['home','explore','brands','quiz','search','daily','profile']`). Each step has `tab` (navigation source of truth; supports `aesthetic:{id}` / `brand:{id}`), optional `subTab` (forces AestheticScreen/BrandScreen/DailyLookScreen into a sub-tab), optional `forcedQuery` (pre-fills SearchScreen), optional `note` (disclaimer for pro-gated steps).
- **Controller:** `useGuideController` — `startGuide(key)` runs a single tab's guide, `startGuide('full')` chains all tabs into the full tour (the `quiz` section is skipped when the quiz tab is hidden).
- **UI:** `GuideTour` renders the step overlay; `GuideLauncherButton` is a floating context-aware launcher shown on every tab while the tour is inactive; `GuideLauncher` (in `components/home/`) is the Home-screen entry card.

---

## Styling System

- **CSS Modules** (`Component.module.css`) for component-scoped styles
- **Global theme variables** in `src/index.css` — see [data-models.md](data-models.md#css-variables) for full variable list
- **Light mode is the default** (`localStorage sartima_theme`, default `'light'`); theme applied via `data-theme` attribute on `:root`
- **Primary accent:** `#B8956A` (bronze/gold; `#8B6840` in light mode) — always use `var(--accent)`, not a hex literal
- Serif display font: Cormorant Garamond / Playfair Display for headings

**Rule:** Never use hardcoded hex fallbacks in `var()`. Use `var(--bg-elevated)` for solid sheet/modal backgrounds, `var(--bg-card)` for card surfaces, `var(--surface)` for subtle overlays.
