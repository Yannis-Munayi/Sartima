# Data Models, Persistence & Build

## Closet Item Shape (`src/context/ClosetContext.jsx`)

```js
{
  id:            string,
  name:          string,
  category:      'tops' | 'bottoms' | 'outerwear' | 'dresses' | 'footwear' | 'accessories',
  color:         string,
  brand:         string,
  imageUrl:      string,        // original upload URL
  thumbnailUrl:  string,        // search result or upload URL
  prettifiedUrl: string,        // background-removed PNG (Firebase Storage)
  type:          'uploaded' | 'catalog',
  favorite:      boolean,
  tags:          string[],
  seasons:       ('spring' | 'summer' | 'fall' | 'winter')[],
  occasions:     ('casual' | 'work' | 'date' | 'gym' | 'errand' | 'formal' | 'outdoor')[],
  aiDetected:    boolean,
  timesWorn:     number,        // denormalised wear count (wearTracking.js)
  lastWorn:      string,        // date string of last logged wear
  addedAt:       number,        // Unix ms
  updatedAt:     number,
}
```

`ClosetContext` exposes `closetError` (raw Error | null) and `retryLoadCloset` (re-triggers Firestore fetch, bypassing the already-loaded guard). The fetch is extracted into `loadItems` (`useCallback`) shared by the mount effect and the retry button.

---

## Firestore Document Map

| Path | Contents | Written by |
|------|----------|-----------|
| `users/{uid}` | Profile: `displayName`, `email`, `occupation`, `preferredBrands`, `referralSource`, `shoppingEmail`, `onboardingComplete`, `legalVersion`, `legalAcceptedAt`, `ageAffirmed16Plus`, timestamps | client |
| `users/{uid}/prefs/closet` | `{ items: ClosetItem[] }` | client |
| `users/{uid}/prefs/wishlist` | `{ items: WishlistItem[] }` | client |
| `users/{uid}/prefs/liked` | `{ items: LikedItem[] }` | client |
| `users/{uid}/prefs/outfitBoards` | `{ items: OutfitBoard[] }` | client |
| `users/{uid}/prefs/savedAesthetics` | `{ ids: string[] }` | client |
| `users/{uid}/prefs/shopList` | `{ items: ShopItem[] }` | client |
| `users/{uid}/prefs/outfitLog` | `{ entries: OutfitLogEntry[] }` (`{ date, occasion, itemIds, ... }`) | client |
| `users/{uid}/prefs/interests` | Interest graph: `brandAffinities`, `typeAffinities`, `styleAffinities`, `colorAffinities`, `brandVisits`, `aestheticVisits`, `recentLikes[≤20]` | client (debounced) |
| `users/{uid}/prefs/notifications` | `{ fcmTokens[], reminderTime 'HH:MM', timezone, enabled }` — read by the scheduler Function via collection-group query | client (+ Function prunes stale tokens) |
| `users/{uid}/prefs/gapSignals` | `{ [category]: { count, lastSeenAt } }` — missingCategory hits from outfit generation | client |
| `users/{uid}/prefs/gapDismissals` | `{ [category]: dismissedAtMs }` — 14-day snooze | client |
| `users/{uid}/prefs/recapSeen` | `{ lastShownMonth: 'YYYY-MM' }` | client |
| `users/{uid}/prefs/tryOnCache` | Try-on results keyed by item IDs + avatar timestamp | client |
| `users/{uid}/prefs/usage` | Usage counters: `periodKey 'YYYY-MM'`, `visionUploads`, `tripPlans`, `tryOns`, `gapReasoning`, `lastOutfitDate`, `tryOnCredits` | **Functions only** (client read-only) |
| `users/{uid}/prefs/subscription` | `stripeCustomerId`, `stripeSubscriptionId`, `status`, `cancelAtPeriodEnd`, `currentPeriodEnd` | **Functions only** (client read-only) |
| `users/{uid}/outfitPlans/{planId}` | Subcollection — `{ date, itemIds, savedAt }` | client |
| `users/{uid}/quizzes/{quizId}` | Quiz result history | client |
| `users/{uid}/uploadedItems/{itemId}` | Uploaded catalog items | client |
| `/feedback/{docId}` | Written by `submitFeedback` Function only — client deny | Function |
| `/crashReports/{docId}` | Written by `submitCrashReport` Function only — client deny | Function |

**Persistence rule:** Prefer `getDoc`/`setDoc` on a `prefs/{key}` document with an array/map field — already covered by the `prefs/{prefId}` wildcard rule. If you need a new subcollection, add a `match` block to `firestore.rules` and `firebase deploy --only firestore:rules` **before** writing any data — writes to uncovered paths are silently rejected.

**Custom claims (not Firestore):** `sartima_tier` (`'pro'`) and `sartima_role` (`'admin'`) live on the Firebase Auth token, set by the Stripe webhook / manually. `SubscriptionContext` reads them client-side; Functions read them off `request.auth.token`.

---

## Firestore Rules (`firestore.rules`)

Every user path locked to `request.auth.uid == userId`. Catch-all denies everything else.

- `users/{uid}` and `users/{uid}/prefs/{prefId}` — owner read/write
- `users/{uid}/prefs/usage` and `users/{uid}/prefs/subscription` — owner **read-only**; writes blocked (Admin SDK in Functions bypasses rules)
- `users/{uid}/outfitPlans/{planId}`, `quizzes/{quizId}`, `uploadedItems/{itemId}` — owner read/write
- `/feedback`, `/crashReports` — deny all direct client access (server-only writes)

## Storage Rules (`storage.rules`)

- `users/{uid}/wardrobe/**` and `users/{uid}/avatar/{file}` — owner read/delete; create/update requires `image/*` content type and < 10 MB
- Everything else denied

---

## Data Layer (`src/data/`)

Large static JS files — **do not import dynamically**; Vite already splits them into named chunks.

| File | Size | Contents |
|------|------|----------|
| `products/` (9 files) + `products.js` index | ~6 MB total | **~7,500 catalog products** split by parent type: `tops`, `bottoms`, `outerwear`, `knitwear`, `accessories`, `activewear`, `footwear-specialists`, `footwear-wide`, `core`. Each product: `id, name, brand, type, parentType, color(+hex), priceRange, description, seasons, gender, styleWeights, outfitCompanions, shopUrl (+fallback), googleQuery, gradient, emoji`, optional `image`. `products.js` merges them and builds `PRODUCTS_BY_ID` / `PRODUCTS_BY_TYPE` lookup maps. Add products by editing the relevant category file (see `docs/claude/catalog-brand-expansion.md`). |
| `aestheticItems.js` | ~248 KB | 500+ quiz items, each with `styleWeights` map and category/gender flags |
| `brands.js` | ~236 KB | **190 brand profiles**: founded/origin, aesthetics, positioning, story, lines (sub-brands with tiers), current/past collections, key pieces, related brands, image queries. Brand `name` strings must match `products.js` `product.brand` and `styles.js` `aesthetic.brands`. |
| `aestheticDepth.js` | ~96 KB | Deep content per aesthetic: archetype, mood, palette, silhouette, key pieces, FAQ |
| `styles.js` | ~56 KB | **51 aesthetic definitions**: name, tagline, colour, gradient, icons, brand list, image queries |
| `looks.js` | ~48 KB | Pre-curated outfit lookbooks grouped by aesthetic |
| `categories.js` | ~36 KB | Clothing categories with 100+ items each; style weights + season/gender flags |
| `labels.js` | ~20 KB | Cross-cutting style label weights (e.g. "oversized" → aesthetic affinity boosts) |
| `itemGuide.js` | ~20 KB | Garment styling guides (how to wear specific pieces) |
| `legalContent.js` | ~16 KB | `LEGAL_VERSION` (bump on material copy changes → triggers re-consent banner), `MINIMUM_AGE` (16), `PRIVACY_POLICY`, `TERMS_OF_SERVICE`, draft-notice text |
| `retailers.js` | ~16 KB | Online retailer and brand data for affiliate/shopping links |
| `guideSteps.js` | ~12 KB | Guide tour content per tab (`GUIDE_ORDER`, `GUIDES`, `GUIDE_LABELS`) |
| `careSymbols.js` | ~12 KB | Laundry care symbol definitions and meanings |
| `capsuleBaseline.js` | <1 KB | `CAPSULE_BASELINE` per-category healthy-closet floors (tops 5, bottoms 3, outerwear 1, footwear 2, accessories 2; dresses deliberately none) |

---

## CSS Variables (`src/index.css`)

Theme: warm charcoal dark palette + warm ivory light palette. **Light is the default** (`sartima_theme` in localStorage); `data-theme="light"` on `:root` applies the light overrides.

### Colour

| Variable | Dark | Light |
|----------|------|-------|
| `--bg` | `#0C0A08` | `#F7F4EE` |
| `--bg-elevated` | `#161310` | `#FEFCF8` |
| `--bg-card` | `rgba(255,255,255,0.03)` | `rgba(0,0,0,0.04)` |
| `--surface` | `rgba(255,255,255,0.04)` | `rgba(0,0,0,0.05)` |
| `--surface-hover` | `rgba(255,255,255,0.07)` | `rgba(0,0,0,0.08)` |
| `--surface-strong` | `rgba(255,255,255,0.14)` | `rgba(0,0,0,0.12)` |
| `--border` | `rgba(255,255,255,0.07)` | `rgba(0,0,0,0.1)` |
| `--border-strong` | `rgba(255,255,255,0.14)` | `rgba(0,0,0,0.18)` |
| `--text` | `#EDE9E1` (warm ivory) | `#1A1611` |
| `--text-dim` | 78% text | 82% text |
| `--text-muted` | 60% text (≥4.5:1, body copy) | 68% text |
| `--text-faint` | 44% text (≥3:1, hints/placeholders/disabled only) | 54% text |
| `--accent` | `#B8956A` (champagne/caramel gold) | `#8B6840` |
| `--accent-dim` | `rgba(184,149,106,0.12)` | `rgba(139,104,64,0.1)` |
| `--accent-border` | `rgba(184,149,106,0.32)` | `rgba(139,104,64,0.3)` |
| `--accent-secondary` | `#C4A882` | `#94754F` |
| `--accent-gold` | `#C4A86A` | `#947540` |
| `--danger` / `-dim` / `-border` | `#E5534B` | `#B42318` |
| `--success` | `#6FBF8A` | `#2F7A4B` |

Never hardcode `rgba(255,255,255,…)` for surfaces/borders (invisible in light mode) or `rgba(184,149,106,…)` for gold (ignores the light and aesthetic accents) — use the tokens, or `color-mix(in srgb, var(--accent) N%, transparent)` for an in-between alpha. Literal white is only for text/controls sitting on photography.

### Type Scale

`--text-2xs`: 10px (uppercase eyebrows, badges, tab labels only) · `--text-xs`: 12px · `--text-sm`: 13px · `--text-base`: 14px · `--text-md`: 16px · `--text-lg`: 18px · `--text-xl`: 20px · `--text-2xl`: 24px · `--text-3xl`: 28px · `--text-4xl`: 32px · `--text-hero`: 40px · `--text-display`: 48px

Line heights: `--leading-none` 1 · `--leading-tight` 1.15 · `--leading-snug` 1.3 · `--leading-normal` 1.5 · `--leading-relaxed` 1.65

Body font: Inter. Display/serif headings: Cormorant Garamond / Playfair Display. Display headings go through `--font-display` (default `'Playfair Display', serif`).

### Adaptive aesthetic theming

`data-aesthetic="<flavor>"` on `:root` (set by `useAestheticFlavor` from the user's top aesthetic; 51 aesthetics → 11 flavors in `src/data/aestheticThemes.js`) overrides `--font-display`, all `--accent*` vars and, for some flavors, the radius scale — see `src/styles/aestheticThemes.css`. Off switch: `localStorage sartima_adaptive_theme = 'false'`; manual pin: `sartima_aesthetic_pin = '<flavor>'` (overrides the derived flavor); resolved flavor cached in `sartima_aesthetic_flavor` for flash-free boot (inline script in `index.html`).

### Spacing

4px grid: `--space-0-5` 2px (hairlines only) · `--space-1` 4 · `-2` 8 · `-3` 12 · `-4` 16 · `-5` 20 · `-6` 24 · `-7` 28 · `-8` 32 · `-10` 40 · `-12` 48 · `-14` 56 · `-16` 64 · `-20` 80 · `-24` 96. Use tokens for every padding/margin/gap, in CSS modules and inline styles alike.

### Border Radius

`--radius-xs`: 4px (tags, bars) · `--radius-sm`: 8px (small controls, thumbnails) · `--radius-md`: 12px (**the** component radius — buttons, inputs, cards) · `--radius-lg`: 20px (sheets, modals, large media) · `--radius-full`: pills/circles. Aesthetic flavors re-map xs–lg.

### Elevation & Motion

`--shadow-sm` / `-md` / `-lg` (lighter values in light mode) · `--shadow-accent` (primary-button lift) · `--shadow-focus` (focus ring). Durations `--duration-fast` 150ms · `-base` 200ms · `-slow` 300ms; easing `--ease-standard`. Hover transforms cap at `scale(1.04)` (controls) / `scale(1.02)` (cards).

### Icons

UI chrome uses `src/components/Icon.jsx` (`<Icon name="bag" size={18} />`, thin-stroke, `currentColor`) — not emoji. Emoji remain only as stand-ins for missing product photos, weather, care symbols and the laundry colour legend. Empty states use a 56px `--surface` circle with a 24px muted icon.

---

## Vite Chunk Strategy (`vite.config.js`)

| Chunk | Contents |
|-------|----------|
| `react-core` | `react`, `react-dom` |
| `firebase` | Full Firebase SDK incl. `firebase/functions` |
| `data-styles` | `styles.js`, `categories.js`, `aestheticItems.js`, `looks.js`, `retailers.js`, `labels.js` |
| `data-content` | `aestheticDepth.js`, `itemGuide.js` |
| `data-products` | everything under `src/data/products/` |
| `data-catalog` | `brands.js` (and `aesthetics.js` if added) |

`@anthropic-ai/sdk` and `stripe` live in `functions/` only — not client dependencies.

**Workbox / PWA** (`vite-plugin-pwa`):
- Precache limit raised to 8 MB; `data-products-*`, `data-catalog-*`, `data-content-*` chunks are **excluded from precache** (`globIgnores`) so the service worker doesn't balloon — they load over the network and hit the HTTP cache
- Pexels images → CacheFirst, 7 days, max 200 entries
- Unsplash images → CacheFirst, 7 days, max 200 entries
- Firestore API → NetworkFirst, 5 min, max 50 entries (5s timeout)
- Google Fonts → CacheFirst, 1 year, max 20 entries
- Manifest: standalone, portrait, SVG icons (192/512 + maskable)

A second, independent service worker (`public/firebase-messaging-sw.js`, dedicated scope `/firebase-cloud-messaging-push-scope`) handles FCM background pushes and coexists with the Workbox root-scope SW. It contains a copy of the public Firebase config (not processed by Vite).

When adding a heavy new dependency, assign it to an existing chunk or create a new named chunk to avoid bloating the main bundle.
