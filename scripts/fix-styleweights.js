// One-off codemod: remap phantom styleWeights keys (invented by past catalog
// authoring runs) onto the real 51 aesthetics from styles.js. Text-level edit
// so all other formatting in the product files is preserved.
// Run: node scripts/fix-styleweights.js

import { readFileSync, writeFileSync } from 'node:fs'

const MAP = {
  feminine: 'romantic',
  americana: 'vintage',
  parisian: 'eurochic',
  eclectic: 'maximalist',
  rockchic: 'rockstar',
  avantgarde: 'edgy',
  luxury: 'oldmoney',
  britpop: 'indie',
  hype: 'streetwear',
  futurism: 'techwear',
  mod: 'vintage',
  artsy: 'arthoe',
  influencer: 'cleangirl',
  ivy: 'preppy',
  classic: 'oldmoney',
  militarychic: 'military',
  stealth: 'techwear',
  skate: 'skater',
  bohemian: 'boho',
  rock: 'rockstar',
  quietluxury: 'oldmoney',
  sporty: 'athletic',
  nautical: 'preppy',
  artistic: 'arthoe',
  sustainable: null, // no real equivalent — drop the key
}

const FILES = [
  'core', 'footwear-specialists', 'footwear-wide', 'tops', 'bottoms',
  'knitwear', 'outerwear', 'accessories', 'activewear',
]

let totalRemapped = 0
let totalDropped = 0

for (const f of FILES) {
  const path = `src/data/products/${f}.js`
  const src = readFileSync(path, 'utf8')
  let fileChanges = 0

  const out = src.replace(/styleWeights:\s*\{([^}]*)\}/g, (whole, inner) => {
    const pairs = []
    for (const m of inner.matchAll(/([a-zA-Z0-9_]+)\s*:\s*([\d.]+)/g)) {
      pairs.push([m[1], Number(m[2])])
    }
    if (pairs.length === 0) return whole

    let changed = false
    const merged = new Map()
    for (const [key, val] of pairs) {
      let target = key
      if (key in MAP) {
        changed = true
        if (MAP[key] === null) { totalDropped++; continue }
        target = MAP[key]
        totalRemapped++
      }
      merged.set(target, Math.max(merged.get(target) ?? 0, val))
    }
    if (!changed) return whole
    fileChanges++
    const body = [...merged.entries()].map(([k, v]) => `${k}: ${v}`).join(', ')
    return `styleWeights: { ${body} }`
  })

  if (fileChanges > 0) {
    writeFileSync(path, out)
    console.log(`${f}.js: rewrote ${fileChanges} styleWeights blocks`)
  }
}

console.log(`\nRemapped ${totalRemapped} keys, dropped ${totalDropped} (sustainable).`)
