import { httpsCallable } from 'firebase/functions'
import { functions } from './firebase'

const CATEGORY_MAP = {
  tops:        ['shirt', 'top', 'blouse', 'tee', 't-shirt', 'sweater', 'hoodie', 'cardigan', 'crop', 'tank', 'polo', 'turtleneck', 'sweatshirt'],
  bottoms:     ['pant', 'trouser', 'jean', 'denim', 'skirt', 'short', 'legging', 'jogger', 'chino'],
  outerwear:   ['jacket', 'coat', 'blazer', 'parka', 'trench', 'vest', 'windbreaker', 'overcoat', 'bomber'],
  dresses:     ['dress', 'gown', 'romper', 'jumpsuit', 'overall'],
  footwear:    ['shoe', 'boot', 'sneaker', 'heel', 'flat', 'loafer', 'sandal', 'mule', 'slipper', 'oxford', 'pump'],
  accessories: ['bag', 'hat', 'cap', 'scarf', 'belt', 'watch', 'jewel', 'necklace', 'ring', 'earring', 'bracelet', 'sunglasses', 'purse', 'clutch', 'tote', 'backpack'],
}

function inferCategory(name, hint) {
  const text = `${name} ${hint ?? ''}`.toLowerCase()
  for (const [cat, keywords] of Object.entries(CATEGORY_MAP)) {
    if (keywords.some((kw) => text.includes(kw))) return cat
  }
  return 'tops'
}

const visionFn = httpsCallable(functions, 'anthropicVision')

export async function analyzeOutfit(imageBase64, mimeType = 'image/jpeg') {
  const { data } = await visionFn({ imageBase64, mimeType })
  return (data.items ?? []).map((item, i) => ({
    id:          `ai_${Date.now()}_${i}`,
    name:        item.name,
    category:    item.category in CATEGORY_MAP ? item.category : inferCategory(item.name, item.description),
    color:       item.color,
    description: item.description,
    bbox:        item.bbox ?? null,
  }))
}
