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

`AppShell` in `App.jsx` owns: tab state, resume modal, profile scroll targeting. Guide tour logic lives in `src/hooks/useGuideController.js` — `AppShell` calls it and receives `{ guideStep, startGuide, guideNext, guideBack, guideSkip, guideContextValue }`.

---

## Tab Bar (`src/components/TabBar.jsx`)

5-tab layout, left to right:

| # | Tab ID | Label | Screen | Notes |
|---|--------|-------|--------|-------|
| 1 | `home` | Home | `HomeScreen` | |
| 2 | `explore` | Aesthetics | `ExploreScreen` | |
| 3 | `quiz` | Swipe | `DiscoveryScreen` / `ResultsScreen` | Center, elevated |
| 4 | `daily` | Outfits | `DailyLookScreen` | Badge: closet item count |
| 5 | `profile` | Profile / first name | `ProfileScreen` | Avatar initials when signed in |

Tab bar is **hidden** on: `AUTH`, `ONBOARDING`, `SEASONS`, `CATEGORIES`.

Active tab icon bounces on change (320ms). Badge shows "9+" when count > 9.

**Additional tab IDs handled by `handleTabChange` but not shown in the bar:**
- `aesthetic:{id}` → `AestheticScreen` (dynamic, opened via `openAestheticTab`)
- `mystyle` → `MyStyleScreen` (legacy, navigated from GuideTour)
- `wardrobe-builder` → `WardrobeBuildScreen` (deep-link; also embedded in Outfits > Shop Scout)
- `profile:quiz-history` → navigates to ProfileScreen and scrolls to quiz history section

---

## DailyLookScreen Sub-tabs

`DailyLookScreen` is the Outfits tab and contains 8 scrollable sub-tabs. **Default: `scout`.**

| Order | ID | Label | Renders |
|---|---|---|---|
| 1 | `closet` | My Closet | `<ClosetScreen singleTab="closet" />` |
| 2 | `liked` | Liked | `<ClosetScreen singleTab="liked" />` |
| 3 | `scout` | Shop Scout | `<WardrobeBuildScreen onBack={...} />` ← **default** |
| 4 | `today` | Today's Outfit | `<TodayTab />` (AI outfit generation) |
| 5 | `outfits` | My Outfits | `<MyOutfitsTab />` (boards + log + creator) |
| 6 | `calendar` | Calendar | `<OutfitCalendarScreen />` |
| 7 | `trip` | Trip | `<TripPlannerScreen />` |
| 8 | `laundry` | Laundry | `<LaundryTab />` |

**`singleTab` prop on `ClosetScreen`:** When `singleTab="closet"` or `singleTab="liked"` is passed, `ClosetScreen` skips its screen wrapper and sub-tab bar and renders only the named sub-component directly. Components use React context — no prop drilling needed.

---

## Context Providers

All global state lives in `src/context/`.

| Context | Owns |
|---|---|
| `AppContext` | Quiz flow state machine (`screen`, `styleScores`, `quizMode`, `gender`), screen transitions, item queue. Exports `SCREENS` enum and `useTheme()`. |
| `AuthContext` | Firebase Auth session, signup/login/logout, Google OAuth, email verification, user profile CRUD |
| `ClosetContext` | `closetItems`, `closetByCategory`, `totalClosetCount`, Firestore sync, add/update/remove. Exposes `closetError` + `retryLoadCloset`. |
| `ExploreContext` | Pinned aesthetic tabs (`savedAesthetics`), Firestore sync |
| `ShopContext` | Shopping list with retailer filters |
| `WishlistContext` | `wishlist`, `liked`, `outfitBoards`, `saveOutfitBoard`, `deleteOutfitBoard` — all Firestore-persisted |
| `GuideContext` | Onboarding tour step state |
| `NavigationContext` | Tab navigation dispatcher for cross-screen navigation |

**Provider nesting order** (outermost → innermost):
```
AuthProvider → AppProvider → ShopProvider → WishlistProvider → ClosetProvider → ExploreProvider
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

## Styling System

- **CSS Modules** (`Component.module.css`) for component-scoped styles
- **Global theme variables** in `src/index.css` — see [data-models.md](data-models.md#css-variables) for full variable list
- **Dark mode default**; light mode toggled via `data-theme="light"` on `:root`, persisted to `localStorage` (`stylelab_theme`)
- **Primary accent:** `#E8735A` (coral) — always use `var(--accent)`, not the hex literal

**Rule:** Never use hardcoded dark-only hex fallbacks like `var(--foo, #1a1a1a)`. Use `var(--bg-elevated)` for solid sheet/modal backgrounds, `var(--bg-card)` for card surfaces, `var(--surface)` for subtle overlays.
