# Screens Inventory

## Quiz Flow (linear, pre-auth)

| Screen | File | Description |
|--------|------|-------------|
| Auth | `AuthScreen.jsx` | Email/password + Google OAuth sign-in/up. Password strength indicator, email validation via `validateSignupEmail` → `validateEmail` Firebase Function (syntax, throwaway domains, mail server, "Did you mean …?" typo fix — shared with SignupFlow's email step). Signup requires ToS/Privacy + age-16+ consent checkboxes (stored on the user doc); new Google users get the same consent step via `recordConsent`. |
| Welcome | `WelcomeScreen.jsx` | Landing page for unauthenticated users with CTA. |
| Onboarding | `onboarding/OnboardingFlow.jsx` | 4-step wizard: occupation → brands → referral → shopping email. Saves `onboardingComplete: true` to `users/{uid}`. |
| Seasons | `SeasonScreen.jsx` | Multi-select season picker (Spring / Summer / Fall / Winter) to seed item pool. |
| Categories | `CategoryScreen.jsx` | Multi-select clothing category picker (Tops, Bottoms, Footwear, etc.). |
| Discovery | `DiscoveryScreen.jsx` | Swipe-based infinite feed or finite 40-item quiz. Like/skip/undo. Buffered queue via `useDiscoveryQueue`. |
| Results | `ResultsScreen.jsx` | Top-3 aesthetic results after 40-item quiz, with recommended aesthetics. |

**Onboarding sub-screens** (`src/screens/onboarding/`):
- `OccupationScreen.jsx` — occupation picker
- `BrandsScreen.jsx` — multi-select favourite brands (distinct from the main-app `screens/BrandsScreen.jsx`)
- `ShoppingEmailScreen.jsx` — email signup for shopping alerts
- `ReferralScreen.jsx` — referral/invite friends

---

## Main App Screens

### Home (`HomeScreen.jsx`)
Section components live in `src/components/home/`. Order:
1. `WardrobeRecapCard` — monthly Spotify-Wrapped-style wardrobe recap (once per month; see services doc)
2. `HeroCarousel` — auto-advancing featured aesthetics. Its top bar holds `NotificationBell` next to `AuthWidget` (see below)
3. `DailyOutfitPreview` — compact weather-aware preview of today's AI outfit, deep-links to Outfits > Today. Renders nothing until the closet has 3+ items
4. `FreshLooksSection` — daily-rotating curated looks
5. `BrandsForYou` — brand recommendations from the user's top aesthetic
6. Seasonal picks (hidden once user has pinned aesthetics), trending aesthetics grid, `WardrobeBuilderCTA`
7. `GuideLauncher` appears at top for new users (no quiz scores yet)

**`NotificationBell`** — bell + unread badge in the hero top bar; tapping opens a dropdown panel (closes on outside tap / Escape). The list comes from `useHomeNotifications` (`src/hooks/useHomeNotifications.js`), which returns `{ id, icon, title, body, onOpen, onDismiss? }` items:
- **Build your digital closet** — while signed out or the closet has < 3 items; opens Outfits > Today
- **You're light on {category}** — the wardrobe gap from `useClosetGaps` + `useGapSignals`, with AI copy from `anthropicGapReasoning` (fetched only once the panel is opened); dismissable per category (14-day snooze); deep-links to `wardrobe-builder:{pieceId}`

The badge counts items whose `id` isn't in `localStorage sartima_seen_notifications`; opening the panel marks everything shown as seen. To add a new nudge, push another item in `useHomeNotifications`.

### Aesthetics (`ExploreScreen.jsx`)
Grid of all 51 aesthetic styles grouped by category, with search and All / Saved / Popular filters. Tap any to open its `AestheticScreen`.

### AestheticScreen (`AestheticScreen.jsx`)
Deep-dive page per aesthetic, split into sub-tab components under `src/screens/aestheticScreen/`: `StoryTab` (origin/culture), `ItemsTab` (key pieces), `LooksTab` (outfit gallery), `GuideTab` (styling guide), plus shared header/pinning in `shared.jsx`. Users can pin aesthetics (free: 3 pins).

### Brands (`BrandsScreen.jsx`)
Brand discovery index — cards for the ~190 profiled brands in `src/data/brands.js` with editorial imagery (Pexels). Tap opens `BrandScreen`.

### BrandScreen (`BrandScreen.jsx`)
Brand profile page with 4 sub-tabs: **Story** (history + positioning), **Lines** (sub-brands/diffusion lines with tier badges), **Collections** (current + iconic past collections), **Shop** (catalog products filtered to the brand, with like + wishlist actions). Records brand-visit signals via `interestTracker`. Back returns to the tab it was opened from (`brandFromTab`).

### Search (`SearchScreen.jsx`)
Client-side text search over the full ~7,500-product catalog with suggested searches, gender filter, like/wishlist actions, and `ProductImageToggle` (real product photo ↔ colour gradient). Accepts `forcedQuery` from the guide tour.

### Swipe / Discover (`DiscoveryScreen.jsx`)
Infinite product feed in the main app (non-quiz mode). Same component as quiz flow but `quizMode: false`. The tab can be hidden entirely from Settings.

### Outfits (`DailyLookScreen.jsx`)
Combined wardrobe + outfit hub. 8 scrollable sub-tabs — see [architecture.md](architecture.md#dailylookscreen-sub-tabs). Calendar / Trip / Laundry are Pro-gated.

Key sub-screens embedded within:
- **Today's Outfit** (`TodayTab.jsx`) — weather-aware AI outfit picker. Source selector: Closet / Liked / Both. Session-cached per day+occasion. Free tier: 1 generation/day. Logging an outfit records wear counts (`wearTracking`); a `missingCategory` in the AI response records a gap signal; outfits can be shared as a canvas-rendered PNG card (`shareCard`).
- **My Outfits** (`MyOutfitsTab.jsx`) — saved outfit boards + outfit log. FAB opens the outfit creator (pick items from Closet or Liked, name it, save). Free tier: 1 board.
- **Shop Scout** — `WardrobeBuildScreen` embedded; guided capsule wardrobe wizard.
- **Trip** (`TripPlannerScreen.jsx`) — enter destination + nights → AI packing list + daily outfit plan. Pro: 3 plans/month.
- **Calendar** (`OutfitCalendarScreen.jsx`) — monthly planner, tap a day to assign an outfit. Pro.
- **Laundry** (`LaundryTab.jsx`) — garment care symbol reference guide. Pro.

### Shop Scout / Wardrobe Builder (`WardrobeBuildScreen.jsx`)
Two views: **Scout** (the wizard) and **My List** (saved products, badge count). Wizard steps live in `src/screens/wardrobeBuild/`: `StepPieces` (pick pieces, or "Not sure" → starter capsule) → `StepBudget` (per-piece budget tier + filters) → `StepPriorities` (comfort/clean/fitted/etc.) → `ResultsView` (scored catalog recommendations via `wardrobeRecommend.js`, personalised by the interest graph; complement suggestions can be added mid-flow). Accepts `initialPiece` / `initialSpecificName` deep-link props (from the Home gap card). Piece options, budget tiers, and priorities are defined in `src/services/wardrobeRecommend.js`.

### Profile (`ProfileScreen.jsx`)
Identity-focused: top aesthetics, `StyleEvolutionChart`, `QuizHistorySection` (scroll target from Home's "Full breakdown →"). Subscription section: current tier, upgrade CTA / billing portal link (`openBillingPortal`). Support section: feedback + problem report sheets. Gear icon (⚙) opens `SettingsSheet`.

### MyStyle (`MyStyleScreen.jsx`)
Legacy screen (not in tab bar). Aesthetic Insights, Outfit Ideas, Style Notes, closet summary.

---

## SettingsSheet (`src/components/SettingsSheet.jsx`)

Slide-up sheet from ProfileScreen containing every user setting:

| Section | Contents |
|---|---|
| Gender | Men / Women / Both — filters all content |
| Scout | Auto-save results toggle, size, result count |
| Daily outfit | Default occasion (casual/work/date/gym/errand) |
| Preferred seasons | Season multi-select for outfit generation |
| App behavior | Show/hide Swipe tab, closet sort (date/category/favorites/least-worn), clear cache |
| Notifications | Enable daily outfit push reminder (FCM), reminder time picker. iOS Safari requires the PWA to be installed first (`isIOSStandaloneRequired`). |
| Shopping email | Edit the forwarding email captured at onboarding |
| Locale | Temperature unit °C/°F |
| Theme | Light/dark toggle |
| Data & privacy | View Privacy Policy / Terms (`LegalModal`), analytics consent toggle, **Export my data** (JSON download via `dataExport`), **Delete account** (confirm flow → `deleteAccount` Function) |
| Sign out | |

---

## Reusable Sub-screens / Modals

| Component | Description |
|-----------|-------------|
| `ClosetScreen.jsx` | Full closet manager. `singleTab="closet"` renders just the grid; `singleTab="liked"` renders just liked items. Enforces the free-tier 15-item closet cap. |
| `WardrobeBuildScreen.jsx` | See Shop Scout above. Accepts `onBack` callback for embedded use. |
| `OutfitCalendarScreen.jsx` | Monthly outfit planner. Persists to `users/{uid}/outfitPlans` subcollection. |
| `TripPlannerScreen.jsx` | Trip packing + outfit planner. Calls `anthropicTrip` Firebase Function. |
| `WardrobeScreen.jsx` | Grid of liked items bucketed by category. Each card supports try-on via `TryOnSheet`. |
| `WishlistScreen.jsx` | Catalog search and wishlist management. |
| `OutfitBoardScreen.jsx` | Curated outfit boards / lookbooks view. |
| `LikedScreen.jsx` | Analytics view showing aesthetic score breakdown from liked items. |

---

## Components (`src/components/`)

| Component | Description |
|-----------|-------------|
| `TabBar.jsx` / `Sidebar.jsx` | Bottom nav (mobile) / left rail (desktop). Same tab IDs, same `handleTabChange`. |
| `ProductCard.jsx` | Discovery item card: image, name, style tags, like/skip. |
| `ClothingCard.jsx` | Closet/liked item card with category badge and action menu. |
| `ProductImageToggle.jsx` | Toggles a product card between real product photo and colour-gradient placeholder (`productImage.js` resolves the source). |
| `AuthWidget.jsx` | Guest-user sign-in/up prompt CTA. |
| `ItemActionSheet.jsx` | Bottom sheet: try-on, add to closet, add to wishlist, share, remove. |
| `TryOnSheet.jsx` | Virtual try-on UI. Upload person photo + select garments → `generateTryOn` Function → Replicate IDM-VTON result. Pro-gated. |
| `CatalogSearchSheet.jsx` | Catalog product search over stock photos (Unsplash, Pexels fallback) via `stockPhotos.js`. |
| `ClosetItemSheet.jsx` | Detail view + edit sheet for closet items (incl. wear count / last-worn). |
| `WardrobeUpload.jsx` | Photo upload for closet. Claude Vision analyzes image, detects clothing items. Gated by `visionUploads` limit. |
| `CareSymbolPicker.jsx` | Garment care symbol selector. |
| `WeatherWidget.jsx` | Current weather (temp + condition) via geolocation. |
| `Toast.jsx` | Context-driven dismissable toast notification system. |
| `GuideTour.jsx` / `GuideLauncherButton.jsx` | Guided tour overlay + floating per-tab launcher. |
| `LockedOverlay.jsx` | Auth gate overlay for features requiring sign-in. |
| `PaywallModal.jsx` | Upgrade modal opened via `openPaywall(feature)`. Per-feature copy (`FEATURE_COPY`), monthly/annual Stripe checkout buttons, try-on pack purchase. |
| `WardrobeRecapCard.jsx` | Monthly wardrobe recap (most-worn item, "closet ghosts", repeat rate) from `useWardrobeRecap`; shown once per month via `recapSeen`. |
| `SettingsSheet.jsx` | See table above. Exports `GearIcon`. |
| `StyleEvolutionChart.jsx` | Aesthetic score evolution across quiz sessions (ProfileScreen). |
| `Banner.jsx` | Generic bottom banner shell used by the consent/legal banners. |
| `AnalyticsConsentBanner.jsx` | Cookie/analytics opt-in — analytics only initialise after consent (`sartima_analytics_consent`). |
| `LegalUpdateBanner.jsx` | Shown when the account's accepted `legalVersion` is stale; Review → `LegalModal`, Acknowledge → writes new version. |
| `LegalModal.jsx` | Renders `PRIVACY_POLICY` / `TERMS_OF_SERVICE` from `src/data/legalContent.js`. |
| `FeedbackSheet.jsx` | User feedback form → Firestore + email via `submitFeedback` Function. |
| `CrashReportSheet.jsx` | Bug report form with diagnostics (browser, error logs) → Firestore + email via `submitCrashReport` Function. |
