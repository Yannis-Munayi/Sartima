// Product catalog index — merges all category files.
// Add new products by editing the relevant file in src/data/products/.

import coreProducts          from './products/core'
import footwearSpecialists   from './products/footwear-specialists'
import footwearWide          from './products/footwear-wide'
import topsProducts          from './products/tops'
import bottomsProducts       from './products/bottoms'
import knitwearProducts      from './products/knitwear'
import outerwearProducts     from './products/outerwear'
import accessoriesProducts   from './products/accessories'
import activewearProducts    from './products/activewear'

export const PRODUCTS = [
  ...coreProducts,
  ...footwearSpecialists,
  ...footwearWide,
  ...topsProducts,
  ...bottomsProducts,
  ...knitwearProducts,
  ...outerwearProducts,
  ...accessoriesProducts,
  ...activewearProducts,
]

// Fast lookup maps (built once on import — do not mutate)
export const PRODUCTS_BY_ID = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]))

export const PRODUCTS_BY_TYPE = PRODUCTS.reduce((acc, p) => {
  if (!acc[p.type]) acc[p.type] = []
  acc[p.type].push(p)
  return acc
}, {})

export const PRODUCTS_BY_BRAND = PRODUCTS.reduce((acc, p) => {
  if (!acc[p.brand]) acc[p.brand] = []
  acc[p.brand].push(p)
  return acc
}, {})

export const PRODUCTS_BY_PARENT = PRODUCTS.reduce((acc, p) => {
  if (!acc[p.parentType]) acc[p.parentType] = []
  acc[p.parentType].push(p)
  return acc
}, {})
