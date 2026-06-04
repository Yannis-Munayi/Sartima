export const CARE_SYMBOLS = [
  // --- Washing ---
  {
    id: 'wash-30',
    category: 'wash',
    abbreviation: '30°',
    label: 'Machine wash cold',
    description: 'Machine wash at 30°C (86°F) or below. Good for most everyday garments and delicate fabrics.',
  },
  {
    id: 'wash-40',
    category: 'wash',
    abbreviation: '40°',
    label: 'Machine wash warm',
    description: 'Machine wash at 40°C (104°F). Suitable for cottons, linens, and moderately soiled items.',
  },
  {
    id: 'wash-60',
    category: 'wash',
    abbreviation: '60°',
    label: 'Machine wash hot',
    description: 'Machine wash at 60°C (140°F). Best for heavily soiled whites and towels. May shrink or fade sensitive fabrics.',
  },
  {
    id: 'wash-gentle',
    category: 'wash',
    abbreviation: '≈30',
    label: 'Gentle / delicate cycle',
    description: 'Machine wash on a gentle or delicate cycle at low temperature. For fine fabrics like silk, wool, and lace.',
  },
  {
    id: 'wash-hand',
    category: 'wash',
    abbreviation: '✋',
    label: 'Hand wash only',
    description: 'Wash by hand in cool or lukewarm water. Do not machine wash. Squeeze gently — do not wring.',
  },
  {
    id: 'wash-no',
    category: 'wash',
    abbreviation: '✕W',
    label: 'Do not wash',
    description: 'Do not wash with water. Requires dry cleaning or spot cleaning only.',
  },

  // --- Drying ---
  {
    id: 'dry-tumble-low',
    category: 'dry',
    abbreviation: '○·',
    label: 'Tumble dry low',
    description: 'Tumble dry on low heat. Gentle on fabrics; good for most items that can be machine dried.',
  },
  {
    id: 'dry-tumble-medium',
    category: 'dry',
    abbreviation: '○··',
    label: 'Tumble dry medium',
    description: 'Tumble dry on medium heat. Suitable for cottons and more durable fabrics.',
  },
  {
    id: 'dry-tumble-no',
    category: 'dry',
    abbreviation: '✕○',
    label: 'Do not tumble dry',
    description: 'Do not put in the dryer. Lay flat or hang to dry instead. Dryer heat may shrink or damage the garment.',
  },
  {
    id: 'dry-flat',
    category: 'dry',
    abbreviation: '═',
    label: 'Dry flat',
    description: 'Lay the garment flat on a clean towel to dry. Prevents stretching — important for knitwear and wool.',
  },
  {
    id: 'dry-hang',
    category: 'dry',
    abbreviation: '↑',
    label: 'Hang to dry',
    description: 'Hang on a clothes hanger or line to air dry. Keep out of direct sunlight to prevent fading.',
  },

  // --- Ironing ---
  {
    id: 'iron-low',
    category: 'iron',
    abbreviation: '♨·',
    label: 'Iron low heat',
    description: 'Iron at low temperature (up to 110°C / 230°F). For synthetic fabrics like polyester and nylon.',
  },
  {
    id: 'iron-medium',
    category: 'iron',
    abbreviation: '♨··',
    label: 'Iron medium heat',
    description: 'Iron at medium temperature (up to 150°C / 300°F). Suitable for wool, silk, and polyester blends.',
  },
  {
    id: 'iron-high',
    category: 'iron',
    abbreviation: '♨···',
    label: 'Iron high heat',
    description: 'Iron at high temperature (up to 200°C / 390°F). For cotton and linen garments.',
  },
  {
    id: 'iron-steam-no',
    category: 'iron',
    abbreviation: '♨✕S',
    label: 'No steam',
    description: 'Iron without steam. Steam can damage certain fabrics like velvet, sequins, and some embellishments.',
  },
  {
    id: 'iron-no',
    category: 'iron',
    abbreviation: '✕♨',
    label: 'Do not iron',
    description: 'Do not apply heat directly to the fabric. Ironing may melt, scorch, or permanently damage the material.',
  },

  // --- Bleaching ---
  {
    id: 'bleach-ok',
    category: 'bleach',
    abbreviation: '△',
    label: 'Bleach allowed',
    description: 'Chlorine and non-chlorine bleach are both safe to use. Typically applies to white cotton items.',
  },
  {
    id: 'bleach-non-chlorine',
    category: 'bleach',
    abbreviation: '△·',
    label: 'Non-chlorine bleach',
    description: 'Only use non-chlorine (oxygen) bleach. Chlorine bleach will damage or discolour the fabric.',
  },
  {
    id: 'bleach-no',
    category: 'bleach',
    abbreviation: '✕△',
    label: 'Do not bleach',
    description: 'Do not use any bleach. The fabric or dye is sensitive and bleach will cause irreversible damage.',
  },

  // --- Dry Cleaning ---
  {
    id: 'dryclean-ok',
    category: 'dryclean',
    abbreviation: '◯P',
    label: 'Dry clean',
    description: 'Take to a professional dry cleaner. The garment cannot safely be washed with water.',
  },
  {
    id: 'dryclean-gentle',
    category: 'dryclean',
    abbreviation: '◯F',
    label: 'Dry clean — gentle',
    description: 'Dry clean using a gentle process. Fragile items that require extra care at the dry cleaners.',
  },
  {
    id: 'dryclean-petroleum',
    category: 'dryclean',
    abbreviation: '◯F·',
    label: 'Petroleum solvent only',
    description: 'Dry clean using petroleum-based solvent only. Inform the dry cleaner of this requirement.',
  },
  {
    id: 'dryclean-no',
    category: 'dryclean',
    abbreviation: '✕◯',
    label: 'Do not dry clean',
    description: 'Do not send to a dry cleaner. The solvents used in dry cleaning will damage this garment.',
  },
];

export const WASH_FREQUENCIES = [
  {
    id: 'after-each-wear',
    label: 'After each wear',
    description: 'e.g. gym clothes, underwear, socks',
    thresholdDays: 1,
  },
  {
    id: 'every-2-3-wears',
    label: 'Every 2–3 wears',
    description: 'e.g. t-shirts, blouses, everyday tops',
    thresholdDays: 3,
  },
  {
    id: 'every-4-5-wears',
    label: 'Every 4–5 wears',
    description: 'e.g. jeans, trousers, mid-layers',
    thresholdDays: 5,
  },
  {
    id: 'monthly',
    label: 'Monthly or less',
    description: 'e.g. outerwear, suits, formal wear',
    thresholdDays: 30,
  },
  {
    id: 'spot-clean-only',
    label: 'Spot clean only',
    description: 'e.g. leather, suede, embellished pieces',
    thresholdDays: null,
  },
];

export const WASH_FREQUENCY_DEFAULTS = {
  tops: 'every-2-3-wears',
  bottoms: 'every-4-5-wears',
  outerwear: 'monthly',
  dresses: 'every-2-3-wears',
  footwear: 'spot-clean-only',
  accessories: 'spot-clean-only',
};

export const STORAGE_DEFAULTS = {
  tops: 'fold',
  bottoms: 'fold',
  outerwear: 'hang',
  dresses: 'hang',
  footwear: 'fold',
  accessories: 'fold',
};

// Mutual exclusion rules: selecting any key in a group deselects the others in that group
export const SYMBOL_EXCLUSIONS = {
  'wash-no': ['wash-30', 'wash-40', 'wash-60', 'wash-gentle', 'wash-hand'],
  'wash-30': ['wash-no'],
  'wash-40': ['wash-no'],
  'wash-60': ['wash-no'],
  'wash-gentle': ['wash-no'],
  'wash-hand': ['wash-no'],
  'iron-no': ['iron-low', 'iron-medium', 'iron-high', 'iron-steam-no'],
  'iron-low': ['iron-no'],
  'iron-medium': ['iron-no'],
  'iron-high': ['iron-no'],
  'iron-steam-no': ['iron-no'],
  'bleach-no': ['bleach-ok', 'bleach-non-chlorine'],
  'bleach-ok': ['bleach-no', 'bleach-non-chlorine'],
  'bleach-non-chlorine': ['bleach-no', 'bleach-ok'],
  'dryclean-no': ['dryclean-ok', 'dryclean-gentle', 'dryclean-petroleum'],
  'dryclean-ok': ['dryclean-no'],
  'dryclean-gentle': ['dryclean-no'],
  'dryclean-petroleum': ['dryclean-no'],
};

export const SYMBOL_CATEGORY_LABELS = {
  wash: 'Washing',
  dry: 'Drying',
  iron: 'Ironing',
  bleach: 'Bleaching',
  dryclean: 'Dry Cleaning',
};

// Groups items by color string for laundry wash-together logic
export function inferColorGroup(colorStr) {
  if (!colorStr) return undefined;
  const c = colorStr.toLowerCase().trim();

  if (/\b(white|cream|ivory|off.white|ecru|eggshell)\b/.test(c)) return 'whites';
  if (/\b(black|charcoal|onyx|jet)\b/.test(c)) return 'darks';
  if (/\b(navy|dark\s*blue|dark\s*green|dark\s*brown|dark\s*red|dark\s*grey|dark\s*gray|burgundy|maroon|forest)\b/.test(c)) return 'darks';
  if (/\b(red|orange|yellow|bright|fuchsia|magenta|coral|hot\s*pink|lime|electric)\b/.test(c)) return 'brights';
  if (/\b(pink|lavender|lilac|mint|sage|peach|blush|powder|baby\s*blue|light|pale|pastel)\b/.test(c)) return 'lights';
  if (/\b(grey|gray|silver|beige|tan|khaki|camel|nude|taupe)\b/.test(c)) return 'lights';
  if (/\b(silk|satin|lace|mesh|chiffon|tulle|velvet|cashmere|embellish)\b/.test(c)) return 'delicates';

  return undefined;
}
