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
  addedAt:       number,        // Unix ms
  updatedAt:     number,
}
```

`ClosetContext` exposes `closetError` (raw Error | null) and `retryLoadCloset` (re-triggers Firestore fetch, bypassing the already-loaded guard). The fetch is extracted into `loadItems` (`useCallback`) shared by the mount effect and the retry button.

---

## Firestore Document Map

| Path | Contents |
|------|----------|
| `users/{uid}` | Profile: `displayName`, `email`, `occupation`, `preferredBrands`, `referralSource`, `shoppingEmail`, `onboardingComplete`, timestamps |
| `users/{uid}/prefs/closet` | `{ items: ClosetItem[] }` |
| `users/{uid}/prefs/wishlist` | `{ items: WishlistItem[] }` |
| `users/{uid}/prefs/liked` | `{ items: LikedItem[] }` |
| `users/{uid}/prefs/outfitBoards` | `{ items: OutfitBoard[] }` |
| `users/{uid}/prefs/savedAesthetics` | `{ ids: string[] }` |
| `users/{uid}/prefs/shopList` | `{ items: ShopItem[] }` |
| `users/{uid}/prefs/outfitLog` | `{ entries: OutfitLogEntry[] }` |
| `users/{uid}/outfitPlans/{planId}` | Subcollection — `{ date, itemIds, savedAt }` |
| `users/{uid}/quizzes/{quizId}` | Quiz result history |
| `users/{uid}/uploadedItems/{itemId}` | Uploaded catalog items |
| `/feedback/{docId}` | Written by `submitFeedback` Function only — client deny |
| `/crashReports/{docId}` | Written by `submitCrashReport` Function only — client deny |

**Persistence rule:** Prefer `getDoc`/`setDoc` on a `prefs/{key}` document with an array field — already covered by existing Firestore rules. If you need a new subcollection, add a `match` block to `firestore.rules` and `firebase deploy --only firestore:rules` **before** writing any data — writes to uncovered paths are silently rejected.

---

## Firestore Rules (`firestore.rules`)

Every path locked to `request.auth.uid == userId`. Catch-all denies everything else.

Covered paths: `users/{uid}`, `users/{uid}/prefs/{prefId}`, `users/{uid}/outfitPlans/{planId}`, `users/{uid}/quizzes/{quizId}`, `users/{uid}/uploadedItems/{itemId}`. Also explicit deny on `/feedback` and `/crashReports` (server-only writes).

---

## Data Layer (`src/data/`)

Large static JS files — **do not import dynamically**; Vite already splits them into named chunks.

| File | Size | Contents |
|------|------|----------|
| `aestheticItems.js` | ~247 KB | 500+ quiz items, each with `styleWeights` map and category/gender flags |
| `aestheticDepth.js` | ~94 KB | Deep content per aesthetic: archetype, mood, palette, silhouette, key pieces, FAQ |
| `products.js` | ~88 KB | 300+ catalog products with brand, price, colour, category, style tags, affiliate links |
| `looks.js` | ~48 KB | Pre-curated outfit lookbooks grouped by aesthetic |
| `styles.js` | ~54 KB | 40+ aesthetic definitions: name, tagline, colour, gradient, icons, brand list, image queries |
| `categories.js` | ~34 KB | Clothing categories with 100+ items each; style weights + season/gender flags |
| `labels.js` | ~18 KB | Cross-cutting style label weights (e.g. "oversized" → aesthetic affinity boosts) |
| `itemGuide.js` | ~18 KB | Garment styling guides (how to wear specific pieces) |
| `retailers.js` | ~12 KB | Online retailer and brand data for affiliate/shopping links |
| `careSymbols.js` | ~9 KB | Laundry care symbol definitions and meanings |

---

## CSS Variables (`src/index.css`)

### Colour

| Variable | Dark | Light |
|----------|------|-------|
| `--bg` | `#0f0f0f` | `#f5f4f0` |
| `--bg-elevated` | `#1a1a1a` | `#ffffff` |
| `--bg-card` | `rgba(255,255,255,0.04)` | `rgba(0,0,0,0.03)` |
| `--surface` | `rgba(255,255,255,0.05)` | `rgba(0,0,0,0.04)` |
| `--surface-hover` | `rgba(255,255,255,0.08)` | `rgba(0,0,0,0.07)` |
| `--border` | `rgba(255,255,255,0.08)` | `rgba(0,0,0,0.09)` |
| `--border-strong` | `rgba(255,255,255,0.18)` | `rgba(0,0,0,0.18)` |
| `--text` | `#ffffff` | `#111111` |
| `--text-dim` | `rgba(255,255,255,0.7)` | `rgba(0,0,0,0.7)` |
| `--text-muted` | `rgba(255,255,255,0.45)` | `rgba(0,0,0,0.45)` |
| `--text-faint` | `rgba(255,255,255,0.25)` | `rgba(0,0,0,0.25)` |
| `--accent` | `#E8735A` | same |
| `--accent-dim` | `rgba(232,115,90,0.15)` | same |
| `--accent-border` | `rgba(232,115,90,0.4)` | same |
| `--accent-secondary` | `#C4A882` (taupe) | same |
| `--accent-gold` | `#D4AF7A` (gold) | same |

Light mode activated by `data-theme="light"` on `:root`.

### Type Scale

`--text-2xs` / `--text-xs`: 12px · `--text-sm`: 13px · `--text-base`: 14px · `--text-md`: 15px · `--text-lg`: 17px · `--text-xl`: 20px · `--text-2xl`: 24px · `--text-3xl`: 28px · `--text-hero`: 32px

### Border Radius

`--radius-sm`: 8px · `--radius-md`: 14px · `--radius-lg`: 20px · `--radius-xl`: 24px · `--radius-full`: 9999px

---

## Vite Chunk Strategy (`vite.config.js`)

| Chunk | Contents |
|-------|----------|
| `react-core` | `react`, `react-dom` |
| `firebase` | Full Firebase SDK incl. `firebase/functions` |
| `data-styles` | `styles.js`, `categories.js`, `aestheticItems.js`, `looks.js`, `retailers.js`, `labels.js` |
| `data-content` | `aestheticDepth.js`, `itemGuide.js` |

`@anthropic-ai/sdk` lives in `functions/` only — not a client dependency.

**Workbox caching** (PWA):
- Pexels images → CacheFirst, 7 days, max 200 entries
- Firestore API → NetworkFirst, 5 min, max 50 entries (5s timeout)
- Google Fonts → CacheFirst, 1 year, max 20 entries

When adding a heavy new dependency, assign it to an existing chunk or create a new named chunk to avoid bloating the main bundle.
