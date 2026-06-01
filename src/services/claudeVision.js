import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
})

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
  return 'tops' // fallback
}

export async function analyzeOutfit(imageBase64, mimeType = 'image/jpeg') {
  const response = await client.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          {
            type:   'image',
            source: { type: 'base64', media_type: mimeType, data: imageBase64 },
          },
          {
            type: 'text',
            text: `Analyze this outfit photo and identify every visible clothing item and accessory being worn.

Return a JSON object with this exact shape — no markdown, no explanation, just raw JSON:
{
  "items": [
    {
      "name": "short descriptive name (3-5 words max)",
      "category": "one of: tops | bottoms | outerwear | dresses | footwear | accessories",
      "color": "primary color (one word)",
      "description": "one sentence describing the piece"
    }
  ]
}

Rules:
- Include every visible item (shirt, pants, shoes, bag, hat, jewellery, etc.)
- Use lowercase for category
- If the full outfit is a dress or jumpsuit, list it as a single "dresses" item
- Maximum 10 items`,
          },
        ],
      },
    ],
  })

  const text = response.content[0]?.text ?? ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON in response')

  const parsed = JSON.parse(jsonMatch[0])
  return (parsed.items ?? []).map((item, i) => ({
    id:          `ai_${Date.now()}_${i}`,
    name:        item.name,
    category:    item.category in CATEGORY_MAP ? item.category : inferCategory(item.name, item.description),
    color:       item.color,
    description: item.description,
  }))
}
