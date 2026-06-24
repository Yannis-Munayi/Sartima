// Brand discovery data — rich profiles for ~25 key brands across aesthetics.
// Each brand name must match the string used in products.js (product.brand field)
// and in styles.js (aesthetic.brands arrays).

export const BRANDS = {
  'ralph-lauren': {
    id: 'ralph-lauren',
    name: 'Ralph Lauren',
    founded: 1967,
    origin: 'New York, USA',
    aesthetics: ['oldmoney', 'preppy', 'darkacademia', 'lightacademia'],
    positioning: 'luxury',
    tagline: 'A world built on American dreams.',
    story:
      'Ralph Lauren turned a tie collection into one of the most iconic fashion empires in the world. His vision of aspirational Americana — ivy league campuses, New England estates, Wyoming ranches — became a global language for effortless elegance. No brand has defined the "old money" aesthetic more completely.',
    lines: [
      { id: 'polo', name: 'Polo Ralph Lauren', tier: 'contemporary', desc: 'The everyday American classic — polos, chinos, cable knits, and stadium gear worn from campus to coast.' },
      { id: 'rrl', name: 'RRL', tier: 'premium', desc: 'Vintage-inspired Americana and workwear. Selvedge denim, western shirts, and rugged outerwear with an authentic aged patina.' },
      { id: 'purple-label', name: 'Purple Label', tier: 'luxury', desc: 'The bespoke pinnacle. Italian fabrics, English tailoring, and handmade construction — Ralph\'s answer to Savile Row.' },
      { id: 'rl-collection', name: 'Ralph Lauren Collection', tier: 'luxury', desc: 'Womenswear flagship. Silk gowns, refined suits, and eveningwear embodying quiet luxury at its most refined.' },
      { id: 'lauren', name: 'Lauren Ralph Lauren', tier: 'contemporary', desc: 'Accessible elegance for everyday dressing — polished separates, blazers, and sophisticated basics.' },
    ],
    currentCollections: [
      { name: 'Fall 2025', season: 'FW25', imageQuery: 'Ralph Lauren fall 2025 collection runway fashion editorial' },
    ],
    pastCollections: [
      { name: 'Safari Collection', year: 1984, desc: 'Defined the luxury safari aesthetic globally — khaki jodhpurs, linen shirts, leather boots. Still referenced today.' },
      { name: 'Rugby Collection', year: 2004, desc: 'Collegiate-prep at its peak. The Rugby sub-brand became a cult classic for Ivy League dressing before its 2013 closure.' },
      { name: 'Western Collection', year: 1978, desc: 'Ralph reimagined the American frontier through fringed suede, turquoise jewelry, and concho belts. Changed Western fashion forever.' },
    ],
    keyPieces: ['Polo shirt', 'Cable-knit sweater', 'Harrington jacket', 'Oxford button-down', 'Chino trousers'],
    relatedBrands: ['brooks-brothers', 'j-crew', 'vineyard-vines'],
    imageQuery: 'Ralph Lauren store campaign fashion editorial luxury',
  },

  'brooks-brothers': {
    id: 'brooks-brothers',
    name: 'Brooks Brothers',
    founded: 1818,
    origin: 'New York, USA',
    aesthetics: ['oldmoney', 'preppy', 'businesscasual'],
    positioning: 'premium',
    tagline: 'The original American clothier.',
    story:
      'The oldest clothing retailer in America, Brooks Brothers has dressed 40 of 46 U.S. presidents and invented the button-down collar in 1896. It\'s the definitive source for sack-suit America — understated, institutional, and endlessly copied but never quite matched.',
    lines: [
      { id: 'golden-fleece', name: 'Golden Fleece', tier: 'luxury', desc: 'The made-to-measure and premium line — English and Italian fabrics, handmade construction, for those who want the best of Brooks.' },
      { id: 'black-fleece', name: 'Black Fleece', tier: 'premium', desc: 'The collaboration with Thom Browne that ran 2007–2015. Mini-me proportions on classic American pieces, now a collector\'s item.' },
      { id: 'bb-sport', name: 'Brooks Brothers Sport', tier: 'contemporary', desc: 'Performance fabrics in classic silhouettes — the country club to golf course pipeline.' },
    ],
    currentCollections: [
      { name: 'Fall 2025', season: 'FW25', imageQuery: 'Brooks Brothers fall 2025 collection editorial menswear' },
    ],
    pastCollections: [
      { name: 'Sack Suit Era', year: 1895, desc: 'The three-button, natural-shoulder sack suit that became the uniform of American professional life for over a century.' },
      { name: 'OCBD Invention', year: 1896, desc: 'The Oxford Cloth Button-Down — invented at Brooks Brothers, now the most-copied shirt in menswear history.' },
    ],
    keyPieces: ['Oxford cloth button-down', 'Seersucker suit', 'Repp stripe tie', 'Navy blazer', 'Madras shorts'],
    relatedBrands: ['ralph-lauren', 'j-crew'],
    imageQuery: 'Brooks Brothers store heritage American menswear editorial',
  },

  'j-crew': {
    id: 'j-crew',
    name: 'J.Crew',
    founded: 1983,
    origin: 'New York, USA',
    aesthetics: ['preppy', 'oldmoney', 'lightacademia', 'normcore'],
    positioning: 'contemporary',
    tagline: 'American style, perfected.',
    story:
      'J.Crew turned preppy essentials into a modern wardrobe language. Under Jenna Lyons in the 2010s, it redefined American casual-cool by mixing sequins with jeans and chambray with tweed. The Ludlow suit made tailoring accessible. Now in a renaissance, J.Crew remains the brand that makes classics feel fresh.',
    lines: [
      { id: 'jcrew-main', name: 'J.Crew', tier: 'contemporary', desc: 'The core line — button-downs, chinos, striped tees, and the famous Ludlow suits at accessible price points.' },
      { id: 'jcrew-factory', name: 'J.Crew Factory', tier: 'value', desc: 'Simplified versions of core styles at lower prices — the entry point to the J.Crew universe.' },
      { id: 'madewell', name: 'Madewell', tier: 'contemporary', desc: 'J.Crew\'s denim-focused sister brand. Relaxed, worn-in, and beloved for jeans and Americana staples.' },
    ],
    currentCollections: [
      { name: 'Fall 2025', season: 'FW25', imageQuery: 'J.Crew fall 2025 collection editorial fashion lookbook' },
    ],
    pastCollections: [
      { name: 'Jenna Lyons Era', year: 2010, desc: 'The decade when J.Crew became a cultural touchstone — sequin skirts with flip-flops, mixed prints, and celebrity endorsement from Michelle Obama.' },
    ],
    keyPieces: ['Ludlow suit', 'Rollneck sweater', 'Perfect fit shirt', 'Chino pants', 'Field jacket'],
    relatedBrands: ['ralph-lauren', 'vineyard-vines'],
    imageQuery: 'J.Crew lookbook editorial preppy americana fashion',
  },

  'vineyard-vines': {
    id: 'vineyard-vines',
    name: 'Vineyard Vines',
    founded: 1998,
    origin: 'Martha\'s Vineyard, USA',
    aesthetics: ['preppy'],
    positioning: 'contemporary',
    tagline: 'Every day should feel this good.',
    story:
      'Founded by brothers Shep and Ian Murray who quit their New York jobs to make ties on Martha\'s Vineyard. The brand grew into the definitive symbol of east-coast prep culture — colorful prints, the smiling whale logo, and a relentless optimism baked into every piece.',
    lines: [
      { id: 'vv-main', name: 'Vineyard Vines', tier: 'contemporary', desc: 'The core collection — colorful quarter-zips, whale-print shorts, and everything for a day on the water or at the club.' },
      { id: 'vv-sport', name: 'Vineyard Vines Sport', tier: 'contemporary', desc: 'Performance fabrics with the same preppy DNA. From the golf course to the yacht.' },
    ],
    currentCollections: [
      { name: 'Summer 2025', season: 'SS25', imageQuery: 'Vineyard Vines summer 2025 collection preppy fashion editorial' },
    ],
    pastCollections: [
      { name: 'Collegiate Collection', year: 2005, desc: 'The first major collegiate licensing deals — team-branded whale gear that cemented VV as campus staple.' },
    ],
    keyPieces: ['Shep shirt', 'Classic quarter-zip', 'Whale logo cap', 'Printed swim trunks', 'Harbor pants'],
    relatedBrands: ['ralph-lauren', 'j-crew'],
    imageQuery: 'Vineyard Vines preppy summer fashion editorial nautical',
  },

  'cos': {
    id: 'cos',
    name: 'COS',
    founded: 2007,
    origin: 'London, UK (H&M Group)',
    aesthetics: ['minimalist', 'scandi', 'darkacademia'],
    positioning: 'contemporary',
    tagline: 'Modern, functional, considered.',
    story:
      'Collection of Style (COS) was H&M\'s answer to the growing appetite for functional minimalism. Inspired by art and architecture, each piece is designed to be wardrobe infrastructure — quietly striking, built to last, and free from trend. The brand that proved minimalism didn\'t need a luxury price tag.',
    lines: [
      { id: 'cos-main', name: 'COS', tier: 'contemporary', desc: 'The full collection — architectural basics, precisely cut outerwear, and wardrobe staples designed to work together indefinitely.' },
    ],
    currentCollections: [
      { name: 'Fall 2025', season: 'FW25', imageQuery: 'COS collection fall 2025 minimalist editorial architecture fashion' },
    ],
    pastCollections: [
      { name: 'COS x Serpentine', year: 2013, desc: 'Partnership with the Serpentine Galleries — art installations and garments blurring the line between fashion and sculpture.' },
    ],
    keyPieces: ['Oversized wool coat', 'Structured blazer', 'Wide-leg trousers', 'Cotton turtleneck', 'Relaxed linen shirt'],
    relatedBrands: ['arket', 'uniqlo', 'apc'],
    imageQuery: 'COS minimalist fashion editorial architectural clothing collection',
  },

  'arket': {
    id: 'arket',
    name: 'Arket',
    founded: 2017,
    origin: 'Stockholm, Sweden (H&M Group)',
    aesthetics: ['minimalist', 'scandi', 'normcore'],
    positioning: 'contemporary',
    tagline: 'A modern market. Quality above quantity.',
    story:
      'Arket takes its name from the Swedish word for "sheet of paper" — blank, purposeful, clean. Conceived as a modern Nordic market offering clothing, food, and homeware, Arket is designed around durability and considered living. Its pieces have the feel of heirlooms at mid-market prices.',
    lines: [
      { id: 'arket-main', name: 'Arket', tier: 'contemporary', desc: 'Clean Scandi essentials — durable basics, considered cuts, and a palette that lives somewhere between cream and charcoal.' },
    ],
    currentCollections: [
      { name: 'Fall 2025', season: 'FW25', imageQuery: 'Arket fall 2025 collection Scandinavian minimalist fashion editorial' },
    ],
    pastCollections: [
      { name: 'Archive Essentials', year: 2019, desc: 'A restocking of original launch pieces that sold out — validated Arket\'s approach of buying fewer, better things.' },
    ],
    keyPieces: ['Merino crew-neck', 'Heavy canvas jacket', 'Straight-leg jeans', 'Oxford shirt', 'Chunky knit cardigan'],
    relatedBrands: ['cos', 'uniqlo'],
    imageQuery: 'Arket Scandinavian fashion editorial minimal clean aesthetic lookbook',
  },

  'uniqlo': {
    id: 'uniqlo',
    name: 'Uniqlo',
    founded: 1984,
    origin: 'Yamaguchi, Japan',
    aesthetics: ['minimalist', 'normcore', 'scandi'],
    positioning: 'value',
    tagline: 'Made for all.',
    story:
      'Uniqlo redefined the relationship between price and quality in everyday fashion. The brand\'s obsession with fabric technology (HEATTECH, AIRism, Lifewear) and design collaborations (Jil Sander\'s +J, Lemaire, White Mountaineering) makes it the most democratic minimalist brand on earth. The go-to for anyone who wants to build a clean, functional wardrobe without spending a fortune.',
    lines: [
      { id: 'uniqlo-main', name: 'Uniqlo', tier: 'value', desc: 'Core Lifewear — the essentials that underpin every wardrobe. Exceptional fabric technology at democratic prices.' },
      { id: 'uniqlo-u', name: 'Uniqlo U', tier: 'contemporary', desc: 'Creative director Christophe Lemaire\'s seasonal interpretation of Uniqlo basics — elevated, architectural, wearable.' },
    ],
    currentCollections: [
      { name: 'Fall 2025 Uniqlo U', season: 'FW25', imageQuery: 'Uniqlo U fall 2025 Lemaire collection editorial fashion' },
    ],
    pastCollections: [
      { name: '+J by Jil Sander', year: 2009, desc: 'The legendary collaboration that proved high fashion could live at low prices. Ten seasons of restrained, precise design.' },
    ],
    keyPieces: ['HEATTECH base layer', 'Flannel shirt', 'Ultra Light Down jacket', 'Merino mock-neck', 'Wide-leg trousers'],
    relatedBrands: ['cos', 'arket'],
    imageQuery: 'Uniqlo minimalist lookbook editorial fashion Lifewear clean',
  },

  'apc': {
    id: 'apc',
    name: 'A.P.C.',
    founded: 1987,
    origin: 'Paris, France',
    aesthetics: ['minimalist', 'darkacademia', 'normcore', 'eurochic'],
    positioning: 'premium',
    tagline: 'Atelier de Production et de Création.',
    story:
      'Jean Touitou founded A.P.C. in 1987 as a reaction against the excess of 80s fashion. Raw selvedge denim, Breton stripes, and tote bags became the understated uniform of the cultural and intellectual class on both sides of the Atlantic. A.P.C. taught a generation what it meant to dress quietly and intentionally.',
    lines: [
      { id: 'apc-main', name: 'A.P.C.', tier: 'premium', desc: 'The full mainline — selvedge denim, French basics, outerwear, and the legendary New Standard jean that shaped the straight-leg revival.' },
      { id: 'apc-accessories', name: 'A.P.C. Accessories', tier: 'premium', desc: 'Minimal leather goods — the Half Moon bag, wallets, and belts made to last a lifetime.' },
    ],
    currentCollections: [
      { name: 'Fall 2025', season: 'FW25', imageQuery: 'APC Paris fall 2025 collection editorial minimalist fashion' },
    ],
    pastCollections: [
      { name: 'New Standard Denim', year: 1987, desc: 'The original raw selvedge jean that started it all — unchanged for 35 years, still the gold standard for minimalist denim.' },
      { name: 'A.P.C. x Kanye', year: 2013, desc: 'The collaboration that brought A.P.C. to a new generation — plain hoodies and tees that sold out instantly.' },
    ],
    keyPieces: ['New Standard jeans', 'Breton stripe tee', 'New Shopping tote', 'Wool peacoat', 'Snap cardigan'],
    relatedBrands: ['cos', 'acne-studios'],
    imageQuery: 'APC Paris minimalist French fashion editorial lookbook',
  },

  'acne-studios': {
    id: 'acne-studios',
    name: 'Acne Studios',
    founded: 1996,
    origin: 'Stockholm, Sweden',
    aesthetics: ['minimalist', 'scandi', 'indie', 'darkacademia'],
    positioning: 'luxury',
    tagline: 'Ambivalent Classic.',
    story:
      'Acne Studios began as a creative collective making 100 pairs of raw-denim jeans for friends and colleagues. Today it\'s one of Scandinavia\'s most influential luxury brands — cerebral, directional, and consistently surprising. The scarf that launched a thousand memes. The denim that defined a decade. A brand you discover and never really leave.',
    lines: [
      { id: 'acne-main', name: 'Acne Studios', tier: 'luxury', desc: 'The full collection — knitwear, denim, tailoring, and outerwear designed to feel both classic and slightly wrong-footed.' },
    ],
    currentCollections: [
      { name: 'Fall 2025', season: 'FW25', imageQuery: 'Acne Studios fall 2025 runway collection editorial fashion' },
    ],
    pastCollections: [
      { name: 'Musubi Knot Bag', year: 2019, desc: 'The knotted leather bag that became an instant icon — simple, sculptural, and immediately recognizable.' },
      { name: 'Face Logo Era', year: 2017, desc: 'The grinning face motif on hoodies and tees that became one of the decade\'s most memed luxury pieces.' },
    ],
    keyPieces: ['Oversized scarf', 'Face logo hoodie', 'Raw denim jeans', 'Distressed knit', 'Long wool coat'],
    relatedBrands: ['cos', 'apc'],
    imageQuery: 'Acne Studios editorial fashion lookbook Scandinavian luxury',
  },

  'supreme': {
    id: 'supreme',
    name: 'Supreme',
    founded: 1994,
    origin: 'New York, USA',
    aesthetics: ['streetwear', 'skater', 'hiphop'],
    positioning: 'streetwear',
    tagline: 'The original downtown cool.',
    story:
      'James Jebbia opened Supreme on Lafayette Street in 1994, designed around skaters. The brand pioneered the drop model before anyone called it that — limited quantities, weekly releases, queues around the block. Supreme turned a red box logo into one of the most valuable marks in fashion history, collaborating with Louis Vuitton, Nike, Levi\'s, and The North Face.',
    lines: [
      { id: 'supreme-main', name: 'Supreme', tier: 'streetwear', desc: 'Weekly drops of tees, hoodies, accessories, and hard goods — the original hype machine.' },
      { id: 'supreme-collab', name: 'Supreme Collaborations', tier: 'streetwear', desc: 'Season-defining collabs with Nike, The North Face, Louis Vuitton, and beyond — each one a cultural event.' },
    ],
    currentCollections: [
      { name: 'Fall 2025 Drop', season: 'FW25', imageQuery: 'Supreme fall 2025 drop collection streetwear fashion' },
    ],
    pastCollections: [
      { name: 'Supreme x Louis Vuitton', year: 2017, desc: 'The most talked-about collaboration in fashion history — the box logo meets the monogram. Changed how luxury brands think about streetwear.' },
      { name: 'Supreme x The North Face', year: 2007, desc: 'The long-running collaboration that defined the intersection of outdoor gear and street culture.' },
    ],
    keyPieces: ['Box logo tee', 'Box logo hoodie', 'Camp cap', '5-panel cap', 'Work jacket'],
    relatedBrands: ['stussy', 'palace', 'carhartt-wip'],
    imageQuery: 'Supreme box logo streetwear fashion drop editorial',
  },

  'stussy': {
    id: 'stussy',
    name: 'Stüssy',
    founded: 1980,
    origin: 'Laguna Beach, USA',
    aesthetics: ['streetwear', 'skater', 'surfer'],
    positioning: 'streetwear',
    tagline: 'The original tribe.',
    story:
      'Shawn Stussy started selling surfboards and stamping his distinctive signature on T-shirts. Forty years later, Stüssy is the godfather of streetwear — the original brand that brought together surfers, skaters, hip-hop heads, and ravers under one roof. Chapter stores in Tokyo, New York, and London. Collaborations that consistently break the internet.',
    lines: [
      { id: 'stussy-main', name: 'Stüssy', tier: 'streetwear', desc: 'The core collection — logo tees, shorts, caps, and seasonal pieces that define downtown cool across generations.' },
      { id: 'stussy-intl', name: 'Stüssy International', tier: 'streetwear', desc: 'Chapter-exclusive and global collaborative pieces — some of the most sought-after items in streetwear.' },
    ],
    currentCollections: [
      { name: 'Fall 2025', season: 'FW25', imageQuery: 'Stussy fall 2025 collection streetwear editorial fashion' },
    ],
    pastCollections: [
      { name: 'Stüssy x Dior', year: 2020, desc: 'The collaboration that announced streetwear\'s full integration into the luxury fashion system.' },
      { name: 'World Tour Collection', year: 1994, desc: 'The original chapter tee — city names from New York to Tokyo that launched the streetwear globe-trotting aesthetic.' },
    ],
    keyPieces: ['Stock logo tee', 'Mesh jersey', 'Nylon shorts', '8-ball fleece', 'Chapter store cap'],
    relatedBrands: ['supreme', 'palace', 'carhartt-wip'],
    imageQuery: 'Stussy streetwear fashion editorial lookbook chapter store',
  },

  'carhartt-wip': {
    id: 'carhartt-wip',
    name: 'Carhartt WIP',
    founded: 1994,
    origin: 'Antwerp, Belgium (licensed from Carhartt USA)',
    aesthetics: ['streetwear', 'gorpcore', 'workwear', 'skater'],
    positioning: 'contemporary',
    tagline: 'Work in progress.',
    story:
      'Edwin Faeh licensed Carhartt\'s workwear silhouettes for Europe and transformed them into streetwear staples without changing very much at all. The Michigan Chore coat, the Sid pant, the Watch cap — these are genuine workwear pieces worn by genuine people. Carhartt WIP\'s genius was understanding that authenticity is a design choice.',
    lines: [
      { id: 'wip-main', name: 'Carhartt WIP', tier: 'contemporary', desc: 'The core line — updated workwear silhouettes in premium fabrics. The chore coat. The Detroit jacket. Perennial.' },
      { id: 'wip-collab', name: 'WIP Collaborations', tier: 'contemporary', desc: 'Annual collabs with Palace, Brain Dead, Vans, Awake NY, and beyond — always thoughtful, always in demand.' },
    ],
    currentCollections: [
      { name: 'Fall 2025', season: 'FW25', imageQuery: 'Carhartt WIP fall 2025 collection workwear streetwear editorial' },
    ],
    pastCollections: [
      { name: 'WIP x A.P.C.', year: 2016, desc: 'Workwear meets Parisian minimalism — one of the most unexpectedly perfect crossovers in streetwear.' },
    ],
    keyPieces: ['Michigan Chore coat', 'Detroit jacket', 'Sid pant', 'Watch cap', 'Watch flannel shirt'],
    relatedBrands: ['stussy', 'supreme', 'dickies'],
    imageQuery: 'Carhartt WIP workwear streetwear editorial fashion lookbook',
  },

  'nike': {
    id: 'nike',
    name: 'Nike',
    founded: 1964,
    origin: 'Beaverton, Oregon, USA',
    aesthetics: ['streetwear', 'athleisure', 'gorpcore'],
    positioning: 'contemporary',
    tagline: 'Just Do It.',
    story:
      'From a handshake deal at a track meet to the most valuable sports brand on earth. Nike\'s collision with fashion culture through Jordan Brand, Sacai, Supreme, Travis Scott, and Off-White turned sneakers into a medium for culture. The Swoosh is the most recognized logo in the world — and still somehow fresh.',
    lines: [
      { id: 'nike-sportswear', name: 'Nike Sportswear', tier: 'contemporary', desc: 'The lifestyle arm — Air Force 1s, Tech Fleece, and the classics worn off the court. The daily driver.' },
      { id: 'jordan', name: 'Jordan Brand', tier: 'premium', desc: 'Michael Jordan\'s legacy in shoe and apparel form. The 1s through 11s define sneaker culture.' },
      { id: 'nike-acg', name: 'Nike ACG', tier: 'premium', desc: 'All Conditions Gear — technical outdoor performance wear that gorpcore and streetwear have both claimed.' },
      { id: 'nike-collab', name: 'Nike Collaborations', tier: 'luxury', desc: 'Travis Scott, Sacai, Off-White, Comme des Garçons — partnerships that define the sneaker era.' },
    ],
    currentCollections: [
      { name: 'Fall 2025', season: 'FW25', imageQuery: 'Nike fall 2025 sneakers apparel collection fashion editorial' },
    ],
    pastCollections: [
      { name: 'Air Jordan 1 Original', year: 1985, desc: 'Banned by the NBA for breaking uniform rules. The shoe that started sneaker culture as we know it.' },
      { name: 'Off-White x Nike "The Ten"', year: 2017, desc: 'Virgil Abloh\'s deconstruction of 10 Nike classics — the most influential sneaker collection of the decade.' },
    ],
    keyPieces: ['Air Force 1', 'Air Jordan 1', 'Tech Fleece set', 'Dunk Low', 'Trail runners'],
    relatedBrands: ['adidas', 'new-balance'],
    imageQuery: 'Nike fashion streetwear editorial sneakers lookbook culture',
  },

  'adidas': {
    id: 'adidas',
    name: 'Adidas',
    founded: 1949,
    origin: 'Herzogenaurach, Germany',
    aesthetics: ['streetwear', 'athleisure', 'y2k'],
    positioning: 'contemporary',
    tagline: 'Impossible is nothing.',
    story:
      'Adidas gave the world the Superstar, the Stan Smith, the Forum, and the Samba — four silhouettes that have never gone out of style. Its collaboration history runs from Run-DMC to Pharrell to Ye to Prada. Three stripes appear on the pitch, on the runway, and in every street photograph from Tokyo to São Paulo.',
    lines: [
      { id: 'adidas-originals', name: 'Adidas Originals', tier: 'contemporary', desc: 'Archive re-issues and lifestyle pieces rooted in the brand\'s sporting heritage. The Samba. The Gazelle. The Terrace scene.' },
      { id: 'adidas-sport', name: 'Adidas Sport', tier: 'contemporary', desc: 'Performance gear engineered for elite athletes — worn by the world\'s fastest, strongest, and highest-jumping.' },
      { id: 'yzy', name: 'Yeezy (archive)', tier: 'premium', desc: 'The Ye era — the Boost 350, 700, Foam Runner and apparel that moved from grail to ubiquitous and back to grail again.' },
    ],
    currentCollections: [
      { name: 'Fall 2025', season: 'FW25', imageQuery: 'Adidas fall 2025 collection Originals streetwear editorial fashion' },
    ],
    pastCollections: [
      { name: 'Run-DMC "My Adidas"', year: 1986, desc: 'The moment hip-hop and sportswear became permanently intertwined. Three stripes without laces, on stage at Madison Square Garden.' },
      { name: 'Adidas x Prada', year: 2019, desc: 'The Forum shoe reinvented in Prada leather — high fashion meets athletic heritage.' },
    ],
    keyPieces: ['Samba', 'Gazelle', 'Stan Smith', 'Superstar', 'Forum Low'],
    relatedBrands: ['nike', 'new-balance'],
    imageQuery: 'Adidas Originals fashion editorial streetwear Samba lookbook',
  },

  'new-balance': {
    id: 'new-balance',
    name: 'New Balance',
    founded: 1906,
    origin: 'Boston, Massachusetts, USA',
    aesthetics: ['gorpcore', 'normcore', 'streetwear', 'preppy'],
    positioning: 'contemporary',
    tagline: 'Fearlessly independent.',
    story:
      'For most of its history New Balance was the dad shoe. Then the internet noticed, and "dad shoe" became a compliment. The 990, the 550, the 574 — chunky, American-made, and suddenly everywhere from Paris runways to TikTok feeds. Collaborations with Aimé Leon Dore redefined the brand entirely.',
    lines: [
      { id: 'nb-made-in-usa', name: 'Made in USA', tier: 'premium', desc: 'The 990 series — still manufactured in New England. A genuine premium American sneaker with four decades of continuous production.' },
      { id: 'nb-numeric', name: 'NB Numeric', tier: 'contemporary', desc: 'The skateboarding line — functional, vulcanized, and endorsed by the world\'s best skaters.' },
      { id: 'nb-collab', name: 'Collaborations', tier: 'luxury', desc: 'Aimé Leon Dore, Joe Freshgoods, Teddy Santis — the collabs that built the cult.' },
    ],
    currentCollections: [
      { name: 'Fall 2025', season: 'FW25', imageQuery: 'New Balance fall 2025 sneakers editorial fashion lookbook' },
    ],
    pastCollections: [
      { name: 'ALD x New Balance 550', year: 2020, desc: 'The basketball retro that launched a thousand colorways and made "2020 New Balance" a cultural reference.' },
    ],
    keyPieces: ['990v6', '550', '574', '327', 'Numeric 480'],
    relatedBrands: ['nike', 'adidas'],
    imageQuery: 'New Balance fashion editorial sneakers gorpcore prep lookbook',
  },

  'patagonia': {
    id: 'patagonia',
    name: 'Patagonia',
    founded: 1973,
    origin: 'Ventura, California, USA',
    aesthetics: ['gorpcore', 'athleisure', 'normcore'],
    positioning: 'premium',
    tagline: 'We\'re in business to save our home planet.',
    story:
      'Yvon Chouinard built Patagonia around a radical idea: that a clothing company could be an activist. Recycled materials, fair trade manufacturing, 1% for the Planet, and the "Don\'t buy this jacket" campaign. The Synchilla fleece and the Retro-X became the unofficial uniform of the gorpcore movement, worn by people who have never seen a mountain.',
    lines: [
      { id: 'patagonia-outdoor', name: 'Outdoor Performance', tier: 'premium', desc: 'Technical climbing, skiing, and hiking gear — the original purpose of everything Patagonia makes.' },
      { id: 'patagonia-lifestyle', name: 'Patagonia Provisions / Everyday', tier: 'contemporary', desc: 'Fleeces, flannels, and casual wear for life outside the office. The gorpcore canon.' },
    ],
    currentCollections: [
      { name: 'Fall 2025', season: 'FW25', imageQuery: 'Patagonia fall 2025 collection outdoor gorpcore editorial fashion' },
    ],
    pastCollections: [
      { name: 'Synchilla Fleece', year: 1985, desc: 'The original technical fleece that became the gorpcore uniform forty years later. Nothing has changed.' },
    ],
    keyPieces: ['Retro-X fleece', 'Synchilla snap-t', 'Baggies shorts', 'Torrentshell jacket', 'Nano Puff'],
    relatedBrands: ['arcteryx', 'the-north-face'],
    imageQuery: 'Patagonia outdoor gorpcore fashion editorial mountain lifestyle',
  },

  'arcteryx': {
    id: 'arcteryx',
    name: "Arc'teryx",
    founded: 1989,
    origin: 'North Vancouver, Canada',
    aesthetics: ['gorpcore', 'techwear'],
    positioning: 'luxury',
    tagline: 'Design. Simplify. Evolve.',
    story:
      'Named after the first dinosaur to develop feathers, Arc\'teryx builds gear for alpinists and mountaineers that happens to be the most coveted outerwear in urban fashion. The Atom LT, the Beta AR, the Covert Cardigan — technical masterpieces adopted by the gorpcore and techwear crowds as luxury status symbols.',
    lines: [
      { id: 'arcteryx-outdoor', name: "Arc'teryx Outdoor", tier: 'luxury', desc: 'Gore-Tex shells, insulation, and technical mountaineering gear — among the best made in the world.' },
      { id: 'veilance', name: "Arc'teryx Veilance", tier: 'luxury', desc: 'The urban design sub-label. Minimal tailored outerwear using technical fabrics — techwear for the boardroom.' },
    ],
    currentCollections: [
      { name: 'Fall 2025', season: 'FW25', imageQuery: 'Arcteryx fall 2025 collection technical outdoor gorpcore fashion editorial' },
    ],
    pastCollections: [
      { name: 'Beta AR "Icon" colorways', year: 2010, desc: 'The collection of Beta ARs in cardinal, graphite, and black that made Arc\'teryx a streetwear grail.' },
    ],
    keyPieces: ['Beta AR jacket', 'Atom LT hoody', 'Covert Cardigan', 'Gamma pants', 'Nuclei FL vest'],
    relatedBrands: ['patagonia', 'the-north-face'],
    imageQuery: 'Arcteryx technical outdoor fashion editorial gorpcore urban',
  },

  'the-north-face': {
    id: 'the-north-face',
    name: 'The North Face',
    founded: 1966,
    origin: 'San Francisco, California, USA',
    aesthetics: ['gorpcore', 'streetwear'],
    positioning: 'contemporary',
    tagline: 'Never stop exploring.',
    story:
      'Founded in San Francisco as a mountaineering equipment retailer, The North Face built its reputation on Himalayan expeditions and Antarctic crossings. Its Nuptse puffer became a 90s icon, worn from Brixton to Brooklyn. Supreme, Palace, and Sacai collaborations transformed it into a streetwear mainstay without abandoning its mountaineering credentials.',
    lines: [
      { id: 'tnf-outdoor', name: 'The North Face Sport', tier: 'premium', desc: 'Expedition-grade gear — the Summit Series that supplies the world\'s greatest mountaineers.' },
      { id: 'tnf-lifestyle', name: 'The North Face Lifestyle', tier: 'contemporary', desc: 'The 700, the Nuptse, the Fleece 100 — technical gear adopted wholesale by street and gorpcore culture.' },
      { id: 'tnf-collab', name: 'Collaborations', tier: 'premium', desc: 'Supreme, Palace, Gucci, Sacai — the collaborations that keep TNF culturally relevant every season.' },
    ],
    currentCollections: [
      { name: 'Fall 2025', season: 'FW25', imageQuery: 'The North Face fall 2025 collection outdoor gorpcore fashion editorial' },
    ],
    pastCollections: [
      { name: 'Nuptse 700 Fill', year: 1992, desc: 'The quilted puffer that defined a decade and keeps coming back every ten years as the "it" outerwear silhouette.' },
    ],
    keyPieces: ['Nuptse jacket', '1996 Retro Nuptse', 'Denali fleece', 'Mountain jacket', 'Base Camp duffel'],
    relatedBrands: ['patagonia', 'arcteryx'],
    imageQuery: 'The North Face gorpcore outdoor fashion editorial streetwear',
  },

  'stone-island': {
    id: 'stone-island',
    name: 'Stone Island',
    founded: 1982,
    origin: 'Ravarino, Italy',
    aesthetics: ['techwear', 'gorpcore', 'streetwear'],
    positioning: 'luxury',
    tagline: 'Research and experimentation.',
    story:
      'Massimo Osti founded Stone Island as a laboratory for fabric technology — dyeing, finishing, and engineering garments in ways no one had attempted. The compass badge became a symbol of belonging for British terrace culture, then Japanese fashion collectors, then global streetwear. Acquired by Moncler in 2020, Stone Island remains the most technically ambitious label in menswear.',
    lines: [
      { id: 'si-main', name: 'Stone Island', tier: 'luxury', desc: 'The core collection — garment-dyed jackets, technical outerwear, and knitwear built around fabric innovation.' },
      { id: 'si-shadow', name: 'Stone Island Shadow Project', tier: 'luxury', desc: 'The experimental capsule designed with Errolson Hugh — technical garments at the absolute frontier of construction.' },
    ],
    currentCollections: [
      { name: 'Fall 2025', season: 'FW25', imageQuery: 'Stone Island fall 2025 collection technical fashion editorial menswear' },
    ],
    pastCollections: [
      { name: 'Ice Jacket', year: 1989, desc: 'A jacket that changed color when exposed to cold. The most famous example of Stone Island\'s material experimentation.' },
      { name: 'Terrace Culture Boom', year: 1990, desc: 'The decade when Stone Island became the uniform of English football terraces — and one of the most copied badges in fashion.' },
    ],
    keyPieces: ['Garment-dyed jacket', 'Compass badge sweater', 'Overshirt', 'Nylon Metal jacket', 'T-shirt with badge'],
    relatedBrands: ['arcteryx', 'cp-company'],
    imageQuery: 'Stone Island fashion editorial technical menswear badge jacket',
  },

  'dr-martens': {
    id: 'dr-martens',
    name: 'Dr. Martens',
    founded: 1960,
    origin: 'Northamptonshire, UK',
    aesthetics: ['grunge', 'punk', 'goth', 'indie'],
    positioning: 'contemporary',
    tagline: 'With soles.',
    story:
      'Klaus Märtens designed the air-cushioned sole to help his injured foot. Bill Griggs licensed the patent and put it on the 1460 boot. Worn by factory workers, then punks, then goths, then Britpop kids, then every subculture since. The bouncing sole is the most democratic footwear in fashion — owned by both Pete Townshend and the Spice Girls.',
    lines: [
      { id: 'dm-classics', name: 'Dr. Martens Classics', tier: 'contemporary', desc: 'The 1460, the 1461, the Jadon — the boots and shoes that defined five decades of subculture.' },
      { id: 'dm-docs-vegan', name: 'Dr. Martens Vegan', tier: 'contemporary', desc: 'Leather-free versions of the classics using microfibre — the same silhouettes, built differently.' },
      { id: 'dm-made-in-england', name: 'Made in England', tier: 'premium', desc: 'Northamptonshire-made boots using traditional Goodyear welt construction and premium leather. Heirloom quality.' },
    ],
    currentCollections: [
      { name: 'Fall 2025', season: 'FW25', imageQuery: 'Dr Martens fall 2025 boots collection fashion editorial punk' },
    ],
    pastCollections: [
      { name: '1460 x Comme des Garçons', year: 2017, desc: 'The polka-dot 1460 that turned the workhorse boot into a high-fashion object.' },
    ],
    keyPieces: ['1460 boot', '1461 oxford', 'Jadon platform', 'Quad Retro boot', '2976 Chelsea boot'],
    relatedBrands: ['converse', 'vans'],
    imageQuery: 'Dr Martens boots fashion editorial punk grunge indie lookbook',
  },

  'burberry': {
    id: 'burberry',
    name: 'Burberry',
    founded: 1856,
    origin: 'Basingstoke, UK',
    aesthetics: ['oldmoney', 'darkacademia', 'businesscasual'],
    positioning: 'luxury',
    tagline: 'Open spaces. British heritage.',
    story:
      'Thomas Burberry invented gabardine fabric in 1879 and the trench coat followed. Worn in the trenches of World War I, the Antarctic by Shackleton, and every city in the world since. Under Riccardo Tisci and now Daniel Lee, Burberry is redefining British luxury for a new generation while the check pattern remains one of the most recognized motifs on earth.',
    lines: [
      { id: 'burberry-main', name: 'Burberry', tier: 'luxury', desc: 'The full mainline — trench coats, the nova check, tailoring, and accessories built around British heritage.' },
      { id: 'burberry-brit', name: 'Burberry Brit (archive)', tier: 'premium', desc: 'The discontinued secondary line that made Burberry accessible to a younger audience in the 2000s and 2010s.' },
    ],
    currentCollections: [
      { name: 'Fall 2025 Daniel Lee', season: 'FW25', imageQuery: 'Burberry Daniel Lee fall 2025 collection runway fashion editorial' },
    ],
    pastCollections: [
      { name: 'Christopher Bailey Era', year: 2001, desc: 'The 15-year tenure that rebuilt Burberry from staid heritage brand to modern luxury powerhouse.' },
      { name: 'Nova Check Accessories', year: 1924, desc: 'The haymarket check — originally used as lining, later becoming Burberry\'s most iconic surface.' },
    ],
    keyPieces: ['Trench coat', 'Check cashmere scarf', 'Heritage trench', 'TB monogram bag', 'Check shirt'],
    relatedBrands: ['ralph-lauren', 'brooks-brothers'],
    imageQuery: 'Burberry trench coat fashion editorial luxury British heritage',
  },

  'fear-of-god': {
    id: 'fear-of-god',
    name: 'Fear of God',
    founded: 2013,
    origin: 'Los Angeles, USA',
    aesthetics: ['streetwear', 'hiphop'],
    positioning: 'luxury',
    tagline: 'The luxury of everyday.',
    story:
      'Jerry Lorenzo founded Fear of God to make clothes he wanted to wear — luxurious basics, elevated sportswear, and a spiritual conviction baked into every piece. FOG Essentials democratized the aesthetic at lower price points. The brand\'s alignment with Adidas marked a new chapter in streetwear luxury. Church-adjacent, California-influenced, impossible to ignore.',
    lines: [
      { id: 'fog-main', name: 'Fear of God', tier: 'luxury', desc: 'The mainline — elevated loungewear, distressed denim, oversized tailoring, and the iconic seventh collection.' },
      { id: 'essentials', name: 'Essentials (FOG)', tier: 'contemporary', desc: 'The diffusion line — FOG\'s luxurious silhouettes at accessible prices. Grey sweatpants that feel aspirational.' },
      { id: 'fog-adidas', name: 'FOG x Adidas', tier: 'premium', desc: 'The ongoing partnership with Adidas — hoops-inspired footwear and apparel at the intersection of sport and luxury.' },
    ],
    currentCollections: [
      { name: 'Fall 2025', season: 'FW25', imageQuery: 'Fear of God fall 2025 collection luxury streetwear editorial fashion' },
    ],
    pastCollections: [
      { name: 'The Seventh Collection', year: 2018, desc: 'The collection that moved Fear of God from streetwear into the luxury conversation — tailoring, cashmere, and intentional restraint.' },
    ],
    keyPieces: ['Essentials hoodie', 'Lounge pants', 'Chelsea boot', 'Thermal long-sleeve', 'Seventh collection blazer'],
    relatedBrands: ['supreme', 'stussy'],
    imageQuery: 'Fear of God luxury streetwear Los Angeles fashion editorial',
  },

  'off-white': {
    id: 'off-white',
    name: 'Off-White',
    founded: 2013,
    origin: 'Milan, Italy',
    aesthetics: ['streetwear', 'hiphop', 'y2k'],
    positioning: 'luxury',
    tagline: 'Between black and white.',
    story:
      'Virgil Abloh founded Off-White as a bridge between streetwear and luxury — the quotation marks around ordinary objects, the diagonal stripes, the Helvetica labels. Every collaboration was a masterclass in cultural conversation. Abloh\'s passing in 2021 marked the end of an era, but Off-White continues under new creative direction, carrying the legacy of the most influential designer of his generation.',
    lines: [
      { id: 'ow-main', name: 'Off-White', tier: 'luxury', desc: 'The full collection — deconstructed fashion with streetwear DNA, industrial belts, and quotation mark graphics.' },
    ],
    currentCollections: [
      { name: 'Fall 2025', season: 'FW25', imageQuery: 'Off-White fall 2025 collection luxury streetwear fashion editorial runway' },
    ],
    pastCollections: [
      { name: '"The Ten" x Nike', year: 2017, desc: 'Ten deconstructed Nike classics that became the most influential sneaker release in modern history.' },
      { name: 'AW19 "Corporate Fashion Show"', year: 2019, desc: 'The show that reframed Off-White as a true luxury house — models in corporate attire, subverting power dressing.' },
    ],
    keyPieces: ['Industrial belt', 'Diagonal stripe hoodie', 'Out of Office sneaker', 'Arrow tee', 'Carabiner bag'],
    relatedBrands: ['supreme', 'fear-of-god', 'stussy'],
    imageQuery: 'Off-White Virgil Abloh luxury streetwear fashion editorial quotation marks',
  },

  'loro-piana': {
    id: 'loro-piana',
    name: 'Loro Piana',
    founded: 1924,
    origin: 'Quarona, Italy',
    aesthetics: ['oldmoney', 'minimalist'],
    positioning: 'luxury',
    tagline: 'The gift of kings.',
    story:
      'Loro Piana controls the rarest fibres in the world — baby cashmere from Hircus goats in Inner Mongolia, vicuña from the Andes, extra-fine merino from Australia. The brand is the definition of quiet luxury: no logos, no runway shows, just the world\'s finest materials made into understated, enduring garments. Acquired by LVMH in 2013, it remains the ultimate insider\'s luxury.',
    lines: [
      { id: 'lp-main', name: 'Loro Piana', tier: 'luxury', desc: 'The full collection — cashmere, vicuña, and merino in pieces designed to be owned forever. No logos necessary.' },
    ],
    currentCollections: [
      { name: 'Fall 2025', season: 'FW25', imageQuery: 'Loro Piana fall 2025 collection luxury cashmere fashion editorial' },
    ],
    pastCollections: [
      { name: 'Storm System Collection', year: 1989, desc: 'Loro Piana\'s proprietary waterproofing treatment applied to cashmere — the impossible made wearable.' },
    ],
    keyPieces: ['Baby cashmere turtleneck', 'Vicuña coat', 'Wish polo shirt', 'Weekend bag', 'Horsebit loafer'],
    relatedBrands: ['brunello-cucinelli', 'ralph-lauren'],
    imageQuery: 'Loro Piana luxury cashmere quiet luxury old money fashion editorial',
  },

  'brunello-cucinelli': {
    id: 'brunello-cucinelli',
    name: 'Brunello Cucinelli',
    founded: 1978,
    origin: 'Solomeo, Italy',
    aesthetics: ['oldmoney', 'minimalist'],
    positioning: 'luxury',
    tagline: 'Humanity and luxury.',
    story:
      'Brunello Cucinelli built his empire in a medieval hamlet in Umbria, dedicated to "humanistic capitalism" — fair wages, artisanal production, and beauty as a moral good. His cashmere sweaters sell for thousands; his business philosophy has been the subject of MBA case studies. The brand that the ultra-wealthy discovered when they got tired of logos.',
    lines: [
      { id: 'bc-main', name: 'Brunello Cucinelli', tier: 'luxury', desc: 'The complete collection — cashmere knitwear, tailoring, and sportswear made in Solomeo. The definition of quiet luxury.' },
    ],
    currentCollections: [
      { name: 'Fall 2025', season: 'FW25', imageQuery: 'Brunello Cucinelli fall 2025 collection luxury cashmere Italian fashion editorial' },
    ],
    pastCollections: [
      { name: 'Cashmere Color Story', year: 2000, desc: 'The first collection to fully embrace Cucinelli\'s earth-toned palette — greys, caramels, and sand that became the brand\'s visual language.' },
    ],
    keyPieces: ['Cashmere crewneck', 'Suede jacket', 'Loose tailored trousers', 'Cashmere turtleneck', 'Italian trainer'],
    relatedBrands: ['loro-piana', 'ralph-lauren'],
    imageQuery: 'Brunello Cucinelli luxury cashmere Italian fashion editorial quiet luxury',
  },
}

// Map from display brand name (as used in products.js) to brand ID
export const BRAND_NAME_TO_ID = {
  'Ralph Lauren':        'ralph-lauren',
  'Polo Ralph Lauren':   'ralph-lauren',
  'Brooks Brothers':     'brooks-brothers',
  'J.Crew':              'j-crew',
  'Vineyard Vines':      'vineyard-vines',
  'COS':                 'cos',
  'Arket':               'arket',
  'Uniqlo':              'uniqlo',
  'A.P.C.':              'apc',
  'Acne Studios':        'acne-studios',
  'Supreme':             'supreme',
  'Stüssy':              'stussy',
  'Carhartt WIP':        'carhartt-wip',
  'Nike':                'nike',
  'Adidas':              'adidas',
  'New Balance':         'new-balance',
  'Patagonia':           'patagonia',
  "Arc'teryx":          'arcteryx',
  'The North Face':      'the-north-face',
  'Stone Island':        'stone-island',
  'Dr. Martens':         'dr-martens',
  'Burberry':            'burberry',
  'Fear of God Essentials': 'fear-of-god',
  'Off-White':           'off-white',
  'Loro Piana':          'loro-piana',
  'Brunello Cucinelli':  'brunello-cucinelli',
}

export function getBrandById(id) {
  return BRANDS[id] ?? null
}

export function getBrandByName(name) {
  const id = BRAND_NAME_TO_ID[name]
  return id ? BRANDS[id] ?? null : null
}

export function getBrandsForAesthetic(aestheticId) {
  return Object.values(BRANDS).filter((b) => b.aesthetics.includes(aestheticId))
}
