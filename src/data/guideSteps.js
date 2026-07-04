// Per-tab guide content — one array per main tab, chained together for the
// full app tour. `tab` is the sole navigation source of truth (bare tab id,
// or 'aesthetic:{id}' / 'brand:{id}' to open a specific detail screen as a
// live example). `subTab` forces AestheticScreen/BrandScreen/DailyLookScreen
// into a specific internal sub-tab. `forcedQuery` pre-fills SearchScreen.
// `note` renders a small disclaimer (used for the pro-gated Outfits steps).

export const GUIDE_ORDER = ['home', 'explore', 'brands', 'quiz', 'search', 'daily', 'profile']

export const GUIDE_LABELS = {
  home:    'Home',
  explore: 'Aesthetics',
  brands:  'Brands',
  quiz:    'Discover',
  search:  'Search',
  daily:   'Outfits',
  profile: 'Profile',
}

export const GUIDES = {
  home: [
    {
      tab:   'home',
      title: 'Welcome to Sartima ✦',
      desc:  'Sartima is your personal style engine — discover your aesthetic identity, build a digital wardrobe, and get AI-powered daily outfit suggestions. This tour covers every key feature.',
    },
    {
      tab:   'home',
      title: 'Your Live Aesthetic Profile',
      desc:  'Once you start swiping, your Home screen shows a live breakdown of your top aesthetics — percentage bars that update with every swipe. Tap any bar to dive straight into that aesthetic. The more you rate, the sharper your results.',
    },
    {
      tab:   'home',
      title: 'Shop Scout 🛍️',
      desc:  'Tap the Shop Scout card on Home to get brand recommendations tailored to what you want to buy. Pick the clothing categories you\'re after, set a budget, and choose your priorities. Sartima matches you to the best brands to shop from. You\'ll also find Shop Scout as its own sub-tab inside Outfits.',
    },
  ],

  explore: [
    {
      tab:   'explore',
      title: 'Explore 51 Aesthetics 🔍',
      desc:  'The Aesthetics tab is the full library — all 51 styles from Old Money to Gorpcore, Cottagecore to Cyberpunk. Search by name or keyword. Use the filter chips to browse All, your 📌 Saved aesthetics, or 🔥 Popular picks.',
    },
    {
      tab:    'aesthetic:oldmoney',
      subTab: 'story',
      title:  'Inside an Aesthetic — Story',
      desc:   'Tap any aesthetic to open its full profile — we\'ll use Old Money as the example. The Story tab covers the cultural origin and vibe: where the aesthetic comes from and who wears it.',
    },
    {
      tab:    'aesthetic:oldmoney',
      subTab: 'items',
      title:  'Items',
      desc:   'The Items tab lists the essential pieces that define this aesthetic — the wardrobe building blocks, from key garments to signature accessories.',
    },
    {
      tab:    'aesthetic:oldmoney',
      subTab: 'looks',
      title:  'Looks',
      desc:   'The Looks tab shows complete styled outfits — full head-to-toe combinations so you can see exactly how the pieces come together.',
    },
    {
      tab:    'aesthetic:oldmoney',
      subTab: 'guide',
      title:  'Guide & Saving',
      desc:   'The Guide tab explains how to actually wear it — styling tips, dos and don\'ts, and where it works. Tap "+ Save tab" in the header to pin this aesthetic to your Home screen and your 📌 Saved filter.',
    },
  ],

  brands: [
    {
      tab:   'brands',
      title: 'Browse Brands',
      desc:  'The Brands tab is a curated directory of the labels behind every piece in the catalog. Search by name, or filter by positioning — Luxury, Premium, Contemporary, Streetwear, or Value.',
    },
    {
      tab:    'brand:ralph-lauren',
      subTab: 'story',
      title:  'Inside a Brand — Story',
      desc:   'Tap any brand to open its profile — we\'ll use Ralph Lauren as the example. The Story tab covers its founding, origin, and what it stands for.',
    },
    {
      tab:    'brand:ralph-lauren',
      subTab: 'lines',
      title:  'Lines',
      desc:   'The Lines tab breaks down the brand\'s different sub-labels and tiers, from everyday essentials to its most elevated collections.',
    },
    {
      tab:    'brand:ralph-lauren',
      subTab: 'collections',
      title:  'Collections',
      desc:   'The Collections tab highlights current and past seasonal collections — a look at the brand\'s design history.',
    },
    {
      tab:    'brand:ralph-lauren',
      subTab: 'shop',
      title:  'Shop',
      desc:   'The Shop tab shows every product from this brand in the Sartima catalog — tap the heart to like a piece, or Shop ↗ to buy it directly.',
    },
  ],

  quiz: [
    {
      tab:   'quiz',
      title: 'Swipe to Find Your Style',
      desc:  'The Discover tab is where it all starts. Swipe right ❤️ to like an item, left ✕ to skip. Every like trains your aesthetic profile in real time. Tap the 🤍 icon on any card to save a piece to your Wishlist without affecting your profile score.',
    },
  ],

  search: [
    {
      tab:   'search',
      title: 'Search the Catalog',
      desc:  'The Search tab lets you find anything in our catalog of thousands of products — search by brand, item type, or color. No idea where to start? Tap one of the suggested searches below the search bar.',
    },
    {
      tab:         'search',
      forcedQuery: 'Ralph Lauren',
      title:       'Live Results Example',
      desc:        'Here\'s a live example — searching "Ralph Lauren" pulls up every matching product in a scrollable grid. Tap any card to see it up close and shop it, or tap the heart to save it to your Liked items without leaving the page.',
    },
  ],

  daily: [
    {
      tab:    'daily',
      subTab: 'closet',
      title:  'My Closet',
      desc:   'The Closet sub-tab is your digital wardrobe. Tap the + button to add items — upload a photo (AI scans it and identifies each piece automatically) or search the product catalog by name or brand. Items are tagged with category, colour, season, and occasion.',
    },
    {
      tab:    'daily',
      subTab: 'liked',
      title:  'Liked',
      desc:   'The Liked sub-tab holds every item you\'ve hearted across the app — your personal taste archive, always one tap away.',
    },
    {
      tab:    'daily',
      subTab: 'scout',
      title:  'Shop Scout',
      desc:   'Shop Scout is also right here inside Outfits — the same guided capsule-wardrobe wizard from the Home card, so you don\'t have to leave this tab to find new pieces to buy.',
    },
    {
      tab:    'daily',
      subTab: 'today',
      title:  'Today\'s Outfit ✦',
      desc:   'The Today\'s Outfit sub-tab generates a fresh AI outfit for you daily. Choose whether to pull from your Closet, your Liked items, or both — then pick an occasion. The AI reads your local weather and selects pieces that work together.',
    },
    {
      tab:    'daily',
      subTab: 'outfits',
      title:  'My Outfits',
      desc:   'The My Outfits sub-tab lets you build named outfit boards — tap "+ New Board", pick pieces from your library, and save combinations as reusable lookbooks.',
    },
    {
      tab:    'daily',
      subTab: 'calendar',
      title:  'Calendar 🗓️',
      desc:   'The Calendar sub-tab lets you plan outfit combinations for specific dates on a monthly view — perfect for mapping out a whole week or event.',
      note:   'Pro feature — shown here as a preview.',
    },
    {
      tab:    'daily',
      subTab: 'trip',
      title:  'Trip Planner',
      desc:   'The Trip sub-tab generates a full packing list and daily outfit schedule for any destination — just enter where you\'re going and how many nights.',
      note:   'Pro feature — shown here as a preview.',
    },
    {
      tab:    'daily',
      subTab: 'laundry',
      title:  'Laundry',
      desc:   'The Laundry sub-tab is your care-label reference — quick washing and care guidance for the pieces in your closet, so nothing gets ruined in the wash.',
      note:   'Pro feature — shown here as a preview.',
    },
  ],

  profile: [
    {
      tab:   'profile',
      title: 'Profile & Style Evolution',
      desc:  'Your Profile shows your top aesthetics, your quiz history, and your Style Evolution — how your top aesthetic has shifted across quiz sessions over time.',
    },
    {
      tab:   'profile',
      title: 'Settings',
      desc:  'Tap the ⚙ gear icon to open Settings — set a gender preference (Men / Women / Both) to filter outfit photos across the whole app, switch between dark and light mode, and toggle whether the Discover tab appears in your navigation.',
    },
  ],
}
