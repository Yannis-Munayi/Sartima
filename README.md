# StyleLab — Full Project Breakdown

> A complete onboarding document for anyone coming to the project cold.  
> Last updated: June 2026

---

## Table of Contents

1. [What Is StyleLab?](#1-what-is-stylelab)
2. [Problem Statement & Goals](#2-problem-statement--goals)
3. [Target Audience](#3-target-audience)
4. [High-Level Scope](#4-high-level-scope)
5. [Feature Deep-Dives](#5-feature-deep-dives)
6. [Navigation & Screen Architecture](#6-navigation--screen-architecture)
7. [State Management](#7-state-management)
8. [Data Architecture (Firestore)](#8-data-architecture-firestore)
9. [AI Integration](#9-ai-integration)
10. [Backend — Firebase Cloud Functions](#10-backend--firebase-cloud-functions)
11. [Frontend Architecture](#11-frontend-architecture)
12. [Image & Media Pipeline](#12-image--media-pipeline)
13. [Authentication & Security](#13-authentication--security)
14. [Performance & PWA](#14-performance--pwa)
15. [Observability & Error Handling](#15-observability--error-handling)
16. [Development Workflow](#16-development-workflow)
17. [Environment Variables](#17-environment-variables)
18. [Known Constraints & Technical Debt](#18-known-constraints--technical-debt)
19. [Glossary](#19-glossary)

---

## 1. What Is StyleLab?

StyleLab is a **mobile-first progressive web app (PWA)** that acts as a personal fashion assistant. It helps users discover their aesthetic identity, build a digital wardrobe, and plan outfits day-to-day — all powered by AI.

The core loop is:
1. Take a **swipe-based style quiz** to identify which fashion aesthetics you align with (e.g. "old money", "streetwear", "dark academia").
2. Get a **personalised product feed** driven by those results.
3. Build a **digital closet** by uploading outfit photos or searching a product catalog.
4. Let the AI **generate daily outfit suggestions** from your closet, grounded in real weather and occasion.
5. Plan ahead with an **outfit calendar**, a **trip packer**, and a **guided wardrobe builder**.

StyleLab's downstream goal is converting fashion discovery into real purchases — the product catalog links directly to retailers, and a "Shop Scout" feature builds curated capsule shopping lists.

---

## 2. Problem Statement & Goals

### The Problem
Most people cannot articulate their own style. They know what they like when they see it but lack a framework or vocabulary to shop intentionally, build a coherent wardrobe, or communicate their aesthetic to others.

### What StyleLab Solves
- **Aesthetic vocabulary** — A quiz assigns labels (20+ named aesthetics) so users can communicate their style and discover aligned content.
- **Discovery fatigue** — An infinite personalised feed surfaces items scored against the user's evolving taste profile, so they stop doom-scrolling generic feeds.
- **Wardrobe paralysis** — AI daily-outfit generation takes the decision out of the user's hands each morning, grounded in weather, occasion, and what they actually own.
- **Disjointed shopping** — A wishlist, outfit boards, and a Shop Scout aggregator give users a single place to organise purchase intent.

### Business Goals
- Drive time-on-app through aesthetic exploration content (editorial-style aesthetic profiles).
- Drive conversion through direct retailer linking, a wishlist funnel, and email capture (shopping digest opt-in during onboarding).
- Retain users through daily-habit features: weather-based outfit of the day, outfit calendar, trip planner.

---

## 3. Target Audience

| Segment | Description |
|---|---|
| **Primary** | Fashion-conscious Gen Z (16–24). Heavy TikTok/Pinterest users, fluent in aesthetics culture, mobile-first, expect fast and visual interfaces. |
| **Secondary** | Younger Millennials (25–30) who want more intentional wardrobe curation without the overhead of fashion expertise. |
| **Gender** | Both men and women. A gender preference toggle is wired throughout the entire app (content, search queries, quiz items, product catalog). |
| **Device** | Primarily smartphones (iOS Safari, Android Chrome). Desktop is supported but the UI is designed for a 390–430 px viewport. |

---

## 4. High-Level Scope

### In Scope
- Style quiz with personalised scoring across 20+ aesthetics
- Infinite AI-scored product discovery feed
- 50+ editorial aesthetic profile pages with galleries and shopping links
- Digital closet (upload photos, Claude vision analysis, background removal)
- AI daily outfit generation (weather-aware, occasion-aware)
- Outfit log and monthly calendar
- Trip packing + outfit planner (AI-generated)
- Guided wardrobe builder (capsule wardrobe shopping)
- Wishlist, liked items, outfit boards
- Virtual try-on (overlay garments on user avatar photo)
- Laundry care tracking with care symbols
- Interactive app guide / feature tour (11 steps)
- Guest access with sign-in gates on personal features
- PWA (installable, offline-capable for static assets)

### Out of Scope (deliberately)
- Social features (sharing, following, commenting) — not yet built
- In-app purchasing / checkout — links out to retailers
- Custom retailer integrations / affiliate tracking — future roadmap
- Native mobile app (iOS/Android) — PWA only currently
- Real-time collaboration — single-user only

---

## 5. Feature Deep-Dives

### 5.1 Style Discovery Quiz

**Purpose:** Determine the user's aesthetic affinities through passive preference signals — swipe right to like, swipe left to skip.

**How it works:**
1. User picks one or more **seasons** (spring/summer/fall/winter) — this seeds the item pool.
2. User picks one or more **clothing categories** (tops/bottoms/footwear/etc.) — further narrows the pool.
3. Quiz begins: a stream of clothing items is shown one at a time (from `aestheticItems.js`, a 252 KB pre-built pool). Each item carries a `styleWeights` object mapping aesthetic IDs to a -1–1 affinity score.
4. Each like/skip updates the running `styleScores` object in `AppContext`. Scores accumulate additively per aesthetic.
5. After the quiz, a **Results screen** renders the top aesthetics by score, with a breakdown chart and curated outfit inspiration for each.

**Quiz modes:**
- **Full quiz** — linear flow, ends at Results screen. Results persisted to Firestore (`users/{uid}/quizzes/{quizId}`).
- **Retake** — same flow, new quiz ID written, `styleScores` reset first.
- **Infinite / feed mode** — the discovery feed also uses swipe responses to continuously update `styleScores` in the background.

**Key files:**
- `src/screens/DiscoveryScreen.jsx` — renders swipeable product cards
- `src/screens/SeasonScreen.jsx` — season picker
- `src/screens/CategoryScreen.jsx` — category picker
- `src/screens/ResultsScreen.jsx` — results breakdown
- `src/context/AppContext.jsx` — holds `styleScores`, reducer handles `LIKE_ITEM`, `SKIP_ITEM`
- `src/data/aestheticItems.js` — the item pool (252 KB static file)

---

### 5.2 Personalised Discovery Feed

**Purpose:** An infinite, never-ending product feed that improves as the user swipes more.

**How it works (`src/hooks/useDiscoveryQueue.js`):**
- Products come from `src/data/products.js` (600+ items, each with brand, type, color, styleWeights, outfitCompanions).
- Each product is scored against the current `styleScores` using weighted factors:
  | Signal | Weight |
  |---|---|
  | Brand affinity | ×10 |
  | Item type | ×15 |
  | Parent category | ×4 |
  | Color family | ×5 |
  | Style score | ×0.5 |
  | Outfit companion bonus | +8–12 |
- Products are ranked, then a **diversity injector** enforces maximums: no more than 3 items from the same brand or 4 of the same type per batch of 30.
- When the queue drops below a threshold, a new batch is generated and appended automatically — no pagination required.
- **Outfit companions:** If an item has related companion IDs (e.g. a jacket that pairs with specific trousers), those companions get an affinity bonus and are injected nearby in the queue to hint at outfit completion.
- **Cold start:** First session uses a random shuffle (no scores yet). After even one swipe the algorithm kicks in.
- **Session persistence:** Quiz-mode progress is saved to `sessionStorage` so a refresh doesn't lose position mid-quiz.

**Key files:**
- `src/hooks/useDiscoveryQueue.js`
- `src/data/products.js`
- `src/screens/DiscoveryScreen.jsx`

---

### 5.3 Aesthetic Exploration

**Purpose:** An editorial-style content layer where users explore named aesthetics, save ones they identify with, and use them as a discovery lens.

**What's in an aesthetic profile (`src/data/styles.js`, `src/data/aestheticDepth.js`):**
- Name, tagline, icon, color/gradient
- Description and cultural context
- Representative color palette
- Brand list with links
- Outfit inspiration image gallery (Pinterest-sourced, lazy-loaded)
- Styling guide / do-and-don't tips
- Shopping section — real products from the catalog filtered to that aesthetic
- Related aesthetics with navigation links

**There are 50+ named aesthetics**, including: old money, minimalist, streetwear, preppy, vintage, techwear, gorpcore, athleisure, dark academia, light academia, Y2K, cottagecore, coastal grandmother, quiet luxury, and more.

**ExploreScreen** (`src/screens/ExploreScreen.jsx`):
- Grid of all aesthetics with search and filters (All / Saved / Popular).
- Aesthetics are grouped by category (e.g. "Classic", "Subcultural", "Avant-garde").
- Gender preference filters the content displayed within each aesthetic.

**Pinning aesthetics:**
- Users can pin aesthetics to a "Saved" tab. Pins are stored in Firestore (`users/{uid}/prefs/savedAesthetics`).
- Pinned aesthetics appear in the ExploreScreen "Saved" filter and as quick-access tabs elsewhere.

**Key files:**
- `src/screens/ExploreScreen.jsx`
- `src/screens/AestheticScreen.jsx`
- `src/context/ExploreContext.jsx`
- `src/data/styles.js`
- `src/data/aestheticDepth.js`

---

### 5.4 Digital Closet

**Purpose:** A persistent digital representation of the user's real wardrobe, used as the source of truth for outfit generation and try-on.

**How items enter the closet:**

| Method | Flow |
|---|---|
| **Photo upload** | User takes or selects a photo → Claude vision (`anthropicVision` Cloud Function) analyses the image and returns detected clothing items (name, category, color, bounding boxes) → user confirms and edits → items saved |
| **Catalog search** | `CatalogSearchSheet` searches Google Custom Search or Pexels for product images by text query → user picks an image → item added with selected metadata |
| **Background removal ("Prettify")** | On any closet item, user can tap "Prettify" → @imgly WASM removes the background → prettified PNG uploaded to Firebase Storage and linked on the item |

**ClosetItem data model:**
```
{
  id, name, category, color, brand,
  imageUrl,        // original upload or catalog URL
  thumbnailUrl,    // low-res version
  prettifiedUrl,   // background-removed PNG (Firebase Storage)
  type,            // 'uploaded' | 'catalog'
  favorite,
  tags,
  seasons,         // ['spring', 'summer', 'fall', 'winter']
  occasions,       // ['casual', 'work', 'date', 'gym', 'errand', 'formal', 'outdoor']
  aiDetected,
  addedAt, updatedAt
}
```

**Category breakdown:** tops · bottoms · outerwear · dresses · footwear · accessories

**Closet screen features:**
- Filterable by category tabs
- Flip cards (front = photo, back = item details + edit actions)
- Favorite toggle
- Edit name, color, seasons, occasions, tags
- Care symbols picker (wash instructions)
- Delete

**Persistence:** Entire closet stored as a single Firestore document `users/{uid}/prefs/closet → { items: [...] }`. On load, a `getDoc` populates `ClosetContext`. Any item added while the load was in-flight is prepended (functional setState to preserve in-flight writes).

**Key files:**
- `src/context/ClosetContext.jsx`
- `src/screens/ClosetScreen.jsx`
- `src/components/WardrobeUpload.jsx`
- `src/components/CatalogSearchSheet.jsx`
- `src/components/ClosetItemSheet.jsx`
- `src/services/claudeVision.js`
- `src/services/prettify.js`

---

### 5.5 Daily Look Engine

**Purpose:** Generate a daily outfit from the user's closet each morning, personalised by weather and occasion.

**Today tab flow:**
1. App fetches **live weather** using browser geolocation → proxied via `getWeather` Cloud Function → OpenWeatherMap.
2. User picks an **occasion** (casual / work / date / gym / errand / formal / outdoor).
3. User picks a **source** (Closet / Liked items / Both).
4. `outfitAI.js` sends a filtered subset of the closet to the `anthropicOutfit` Cloud Function.
5. Claude Haiku selects 2–4 items: ≥1 top, ≥1 bottom (or dress), optional outerwear if temp < 16°C or precipitation detected.
6. Results are cached in `sessionStorage` by `{date}_{occasion}_{closetHash}` — so reopening the app on the same day with the same occasion doesn't re-run the AI.
7. The outfit card displays the selected items, Claude's reasoning, a weather note, and the occasion tag.
8. If a closet item has no stored photo URL, the outfit card auto-fetches an image from Pexels as a fallback.

**Sub-tabs of DailyLookScreen:**
| Tab | Purpose |
|---|---|
| **Today** | AI-generated outfit for today (weather + occasion) |
| **My Log** | History of all previously logged outfits with date/occasion/notes |
| **Calendar** | Monthly calendar view mapping logged outfits to dates |
| **Trip** | AI trip planner (see §5.7) |

**Outfit logging:** After viewing today's outfit, user can log it. Entries are written to Firestore `users/{uid}/prefs/outfitLog → { entries: [...] }`.

**Liked items as outfit source:** Liked items from the quiz/discovery feed are normalised to the ClosetItem shape before being passed to the AI — so the AI treats them identically to real closet items.

**Key files:**
- `src/screens/DailyLookScreen.jsx`
- `src/services/outfitAI.js`
- `src/services/weather.js`

---

### 5.6 Outfit Calendar

**Purpose:** A monthly planner letting users assign outfits to specific dates, useful for planning ahead (events, travel, weeks at a glance).

**How it works:**
- Calendar renders a month grid; each day cell can hold an outfit plan.
- Tapping a date opens an outfit picker from the closet.
- Plans are saved to Firestore `users/{uid}/outfitPlans` as individual documents: `{ date, itemIds, savedAt }`.
- The calendar and the My Log tab in DailyLookScreen both read from the same dataset.

**Key files:**
- `src/screens/OutfitCalendarScreen.jsx`

---

### 5.7 Trip Planner

**Purpose:** Given a destination and trip length, AI generates a full packing list and daily outfit plan using items already in the user's closet.

**Flow:**
1. User enters destination + number of nights.
2. `tripAI.js` sends minimal item metadata (id, name, category, color, seasons) to `anthropicTrip` Cloud Function (90s timeout).
3. Claude Haiku returns:
   - `packingList` — categorised list of items to bring, selected from the closet
   - `dailyOutfits` — array of day-by-day outfit combinations
   - `gapItems` — items the user doesn't own but should consider buying for this trip
4. `TripPlannerScreen` re-hydrates the returned item IDs back to full ClosetItem objects using the local closet.

**Key files:**
- `src/screens/TripPlannerScreen.jsx`
- `src/services/tripAI.js`

---

### 5.8 Wardrobe Builder (Shop Scout)

**Purpose:** A guided shopping assistant that helps the user build a capsule wardrobe by identifying what they need and presenting curated product recommendations.

**How it works:**
1. User selects clothing categories they want to fill.
2. User sets a budget and brand preferences.
3. The system scores products from the catalog against the user's style profile and budget.
4. Products are presented in a shopping-list UI.
5. Tapping a product links out to the retailer.
6. The user can save products to their Shop Scout list (Firestore: `users/{uid}/prefs/shopList`).

**Key files:**
- `src/screens/WardrobeBuildScreen.jsx`
- `src/context/ShopContext.jsx`
- `src/data/products.js`
- `src/data/retailers.js`

---

### 5.9 Wishlist, Liked Items & Outfit Boards

**Three distinct lists, all in `WishlistContext`:**

| List | What goes in it | Firestore path |
|---|---|---|
| **Liked items** | Products liked during the quiz or discovery feed | `users/{uid}/prefs/liked` |
| **Wishlist** | Products saved with buy-intent | `users/{uid}/prefs/wishlist` |
| **Outfit boards** | User-named collections of items curated into outfit combinations | `users/{uid}/prefs/outfitBoards` |

**Outfit boards:** Users can create named boards (e.g. "Summer weekend", "Office fits") and add any combination of liked/wishlist/closet items. Displayed in `OutfitBoardScreen`.

**Key files:**
- `src/context/WishlistContext.jsx`
- `src/screens/WardrobeScreen.jsx`
- `src/screens/LikedScreen.jsx`
- `src/screens/WishlistScreen.jsx`
- `src/screens/OutfitBoardScreen.jsx`

---

### 5.10 Virtual Try-On

**Purpose:** Overlay selected garments from the closet onto a user-uploaded avatar photo to preview an outfit visually.

**How it works:**
1. User uploads a full-body or half-body photo as their avatar (`useAvatar.js`). Background can be removed via Prettify.
2. User selects items from the closet to try on (categories limited to: tops, bottoms, outerwear, dresses).
3. `tryOn.js` calls `generateTryOn` Cloud Function with the avatar URL and selected item image URLs.
4. The Cloud Function chains multiple garment compositing operations server-side and returns an `outputUrl`.
5. Result is cached in Firestore `users/{uid}/prefs/tryOnCache` keyed by sorted item IDs + avatar timestamp.
   - Cache invalidates automatically when the user updates their avatar photo.

**Key files:**
- `src/components/TryOnSheet.jsx`
- `src/services/tryOn.js`
- `src/hooks/useAvatar.js`

---

### 5.11 Laundry Tracker

**Purpose:** Track the wash status and care requirements of closet items so the user knows what's clean, what needs washing, and how to care for each piece.

**Features:**
- Per-item care symbols picker (`CareSymbolPicker.jsx`) — standard laundry symbols (machine wash, hand wash, dry clean, tumble dry, etc.)
- Wash frequency tracking per item
- Laundry tab in ClosetScreen showing items by wash status

**Key files:**
- `src/screens/LaundryTab.jsx` (rendered as a tab within DailyLookScreen or ClosetScreen)
- `src/components/CareSymbolPicker.jsx`
- `src/data/careSymbols.js`

---

### 5.12 Onboarding Flow

**Purpose:** Collect key user data post-signup to personalise the experience and enable shopping-digest email capture.

**4-step wizard (skippable at each step):**
| Step | Screen | Data collected | Where saved |
|---|---|---|---|
| 1 | `OccupationScreen` | User's occupation | `users/{uid}.occupation` |
| 2 | `BrandsScreen` | Preferred brands (multi-select) | `users/{uid}.preferredBrands` |
| 3 | `ReferralScreen` | How they heard about StyleLab | `users/{uid}.referralSource` |
| 4 | `ShoppingEmailScreen` | Email for shopping digest (opt-in) | `users/{uid}.shoppingEmail` |

- Completion sets `users/{uid}.onboardingComplete = true`.
- Once complete, the main app tab bar is shown. If incomplete, the flow resumes.
- `OnboardingFlow.jsx` is the step controller; `AppContext` advances the `screen` state machine.

**Key files:**
- `src/screens/onboarding/OnboardingFlow.jsx`
- `src/screens/onboarding/OccupationScreen.jsx`
- `src/screens/onboarding/BrandsScreen.jsx`
- `src/screens/onboarding/ReferralScreen.jsx`
- `src/screens/onboarding/ShoppingEmailScreen.jsx`

---

### 5.13 Guide Tour

**Purpose:** An interactive 11-step feature walkthrough that introduces new users to every major feature in context.

**How it works:**
- `GuideTour.jsx` renders a floating tooltip/spotlight overlay.
- `useGuideController.js` drives step state and syncs tab navigation with guide progress (e.g. step 5 navigates to the Closet tab).
- `GuideContext` exposes step number and controls to any child component that needs to react to guide state (e.g. highlighting specific buttons).
- The tour is triggered from HomeScreen and can be re-launched from ProfileScreen settings.

**Key files:**
- `src/components/GuideTour.jsx`
- `src/hooks/useGuideController.js`
- `src/context/GuideContext.jsx`

---

### 5.14 Home Feed

**Purpose:** The app's landing tab — a magazine-style discovery surface showcasing aesthetic content and driving users to key features.

**Sections:**
| Section | Content |
|---|---|
| **Hero carousel** | 5 featured aesthetics with editorial photos, rotating automatically |
| **Style Me Today CTA** | Shortcut card that deep-links to the Daily Look tab |
| **Fresh Looks** | Daily-rotating gallery of curated outfit images (changes each day) |
| **Seasonal Picks** | Products filtered to the current season |
| **Trending Aesthetics** | Top aesthetics sorted by popularity |
| **Wardrobe Builder CTA** | Card linking to the Shop Scout / Wardrobe Build screen |
| **Aesthetic categories** | Horizontally scrollable rows grouped by aesthetic family |

**Key files:**
- `src/screens/HomeScreen.jsx`

---

### 5.15 Profile Screen

**Purpose:** User account management, style history, and settings.

**Contents:**
- Display name and avatar (editable)
- Gender preference toggle (affects all aesthetic content)
- Style evolution chart — how `styleScores` have shifted across quiz retakes
- Quiz history — list of past quizzes with score breakdowns
- Saved aesthetics quick list
- Dark/light mode toggle
- Re-launch guide tour button
- Sign out
- Feedback form (`FeedbackSheet`)
- Crash report form (`CrashReportSheet`)

**Key files:**
- `src/screens/ProfileScreen.jsx`

---

## 6. Navigation & Screen Architecture

### How Navigation Works

StyleLab does **not** use React Router. Navigation is entirely state-driven:
- `App.jsx` renders screens conditionally based on `state.screen` from `AppContext` and a local `activeTab` state variable.
- There are no URLs, no browser history pushes, no `<Link>` components.

**Screen state machine (AppContext):**
```
AUTH → WELCOME → ONBOARDING → SEASONS → CATEGORIES → DISCOVERY → RESULTS
                                                                     ↓
                                                              (main app tabs)
```
Once the quiz completes (or is skipped), the tab bar appears and the user navigates via tabs.

### Tab Bar (6 tabs, left to right)

| Tab ID | Screen rendered | Notes |
|---|---|---|
| `home` | `HomeScreen` | Default landing |
| `closet` | `ClosetScreen` (3 sub-tabs: My Closet · Outfits · Liked) | |
| `explore` | `ExploreScreen` | |
| `quiz` | `DiscoveryScreen` / `ResultsScreen` | Center elevated "Discover" tab |
| `daily` | `DailyLookScreen` (4 sub-tabs: Today · My Log · Calendar · Trip) | |
| `profile` | `ProfileScreen` | |

**Dynamic tabs:**
- `aesthetic:{id}` — opens a specific `AestheticScreen`; created via `openAestheticTab()` helper
- `wardrobe-builder` — opens `WardrobeBuildScreen`; navigated to directly, not in the tab bar
- `mystyle` — opens `MyStyleScreen`; legacy tab, still accessible via guide tour

**Closet sub-tab routing:** Passing `closet:liked` or `closet:outfits` as the tab ID navigates to ClosetScreen and sets the correct sub-tab directly. Used from cross-screen deep-links (e.g. "View liked items" button from ResultsScreen).

### Tab bar visibility

The tab bar is **hidden** on: `AUTH`, `ONBOARDING`, `SEASONS`, `CATEGORIES`. It appears only once the user reaches the main app.

### Navigation prop drilling (known debt)

`setActiveTab` (exposed as `handleTabChange`) is passed as a prop down to `HomeScreen`, `ExploreScreen`, `AestheticScreen`, `DailyLookScreen`, `ProfileScreen`, and `ResultsScreen`. A `NavigationContext` would be the clean fix but hasn't been done due to regression risk across all 6 screens.

---

## 7. State Management

StyleLab uses **React Context + hooks** — no Redux, no Zustand, no external store.

### Provider nesting order (outermost first)

```
AuthProvider
  └─ AppProvider
       └─ ShopProvider
            └─ WishlistProvider
                 └─ ClosetProvider
                      └─ ExploreProvider
```

Each provider wraps its children in `App.jsx`. This nesting means inner providers can read Auth and App state.

### Context responsibilities

| Context | File | What it owns |
|---|---|---|
| `AppContext` | `src/context/AppContext.jsx` | Screen state machine, quiz mode, selected seasons/categories, item swipe responses, `styleScores`, gender preference. Uses `useReducer`. |
| `AuthContext` | `src/context/AuthContext.jsx` | Firebase Auth session, current user object, signup/login/logout/Google OAuth |
| `ClosetContext` | `src/context/ClosetContext.jsx` | Closet items array, Firestore sync, add/update/remove operations, error + retry state |
| `WishlistContext` | `src/context/WishlistContext.jsx` | Wishlist items, liked items, outfit boards — all Firestore-synced |
| `ExploreContext` | `src/context/ExploreContext.jsx` | Saved (pinned) aesthetic IDs, currently open aesthetic — Firestore-synced |
| `ShopContext` | `src/context/ShopContext.jsx` | Shop Scout results (`scoutedGroups`), saved shopping list (`shopList`) — Firestore-synced |
| `GuideContext` | `src/context/GuideContext.jsx` | Active guide tour step, navigation controls |
| `NavigationContext` | `src/context/NavigationContext.jsx` | Single `navigate()` function provider (thin wrapper) |

### AppContext reducer actions (key ones)

| Action | Effect |
|---|---|
| `SET_SCREEN` | Advance the screen state machine |
| `LIKE_ITEM` | Add item to liked list, update `styleScores` by item's `styleWeights` |
| `SKIP_ITEM` | Add item to skipped list, minor negative score update |
| `SET_SEASONS` | Store selected seasons for quiz seed |
| `SET_CATEGORIES` | Store selected categories for quiz seed |
| `RESET_QUIZ` | Clear scores and responses, return to quiz start |
| `SET_GENDER` | Update gender preference across all content |

### Firestore sync pattern

All persisted contexts use the same pattern:
1. On user sign-in, `getDoc` fetches the saved data.
2. The `.then` uses the **functional form** of `setState` to merge in-flight items with loaded data (items added while the load was in progress are prepended, not overwritten).
3. Writes use `setDoc` with the full updated array (merge is not used — the whole document is replaced on each write).

**Guest users:** Contexts work in memory only. Sign-in gates appear (`LockedOverlay` component) on features that require persistence.

---

## 8. Data Architecture (Firestore)

### Document map

```
users/{uid}
  ├── (root doc)  displayName, email, occupation, preferredBrands,
  │               referralSource, shoppingEmail, onboardingComplete,
  │               createdAt, updatedAt
  │
  ├── prefs/closet           → { items: ClosetItem[] }
  ├── prefs/wishlist         → { items: WishlistItem[] }
  ├── prefs/liked            → { items: LikedItem[] }
  ├── prefs/outfitBoards     → { items: OutfitBoard[] }
  ├── prefs/savedAesthetics  → { ids: string[] }
  ├── prefs/shopList         → { items: ShopItem[] }
  ├── prefs/outfitLog        → { entries: OutfitLogEntry[] }
  ├── prefs/tryOnCache       → { [itemId]: { url, generatedAt, avatarUpdatedAt } }
  │
  ├── outfitPlans/{planId}   → { date, itemIds, savedAt }  (subcollection)
  ├── quizzes/{quizId}       → { styleScores, responses, items, completedAt }
  └── uploadedItems/{itemId} → user-contributed catalog items

feedback/{docId}             → feedback submissions (write-only via Cloud Function)
crashReports/{docId}         → crash reports (write-only via Cloud Function)
```

### Firestore Rules Summary

- All `users/{uid}/**` paths: owner-only read + write (`request.auth.uid == userId`)
- `feedback` and `crashReports`: not directly writable from the client — only Cloud Functions can write (server-side auth bypass)
- Catch-all deny for every other path
- Rules are in `firestore.rules` and deployed with `firebase deploy --only firestore:rules`

### Adding new persistence

Preference: add a new key under `users/{uid}/prefs/{newKey}` — already covered by existing rules, no rule redeployment needed.

If you need a new subcollection (e.g. `users/{uid}/newThings/{id}`), add a `match` block to `firestore.rules` and **redeploy rules before writing any data** — writes to uncovered paths are silently rejected.

---

## 9. AI Integration

All AI calls go through Firebase Cloud Functions — **no Anthropic API key is ever in the browser**.

### Model used

`claude-haiku-4-5-20251001` — controlled by the `CLAUDE_HAIKU` constant in `functions/index.js`. Change it once there to upgrade all three AI functions simultaneously.

### Three AI capabilities

#### 9.1 Outfit Generation (`outfitAI.js` → `anthropicOutfit`)

Input sent to Claude:
- Filtered closet items (pre-filtered to current season, further filtered by occasion if ≥5 candidates)
- Current weather (temperature, condition)
- Occasion
- Date
- User gender
- User occupation (from onboarding)

Output from Claude:
- `selectedIds` — 2–4 item IDs from the closet
- `reasoning` — short natural-language explanation
- `weatherNote` — weather-specific comment
- `occasionTag` — confirmed occasion label

Selection rules enforced by the prompt:
- Always ≥1 top AND ≥1 bottom (or a dress)
- Outerwear added if temp < 16°C or precipitation
- Items must be for the correct season
- Items should suit the occasion

Session caching key: `stylelab_outfit_{dateStr}_{occasion}_{closetHash}`

Returns `null` on failure or if the closet pool is < 3 items.

#### 9.2 Vision Analysis (`claudeVision.js` → `anthropicVision`)

Input: Base64-encoded outfit photo

Output per detected item:
- `name` — descriptive item name
- `category` — one of the 6 closet categories
- `color` — dominant color
- `description` — short style description
- `boundingBox` — normalized coordinates (for future UI overlays)

Used when the user uploads a photo to add items to their closet. Claude identifies each clothing item in the photo and the user confirms/edits before saving.

#### 9.3 Trip Planning (`tripAI.js` → `anthropicTrip`)

Input:
- Destination name
- Number of nights
- Minimal closet item metadata (id, name, category, color, seasons)
- User gender

Output:
- `packingList` — categorised subset of closet items to bring
- `dailyOutfits` — array of `{ day, morning?, evening? }` outfit combinations
- `gapItems` — items the user doesn't own but would be useful for this trip

The screen re-hydrates item IDs back to full ClosetItem objects client-side.

---

## 10. Backend — Firebase Cloud Functions

All functions are Node.js (Gen 2), deployed to `us-central1`. Every function enforces authentication via `requireAuth(request)` — unauthenticated calls throw `unauthenticated` immediately.

### Function inventory

| Function | Purpose | Timeout | Auth |
|---|---|---|---|
| `anthropicVision` | Claude vision analysis of outfit photos | 90s | Required |
| `anthropicOutfit` | Claude outfit selection from closet | 60s | Required |
| `anthropicTrip` | Claude trip packing + outfit plan | 120s | Required |
| `getWeather` | OpenWeatherMap fetch by lat/lon | 30s | Required |
| `searchImages` | Pexels / Google CSE / Unsplash image search | 30s | Required |
| `proxyImage` | Fetch cross-origin images as data URLs (CORS bypass) | 30s | Required |
| `generateTryOn` | Virtual try-on garment compositing | 120s | Required |
| `validateEmail` | MX record lookup for pre-signup validation | 15s | None (public) |
| `submitFeedback` | Write feedback to Firestore `feedback/` | 30s | Required |
| `submitCrashReport` | Write crash report to Firestore `crashReports/` | 30s | Required |

### Image search logic (`searchImages`)

The function accepts a `source` parameter:
- `'google'` → Google Custom Search API
- `'pexels'` → Pexels API
- `'unsplash'` → Unsplash API

The client layer tries Google first, then Pexels as fallback. If Google returns `{ quotaExceeded: true }`, a module-level `disabled` flag flips to `true` in `google.js` and Pexels is used silently for the rest of the session.

### Local development with emulator

Set `VITE_USE_EMULATOR=true` in the client `.env`. `firebase.js` conditionally calls `connectFunctionsEmulator(functions, 'localhost', 5001)`. Run the emulator:
```bash
firebase emulators:start --only functions
```

---

## 11. Frontend Architecture

### Tech stack

| Layer | Technology |
|---|---|
| Framework | React 18 (hooks-only, no class components) |
| Build tool | Vite 5 |
| Styling | CSS Modules (one `.module.css` per component) |
| Global styles | `src/index.css` (CSS custom properties / theme variables) |
| PWA | `vite-plugin-pwa` + Workbox |
| Error tracking | Sentry (`@sentry/react`) |

### Styling system

- **Default theme: dark mode.** Light mode is toggled via `data-theme="light"` on the HTML root element, persisted to `localStorage` (`stylelab_theme`).
- **Primary accent color:** `#E8735A` (warm coral-orange)
- **All colors use CSS variables:** `--bg`, `--surface`, `--text`, `--text-secondary`, `--accent`, `--border`, etc. — defined in `src/index.css`.
- **CSS Modules** prevent class name collisions — each component imports its own styles as an object.

### Code splitting (Vite chunk strategy)

Manual chunks defined in `vite.config.js`:

| Chunk | Contents |
|---|---|
| `react-core` | React, ReactDOM |
| `firebase` | All Firebase SDKs including Functions |
| `data-styles` | `styles.js`, `aestheticDepth.js` (style definitions) |
| `data-content` | `aestheticItems.js`, `products.js`, `looks.js` (large data) |

The Anthropic SDK (`@anthropic-ai/sdk`) is NOT a client dependency — it only lives in `functions/`. This keeps the main bundle clean.

### Component inventory (17 components)

| Component | Purpose |
|---|---|
| `AuthWidget` | Sign-in/avatar button in header |
| `TabBar` | Bottom navigation |
| `Toast` | Notification toasts |
| `GuideTour` | 11-step interactive walkthrough overlay |
| `WeatherWidget` | Geolocation + weather display |
| `ProductCard` | Single item card in the discovery feed |
| `ClothingCard` | Closet item card |
| `ItemActionSheet` | Bottom sheet for item add/save actions |
| `ShopPanel` | Shopping list slide-over panel |
| `CatalogSearchSheet` | Search-and-add items from catalog to closet |
| `ClosetItemSheet` | Full edit sheet for a closet item |
| `WardrobeUpload` | Photo upload + Claude vision flow |
| `TryOnSheet` | Virtual try-on interface |
| `CareSymbolPicker` | Laundry care symbols picker |
| `LockedOverlay` | "Sign in to use this feature" gate |
| `FeedbackSheet` | User feedback form |
| `CrashReportSheet` | Error report form |

### Custom hooks (3 hooks)

| Hook | Purpose |
|---|---|
| `useDiscoveryQueue` | Smart product recommendation queue with affinity scoring |
| `useGuideController` | 11-step guide tour state and tab navigation coordination |
| `useAvatar` | Avatar upload, prettify, and try-on cache management |

---

## 12. Image & Media Pipeline

### Closet photo upload flow
```
User selects photo
  → WardrobeUpload component
  → File uploaded to Firebase Storage (users/{uid}/wardrobe/{itemId})
  → URL stored in ClosetItem.imageUrl
  → (optional) Prettify: @imgly WASM removes background
      → Blob uploaded to Firebase Storage (users/{uid}/wardrobe/prettified/{itemId}.png)
      → URL stored in ClosetItem.prettifiedUrl
```

### Catalog image search flow
```
User types search query in CatalogSearchSheet
  → google.js calls searchImages Cloud Function (source: 'google')
  → If quota exceeded or empty → pexels.js fallback
  → Results displayed as a grid
  → User selects an image → item created with that thumbnailUrl
```

### Outfit card image fallback
```
Outfit card renders an item
  → If item has imageUrl → show it
  → If no imageUrl → fetch from Pexels via searchImages (source: 'pexels')
     → Cache result in module-level bounded cache (max 150 entries)
```

### Image caching

`src/services/cache.js` exports `createBoundedCache(max = 150)`. Returns a `{ has, get, set }` Map wrapper that evicts the oldest entry (FIFO) once the limit is reached. All image service modules use this — never a bare `new Map()`.

### Background removal (Prettify)

`src/services/prettify.js` wraps `@imgly/background-removal`:
- WASM module is **lazy-loaded** on first call — not in the initial bundle.
- Accepts `File`, `Blob`, or URL string.
- URLs that cross CORS restrictions are first fetched via the `proxyImage` Cloud Function.
- Progress callback exposed for UI feedback.

---

## 13. Authentication & Security

### Auth methods
- Email + password (with email verification)
- Google OAuth sign-in
- Guest mode (no account required, limited feature set)

### Guest vs. authenticated experience

| Feature | Guest | Authenticated |
|---|---|---|
| Quiz & discovery feed | ✅ | ✅ |
| Aesthetic exploration | ✅ | ✅ |
| Home feed | ✅ | ✅ |
| Digital closet | ✅ (in-memory only) | ✅ (Firestore-synced) |
| Liked items / wishlist | ✅ (in-memory only) | ✅ (Firestore-synced) |
| Daily outfit generation | ✅ | ✅ |
| Outfit log & calendar | ❌ (LockedOverlay) | ✅ |
| Trip planner | ❌ | ✅ |
| Virtual try-on | ❌ | ✅ |
| Profile screen | Partial | ✅ |

### Security model

- **Firebase API keys** (`VITE_FIREBASE_*`) are intentionally public — Firebase security is enforced by Firestore security rules and Auth, not by keeping keys secret.
- **All third-party keys** (Anthropic, OpenWeatherMap, Pexels, Google, Unsplash) are stored only in `functions/.env` and Firebase console environment variables — never in the client bundle.
- **Every Cloud Function** calls `requireAuth(request)` before doing any work. Unauthenticated calls immediately throw `HttpsError('unauthenticated')`.
- **Firestore rules** enforce owner-only access on all user data paths. A catch-all deny blocks everything else.

---

## 14. Performance & PWA

### PWA setup

StyleLab is installable as a PWA. The service worker (generated by `vite-plugin-pwa` with Workbox) uses intelligent caching strategies:

| Resource type | Strategy | TTL |
|---|---|---|
| Static assets (JS, CSS, images) | CacheFirst | 365 days |
| Google Fonts | CacheFirst | 365 days |
| Pexels images | CacheFirst | 7 days |
| Firestore API calls | NetworkFirst | 5 min |
| Everything else | NetworkFirst | — |

This means the app shell loads instantly on repeat visits, aesthetic images are cached after first view, and Firestore data stays reasonably fresh.

### Performance techniques

| Technique | Where |
|---|---|
| Lazy image loading | `IntersectionObserver` on all gallery images — Pexels request deferred until card enters viewport |
| WASM lazy-load | `@imgly/background-removal` loaded only when Prettify is first invoked |
| Session-storage caching | Outfit generation results, weather data, geolocation coordinates |
| Bounded in-memory caches | `createBoundedCache(150)` on Pexels, Google, Unsplash — prevents unbounded memory growth |
| Manual code splitting | 4 named Vite chunks prevent a single large bundle |
| Discovery queue buffering | 30-item buffer refills automatically — no blocking load between swipes |

---

## 15. Observability & Error Handling

### Sentry integration

Sentry is initialised in `src/main.jsx`. It is **only active in production builds** (`import.meta.env.PROD`). The DSN comes from `VITE_SENTRY_DSN` — if empty, Sentry is skipped entirely (safe for local dev).

### Logger pattern (`src/services/logger.js`)

All service-level errors route through two functions:

```js
logError(service, message, context) // → console.error + Sentry exception
logWarn(service, message, context)  // → console.warn + Sentry warning
```

Every service file imports from `logger.js` instead of calling `console.error` directly. This keeps all Sentry wiring in one place and ensures consistent error reporting.

### User-facing error reporting

- **FeedbackSheet** — a bottom-sheet form users can submit from ProfileScreen. Writes to Firestore `feedback/` via `submitFeedback` Cloud Function.
- **CrashReportSheet** — similar form for technical issues. Writes to `crashReports/` via `submitCrashReport` Cloud Function.
- Both collections are write-only for clients (Cloud Function bypasses Firestore rules).

### Closet error recovery

`ClosetContext` exposes `closetError` (raw Error or null) and `retryLoadCloset` (re-triggers the Firestore fetch, bypassing the already-loaded guard). `ClosetScreen` shows a user-visible error state with a Retry button when `closetError` is set.

---

## 16. Development Workflow

### Commands

```bash
npm run dev        # Start Vite dev server with HMR at localhost:5173
npm run build      # Production build → dist/
npm run preview    # Preview production build locally
```

No test suite or linting is currently configured.

### Firebase deployment

```bash
# Deploy everything
firebase deploy

# Deploy only Cloud Functions
cd functions && npm install   # first time only
firebase deploy --only functions

# Deploy only Firestore rules
firebase deploy --only firestore:rules

# Deploy only Storage rules
firebase deploy --only storage
```

### Local development with emulators

1. Add `VITE_USE_EMULATOR=true` to the client `.env`.
2. Add API keys to `functions/.env`.
3. Run:
```bash
firebase emulators:start --only functions
```
The client automatically connects to `localhost:5001` for all Cloud Function calls.

### Adding a new Cloud Function

1. Add a new `onCall` export to `functions/index.js`.
2. Add the required API key to `functions/.env` and the Firebase console (Functions → Edit → Environment variables).
3. Call it from the client:
   ```js
   import { httpsCallable } from 'firebase/functions';
   import { functions } from './firebase';
   const myFunc = httpsCallable(functions, 'myFunctionName');
   const result = await myFunc({ payload });
   ```

### Adding new Firestore persistence

- If it fits under `users/{uid}/prefs/{key}` — just write to it, existing rules cover it.
- If it's a new subcollection (`users/{uid}/newThings/{id}`) — add a `match` block to `firestore.rules` and **redeploy rules first**.

---

## 17. Environment Variables

### Client (`.env` in project root) — `VITE_` prefix, bundled into the browser

| Variable | Purpose |
|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase project API key (intentionally public) |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase Storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging |
| `VITE_FIREBASE_APP_ID` | Firebase app ID |
| `VITE_SENTRY_DSN` | Sentry DSN (empty = Sentry disabled) |
| `VITE_USE_EMULATOR` | `true` to use local Firebase emulator |

### Server (`functions/.env`) — never sent to the browser

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic Claude API |
| `OPENWEATHER_KEY` | OpenWeatherMap API |
| `PEXELS_KEY` | Pexels image search |
| `GOOGLE_API_KEY` | Google Custom Search |
| `GOOGLE_CX` | Google Custom Search engine ID |
| `UNSPLASH_KEY` | Unsplash image search |

Server keys must also be set in the **Firebase console** under Functions → Edit → Environment variables for deployed functions to read them. `functions/.env` is for local emulator use only.

---

## 18. Known Constraints & Technical Debt

| Area | Issue | Impact |
|---|---|---|
| **Navigation prop drilling** | `setActiveTab` (as `handleTabChange`) is passed as a prop to 6 screens. A `NavigationContext` would be cleaner but touching all 6 screens carries regression risk. | Medium — works correctly, just messy |
| **No test suite** | Zero unit or integration tests. | High — regressions are caught only manually |
| **No linting** | No ESLint or Prettier configured. | Low — code style is inconsistent in places |
| **Large static data files** | `aestheticItems.js` is 252 KB, `products.js` is 90 KB. Vite splits them but they're still loaded eagerly. | Low — code splitting mitigates it |
| **Firestore prefs as arrays** | All prefs are stored as arrays in single documents. Large closets (100+ items) will hit Firestore's 1 MB document limit. | Future risk — needs migration to subcollection if closets grow large |
| **Session-only quiz persistence** | Quiz progress is in `sessionStorage`. A page close (not refresh) loses progress. | Low — quiz is short enough that this is acceptable |
| **React Router absent** | No URL-based routing means no browser back button, no deep linking, no bookmarkable URLs. | Medium — acceptable for a mobile PWA but limits shareability |
| **Virtual try-on** | Fully implemented client-side and server-side but quality depends on the compositing service. Currently experimental. | Low — feature is optional |
| **Google image search quota** | Google Custom Search has a daily quota. The client has a per-session fallback to Pexels but quota exhaustion mid-session is possible. | Low-medium — handled gracefully |

---

## 19. Glossary

| Term | Meaning |
|---|---|
| **Aesthetic** | A named fashion style identity (e.g. "old money", "gorpcore"). StyleLab has 50+ defined aesthetics. |
| **styleScores** | An object mapping aesthetic IDs to numeric affinity scores, updated by quiz swipes. Lives in `AppContext`. |
| **ClosetItem** | The data model for a single item in the digital closet. |
| **Discovery feed** | The infinite swipe-based product stream driven by `useDiscoveryQueue`. |
| **Outfit board** | A user-named collection of items curated into an outfit combination (separate from AI-generated outfits). |
| **Prettify** | Background removal on a clothing photo using `@imgly/background-removal` WASM. |
| **Shop Scout** | The wardrobe-builder feature that recommends products to buy based on gaps in the user's wardrobe. |
| **Trip planner** | AI feature that generates a packing list and daily outfit plan for a trip destination. |
| **Try-on** | Virtual garment overlay on a user avatar photo via `generateTryOn` Cloud Function. |
| **Cloud Function** | A Firebase serverless function that proxies third-party API calls to keep keys off the client. |
| **prefs/** | The Firestore subcollection under `users/{uid}/prefs/` that stores all user preference data. |
| **CLAUDE_HAIKU** | The constant in `functions/index.js` that sets the Anthropic model for all three AI functions. |
| **Guide tour** | The 11-step interactive walkthrough component (`GuideTour.jsx`) that introduces the app's features. |
| **seeded** | A boolean flag from `useDiscoveryQueue` that flips `true` after the first product batch is ready, used to distinguish loading from truly empty. |
| **Companion** | A product that pairs well with another product (defined in `products.js` as `outfitCompanions`). |
| **Bounded cache** | The `createBoundedCache()` helper in `cache.js` — a Map that evicts oldest entries to prevent memory leaks. |

---

*Document generated from codebase exploration — June 2026.*
