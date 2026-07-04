# Catalog Brand Expansion — Efficient Process Guide

This document explains the efficient approach for adding many products from multiple new brands to the Sartima catalog files (`src/data/products/*.js`).

---

## Overview

Catalog products live in five files split by parent type:
- `tops.js` — shirts, tees, blouses, dresses, etc.
- `bottoms.js` — jeans, trousers, skirts, shorts
- `outerwear.js` — jackets, coats, blazers, vests
- `knitwear.js` — sweaters, cardigans, pullovers
- `accessories.js` — bags, hats, belts, scarves, sunglasses

Each file exports a default array (e.g. `export default topsProducts`).

---

## Product Schema

Every product must conform to this shape:

```js
{
  id: 'brand-slug-descriptor',          // kebab-case, brand prefix + color/style suffix
  name: 'Product Name',
  brand: 'Brand Name',
  type: 'tshirt',                        // see valid types per file below
  parentType: 'tops',                    // tops | bottoms | outerwear | knitwear | accessories | footwear | activewear
  color: 'black',
  colorHex: '#1a1a1a',
  priceRange: 'mid',                     // budget | mid | contemporary | premium | luxury
  description: 'Brand Name Product — one evocative sentence.',
  seasons: ['spring', 'fall'],           // any subset of spring | summer | fall | winter
  gender: 'unisex',                      // men | women | unisex
  styleWeights: { rockchic: 5, vintage: 4 },  // keys from valid list below, values 1–10
  outfitCompanions: ['jeans', 'boot'],   // product types that pair well
  shopUrl: 'https://brand.com/search?q=Product+Name',
  shopFallbackUrl: 'https://brand.com/category',
  googleQuery: 'Brand product search keywords',
  gradient: 'linear-gradient(135deg,#darkHex,#lightHex)',
  emoji: '👕',
}
```

### Valid `styleWeights` keys
`vintage`, `minimalist`, `parisian`, `normcore`, `cleangirl`, `oldmoney`, `feminine`, `romantic`, `eclectic`, `preppy`, `americana`, `streetwear`, `avantgarde`, `kpop`, `sustainable`, `boho`, `gorpcore`, `athletic`, `luxury`, `rockchic`, `britpop`, `scandi`

**Never use any key not in this list.** The scoring engine ignores unknown keys silently.

### `priceRange` values
`budget` (< $30) | `mid` ($30–$80) | `contemporary` ($80–$200) | `premium` ($200–$600) | `luxury` (> $600)

### Dresses
Use `type: 'dress'` with `parentType: 'tops'` (not bottoms).

---

## ID Prefix Conventions

| Brand | Prefix |
|-------|--------|
| Iron & Resin | `ir-` |
| Buck Mason | `buckmason-` |
| Vince | `vince-` |
| Massimo Dutti | `mdutti-` |
| The Arrivals | `arrivals-` |
| Deadwood | `deadwood-` |
| Resistol | `resistol-` |
| Temperley London | `temperley-` |
| Vineyard Vines | `vv-` |
| Levi's | `levis-` |
| Dickies | `dickies-` |
| Wrangler | `wrangler-` |
| Urban Outfitters | `uo-` |
| Madewell | `madewell-` |
| Banana Republic | `br-` |
| Taylor Stitch | `taylors-` |

---

## How to Expand a Brand Efficiently

### Step 1: Audit current counts

Before writing any products, run a count to know the gap:

```bash
# Count products per brand in a file
grep -c "brand: 'Vince'" src/data/products/tops.js
```

Or across all files at once:

```bash
for f in tops bottoms outerwear knitwear accessories; do
  echo "=== $f ==="; grep -c "brand: 'Vince'" src/data/products/${f}.js 2>/dev/null || echo 0
done
```

Brands should reach at least **40 products total** across all files.

### Step 2: Plan distribution

Decide how many products go in each file based on brand DNA:

- **Outerwear brands** (The Arrivals, Deadwood, Iron & Resin): weight toward `outerwear.js`
- **Denim/workwear brands** (Levi's, Wrangler, Dickies): weight toward `bottoms.js`
- **Hat/accessories specialists** (Resistol): weight toward `accessories.js`
- **RTW brands** (Vince, Massimo Dutti, Temperley London): spread across tops + bottoms + outerwear

### Step 3: Write products in batches

**Critical:** Never write more than ~40–50 products in a single Edit call — large responses exceed the 32,000 output token limit and the call fails entirely.

**The safe pattern:**

```
Read last ~15 lines of the file
  → identify the unique anchor (end of last product + export line)
Edit: append batch of ≤40 products
  → old_string = unique anchor + "\n\n]\n\nexport default {name}Products"
  → new_string = same anchor + "\n\n  // BrandName\n" + products + "\n\n]\n\nexport default {name}Products"
Read last ~15 lines again (new anchor for next batch)
Edit: append next batch
... repeat
```

**Always Read before Edit** — Edit fails with "File has not been read yet" if you skip this.

### Step 4: Parallelise across files, serialise within a file

You can run agents for different files (tops, bottoms, outerwear) in parallel — they write to separate files with no conflicts.

Agents writing to the **same file** must run **sequentially** — concurrent appends produce duplicate export lines or corrupted JS.

### Step 5: Verify

After all batches complete, confirm counts:

```bash
# Count all brands across all product files
for brand in "The Arrivals" "Deadwood" "Vince" "Massimo Dutti" "Buck Mason" "Madewell" "Banana Republic"; do
  total=0
  for f in tops bottoms outerwear knitwear accessories; do
    n=$(grep -c "brand: '$brand'" "src/data/products/${f}.js" 2>/dev/null || echo 0)
    total=$((total + n))
  done
  echo "$brand: $total"
done
```

---

## Common Pitfalls

| Problem | Cause | Fix |
|---------|-------|-----|
| `File has not been read yet` | Edit called without prior Read | Always Read last ~15 lines before every Edit |
| Response exceeds 32,000 token limit | Too many products in one Edit call | Split into batches of ≤40 products |
| Duplicate `export default` line | Two agents wrote to same file concurrently | Run same-file agents sequentially |
| Anchor not unique | `old_string` matches multiple locations | Use a longer, more specific anchor (include 3–4 lines) |
| Invalid styleWeight key | Typo or invented aesthetic | Check against the 22-key list above |
| Brand count too low | Skipped a file or miscounted | Run the grep audit in Step 5 |

---

## Recommended Batch Sizes by File

Based on typical product density per brand:

| File | Products per brand | Brands per batch |
|------|--------------------|-----------------|
| tops.js | 6–16 | 3–4 brands |
| bottoms.js | 6–16 | 3–5 brands |
| outerwear.js | 8–20 | 2–3 brands |
| knitwear.js | 4–10 | 4–6 brands |
| accessories.js | 2–8 | 5–8 brands |
