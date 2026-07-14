// Node-compatible catalog loader for scripts. src/data/products.js uses
// extensionless imports that Vite resolves but plain Node does not, so
// scripts import the chunk files directly here instead.

import coreProducts from '../../src/data/products/core.js'
import footwearSpecialists from '../../src/data/products/footwear-specialists.js'
import footwearWide from '../../src/data/products/footwear-wide.js'
import topsProducts from '../../src/data/products/tops.js'
import bottomsProducts from '../../src/data/products/bottoms.js'
import knitwearProducts from '../../src/data/products/knitwear.js'
import outerwearProducts from '../../src/data/products/outerwear.js'
import accessoriesProducts from '../../src/data/products/accessories.js'
import activewearProducts from '../../src/data/products/activewear.js'

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

export const PRODUCTS_BY_BRAND = PRODUCTS.reduce((acc, p) => {
  if (!acc[p.brand]) acc[p.brand] = []
  acc[p.brand].push(p)
  return acc
}, {})
