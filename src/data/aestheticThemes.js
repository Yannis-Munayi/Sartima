// Adaptive aesthetic theming — maps each of the 51 aesthetics to one of a
// small set of theme "flavors". A flavor is applied as `data-aesthetic` on
// `:root` (mirroring the `data-theme` pattern) and drives the display font,
// accent palette and border radii via src/styles/aestheticThemes.css.

export const AESTHETIC_FLAVORS = {
  heritage:    { id: 'heritage',    label: 'Heritage' },     // Times New Roman, camel & navy
  collegiate:  { id: 'collegiate',  label: 'Collegiate' },   // Georgia, regatta navy
  serene:      { id: 'serene',      label: 'Serene' },       // clean sans, stone neutrals
  pop:         { id: 'pop',         label: 'Pop' },          // Trebuchet, hot pink
  street:      { id: 'street',      label: 'Street' },       // Impact, volt orange, sharp corners
  sport:       { id: 'sport',       label: 'Sport' },        // Verdana, electric blue
  mono:        { id: 'mono',        label: 'Mono' },         // monospace, terminal green
  underground: { id: 'underground', label: 'Underground' },  // typewriter, blood red
  academia:    { id: 'academia',    label: 'Academia' },     // Palatino, bottle green
  utility:     { id: 'utility',     label: 'Utility' },      // condensed sans, olive khaki
  romantic:    { id: 'romantic',    label: 'Romantic' },     // Cormorant, rose, soft corners
}

// Every STYLES id must appear here exactly once.
export const STYLE_TO_FLAVOR = {
  // heritage — quiet luxury, tailoring, refinement
  oldmoney:          'heritage',
  businesscasual:    'heritage',
  eurochic:          'heritage',
  royalcore:         'heritage',
  silksatin:         'heritage',
  // collegiate
  preppy:            'collegiate',
  // serene — pared back, calm neutrals
  minimalist:        'serene',
  scandi:            'serene',
  normcore:          'serene',
  cleangirl:         'serene',
  linencore:         'serene',
  coastalgrandma:    'serene',
  // pop — loud, playful, saturated
  maximalist:        'pop',
  y2k:               'pop',
  kpop:              'pop',
  harajuku:          'pop',
  scene:             'pop',
  baddie:            'pop',
  // street
  streetwear:        'street',
  hiphop:            'street',
  skater:            'street',
  // sport
  athleisure:        'sport',
  athletic:          'sport',
  // mono — technical, digital
  techwear:          'mono',
  cyberpunk:         'mono',
  eboy:              'mono',
  // underground — raw, rebellious
  grunge:            'underground',
  punk:              'underground',
  goth:              'underground',
  emo:               'underground',
  rockstar:          'underground',
  leatheraesthetic:  'underground',
  edgy:              'underground',
  indie:             'underground',
  // academia — scholarly, sepia-toned
  darkacademia:      'academia',
  lightacademia:     'academia',
  vintage:           'academia',
  steampunk:         'academia',
  arthoe:            'academia',
  // utility — rugged, functional
  gorpcore:          'utility',
  workwear:          'utility',
  military:          'utility',
  western:           'utility',
  denimcore:         'utility',
  outdoor:           'utility',
  // romantic — soft, whimsical
  boho:              'romantic',
  cottagecore:       'romantic',
  fairycore:         'romantic',
  softboy:           'romantic',
  romantic:          'romantic',
  knitwearaesthetic: 'romantic',
}

export function flavorForStyle(styleId) {
  return STYLE_TO_FLAVOR[styleId] ?? null
}

function topStyleFrom(scores) {
  if (!scores) return null
  let best = null
  let bestScore = 0
  for (const [id, score] of Object.entries(scores)) {
    if (score > bestScore) {
      best = id
      bestScore = score
    }
  }
  return best
}

// Resolve the flavor for the user's #1 aesthetic. Live quiz scores win;
// otherwise fall back to the persisted interest graph (prefs/interests).
// Returns { styleId, flavorId } or null when there is no signal yet.
export function resolveAestheticFlavor(styleScores, interestAffinities) {
  const styleId = topStyleFrom(styleScores) ?? topStyleFrom(interestAffinities)
  if (!styleId) return null
  const flavorId = flavorForStyle(styleId)
  return flavorId ? { styleId, flavorId } : null
}
