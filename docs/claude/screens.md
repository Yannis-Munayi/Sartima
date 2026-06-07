# Screens Inventory

## Quiz Flow (linear, pre-auth)

| Screen | File | Description |
|--------|------|-------------|
| Auth | `AuthScreen.jsx` | Email/password + Google OAuth sign-in/up. Password strength indicator, email validation via `validateEmail` Firebase Function (DNS MX check). |
| Welcome | `WelcomeScreen.jsx` | Landing page for unauthenticated users with CTA. |
| Onboarding | `onboarding/OnboardingFlow.jsx` | 4-step wizard: occupation → brands → referral → shopping email. Saves `onboardingComplete: true` to `users/{uid}`. |
| Seasons | `SeasonScreen.jsx` | Multi-select season picker (Spring / Summer / Fall / Winter) to seed item pool. |
| Categories | `CategoryScreen.jsx` | Multi-select clothing category picker (Tops, Bottoms, Footwear, etc.). |
| Discovery | `DiscoveryScreen.jsx` | Swipe-based infinite feed or finite 40-item quiz. Like/skip/undo. Buffered queue via `useDiscoveryQueue`. |
| Results | `ResultsScreen.jsx` | Top-3 aesthetic results after 40-item quiz, with recommended aesthetics. |

**Onboarding sub-screens** (`src/screens/onboarding/`):
- `OccupationScreen.jsx` — occupation picker
- `BrandsScreen.jsx` — multi-select favourite brands
- `ShoppingEmailScreen.jsx` — email signup for shopping alerts
- `ReferralScreen.jsx` — referral/invite friends

---

## Main App Screens

### Home (`HomeScreen.jsx`)
Hero aesthetic carousel (auto-advancing, glassmorphic ‹ › arrows), daily fresh looks, Style Me Today CTA, seasonal picks (hidden once user has pinned aesthetics), trending aesthetics grid (2-col), wardrobe builder CTA. GuideLauncher appears at top for new users (no quiz scores yet).

### Aesthetics (`ExploreScreen.jsx`)
Grid of all 40+ aesthetic styles grouped by category (Core, Academic, Subculture, Creative). Tap any to open its `AestheticScreen`.

### AestheticScreen (`AestheticScreen.jsx`)
Deep-dive page per aesthetic: outfit inspiration, mood board, featured brands, color palette, character archetypes, styling guides, Pinterest gallery, shopping section. Users can pin aesthetics.

### Swipe (`DiscoveryScreen.jsx`)
Infinite product feed in the main app (non-quiz mode). Same component as quiz flow but `quizMode: false`.

### Outfits (`DailyLookScreen.jsx`)
Combined wardrobe + outfit hub. 8 scrollable sub-tabs — see [architecture.md](architecture.md#dailylookscreen-sub-tabs).

Key sub-screens embedded within:
- **Today's Outfit** — weather-aware AI outfit picker. Source selector: Closet / Liked / Both. Session-cached per day+occasion.
- **My Outfits** — saved outfit boards + outfit log. FAB opens `OutfitCreatorSheet` (pick items from Closet or Liked, name it, save).
- **Shop Scout** — `WardrobeBuildScreen` embedded; guided capsule wardrobe wizard with budget + priority filters.
- **Trip** — `TripPlannerScreen`; enter destination + nights → AI packing list + daily outfit plan.
- **Calendar** — `OutfitCalendarScreen`; monthly planner, tap a day to assign an outfit.
- **Laundry** — `LaundryTab`; garment care symbol reference guide.

### Profile (`ProfileScreen.jsx`)
Identity-focused: top aesthetics, style evolution, quiz history. Gear icon (⚙) in header opens a slide-up `SettingsSheet` containing: GenderSelector, ThemeToggle, Sign Out. `scrollToQuiz` prop + `quizSectionRef` enable cross-screen scroll targeting from Home's "Full breakdown →" link.

### MyStyle (`MyStyleScreen.jsx`)
Legacy screen (not in tab bar). Aesthetic Insights, Outfit Ideas, Style Notes, closet summary. Navigated to from GuideTour.

---

## Reusable Sub-screens / Modals

| Component | Description |
|-----------|-------------|
| `ClosetScreen.jsx` | Full closet manager. `singleTab="closet"` renders just the grid; `singleTab="liked"` renders just liked items. Without prop: full screen with sub-tab bar. |
| `WardrobeBuildScreen.jsx` | Step-by-step capsule wardrobe builder. Accepts `onBack` callback for embedded use. |
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
| `TabBar.jsx` | 5-tab bottom nav. Hanger icon on Outfits with closet badge. |
| `ProductCard.jsx` | Discovery item card: image, name, style tags, like/skip. |
| `ClothingCard.jsx` | Closet/liked item card with category badge and action menu. |
| `AuthWidget.jsx` | Guest-user sign-in/up prompt CTA. |
| `ItemActionSheet.jsx` | Bottom sheet: try-on, add to closet, add to wishlist, share, remove. |
| `TryOnSheet.jsx` | Virtual try-on UI. Upload person photo + select garment → calls `generateTryOn` Function → Replicate IDM-VTON result. |
| `CatalogSearchSheet.jsx` | Catalog product search. Tries Google CSE first, falls back to Pexels. `disabled` flag auto-flips on quota exceeded. |
| `ClosetItemSheet.jsx` | Detail view + edit sheet for closet items. |
| `WardrobeUpload.jsx` | Photo upload for closet. Claude Vision analyzes image, detects clothing items. |
| `CareSymbolPicker.jsx` | Garment care symbol selector. |
| `WeatherWidget.jsx` | Current weather (temp + condition) via geolocation. |
| `Toast.jsx` | Context-driven dismissable toast notification system. |
| `GuideTour.jsx` | Interactive onboarding overlay with step-by-step highlights. |
| `LockedOverlay.jsx` | Auth gate overlay for features requiring sign-in. |
| `FeedbackSheet.jsx` | User feedback form → Firestore + email via `submitFeedback` Function. |
| `CrashReportSheet.jsx` | Bug report form with diagnostics (browser, error logs) → Firestore + email via `submitCrashReport` Function. |
