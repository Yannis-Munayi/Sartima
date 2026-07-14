Adding Brand Products to the Sartima Catalog
You are expanding the Sartima fashion app's product catalog. The catalog is split across src/data/products/ files: tops.js, bottoms.js, outerwear.js, knitwear.js, accessories.js, footwear.js, activewear.js.

Goal: Bring a set of brands to exactly 40 products each across all files.

Step 0 — Audit first
Before writing anything, grep to find how many products each target brand already has:


cd src/data/products && for brand in "Brand A" "Brand B"; do
  echo "$brand: $(grep -rh "brand: " *.js | grep -c "'$brand'")"
done
For brands with apostrophes (e.g. Levi's), use grep -c "Levi" *.js per file. Some brands may already be at 40 via pre-existing catalog entries — skip those entirely.

Step 1 — Plan the distribution
For each brand, decide how many products go in each file based on what that brand actually sells. Example logic:

Jeans brands (Wrangler, Levi's) → heavy on bottoms
Leather outerwear brands (Deadwood, The Arrivals) → heavy on outerwear
Accessories-only brands (Resistol hats) → put everything in accessories
Lifestyle brands → spread evenly across tops/bottoms/outerwear/knitwear
Verify your plan adds up: existing count + tops + bottoms + outerwear + knitwear + accessories = 40

Step 2 — Run parallel agents per file
Launch one agent per file simultaneously (tops, bottoms, outerwear each get their own agent). Each agent writes only to its own file — no overlap, no conflicts.

Agent prompt structure:

You are appending products to src/data/products/[FILE].js.

Step 1: Read the last 20 lines of the file to find the exact closing anchor text.

Step 2: Write ALL products in ONE Edit call. Use the last product's unique closing text + \n\n]\n\nexport default [FILE]Products as old_string. The new_string is that same anchor + all new products + the closing export.

Product schema
Every field is required:


{
  id: 'brand-slug-descriptor',          // unique kebab-case, e.g. 'levis-501-indigo'
  name: 'Product Name',
  brand: 'Exact Brand Name',            // must match exactly, including apostrophes
  type: 'jeans',                        // see valid types per file below
  parentType: 'bottoms',                // must match the file
  color: 'indigo',
  colorHex: '#2A3A6A',
  priceRange: 'mid',                    // budget | mid | contemporary | premium | luxury
  description: 'Brand Product — one evocative sentence.',
  seasons: ['spring','fall'],           // spring | summer | fall | winter
  gender: 'unisex',                     // men | women | unisex
  styleWeights: { americana: 5, normcore: 4 },
  outfitCompanions: ['tshirt','boot'],
  shopUrl: 'https://brand.com/search?q=Product+Name',
  shopFallbackUrl: 'https://brand.com/category',
  googleQuery: 'Brand product descriptor keywords',
  gradient: 'linear-gradient(135deg,#darkHex,#lightHex)',
  emoji: '👖'
}
Valid styleWeights keys: vintage, minimalist, parisian, normcore, cleangirl, oldmoney, feminine, romantic, eclectic, preppy, americana, streetwear, avantgarde, kpop, sustainable, boho, gorpcore, athletic, luxury, rockchic, britpop, scandi — no others.

Valid types by file:

tops.js → tshirt, polo, shirt, blouse, top, tank, cami, bodysuit, sweatshirt, hoodie, longsleeve, henley, plain-tee, dress, jumpsuit, vest
bottoms.js → jeans, chinos, trouser, shorts, skirt, midi-skirt, mini-skirt, maxi-skirt, cargo, leggings, wide-leg, culotte, jogger
outerwear.js → jacket, coat, blazer, bomber, puffer, parka, vest, trench, anorak, raincoat, denim-jacket, leather-jacket, fleece, windbreaker, cape
knitwear.js → crewneck, turtleneck, vneck, cardigan, henley, pullover
accessories.js → hat, cap, bag, belt, scarf, sunglasses, wallet, hair
Key rules
Read before Edit — always read the file end before any Edit call or you'll get a "file has not been read" error.
One Edit per agent — generate all products first, then make a single Edit. Multiple edits to the same file risk anchor conflicts.
No worktree isolation — agents must work directly on the live files (isolation: 'worktree' starts from the last git commit, which may be missing unsaved changes).
ID prefixes are per-brand — e.g. levis-, mdutti-, vv-, buckmason-, taylors- (Taylor Stitch uses taylors-, not ts-).
Dresses use type: 'dress', parentType: 'tops' — they live in tops.js.
Verification
After all agents complete:


cd src/data/products && for brand in "Brand A" "Brand B"; do
  echo "$brand: $(grep -rh "brand: " *.js | grep -c "'$brand'")"
done
Each brand should read ≥ 40.