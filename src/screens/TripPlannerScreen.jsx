import { useState } from 'react'
import Anthropic from '@anthropic-ai/sdk'
import { useCloset } from '../context/ClosetContext'
import { useApp } from '../context/AppContext'
import styles from './TripPlannerScreen.module.css'

const client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
})

const CATEGORY_EMOJIS = {
  tops: '👕', bottoms: '👖', outerwear: '🧥',
  dresses: '👗', footwear: '👟', accessories: '👜',
}

export default function TripPlannerScreen() {
  const { closetItems } = useCloset()
  const { state }       = useApp()

  const [destination, setDestination] = useState('')
  const [nights, setNights]           = useState(3)
  const [result, setResult]           = useState(null)
  const [generating, setGenerating]   = useState(false)
  const [error, setError]             = useState(null)

  async function handleGenerate() {
    if (!destination.trim()) { setError('Enter a destination.'); return }
    if (closetItems.length < 3) { setError('Add at least 3 items to your closet first.'); return }

    setGenerating(true)
    setError(null)
    setResult(null)

    const itemList = closetItems.map((i) => ({
      id: i.id, name: i.name, category: i.category,
      color: i.color ?? '', seasons: i.seasons ?? [],
    }))

    const prompt = `You are a personal travel stylist. Create a packing list and daily outfit plan for a ${nights}-night trip to ${destination}.

Available wardrobe:
${JSON.stringify(itemList)}

Gender preference: ${state.gender}

Rules:
- Choose items ONLY from the wardrobe above (use their IDs)
- Suggest 1 outfit per day (reference item IDs)
- Create a concise packing list (item IDs + names)
- Add 2-3 items to "also consider buying" if the wardrobe has gaps for this destination

Return ONLY valid JSON:
{
  "destination": "${destination}",
  "nights": ${nights},
  "packingList": [
    { "itemId": "id or null if suggested purchase", "name": "item name", "note": "why pack it", "fromCloset": true/false }
  ],
  "dailyOutfits": [
    { "day": 1, "label": "Day 1 - Arrival", "itemIds": ["id1", "id2"], "note": "styling tip" }
  ],
  "gapItems": ["description of items to consider buying if any"]
}`

    try {
      const response = await client.messages.create({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        messages:   [{ role: 'user', content: prompt }],
      })

      const text = response.content[0]?.text ?? ''
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON')

      const parsed = JSON.parse(jsonMatch[0])
      const itemMap = Object.fromEntries(closetItems.map((i) => [i.id, i]))
      setResult({ ...parsed, itemMap })
    } catch (err) {
      setError('Failed to generate. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <h1 className={styles.title}>Trip Planner</h1>
        <p className={styles.sub}>Pack smart. AI selects from your closet.</p>
      </div>

      {/* Input form */}
      <div className={styles.form}>
        <label className={styles.label}>Destination</label>
        <input
          className={styles.input}
          placeholder='e.g. "Paris, France" or "Tokyo in October"'
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
        />

        <label className={styles.label}>Nights away</label>
        <div className={styles.stepper}>
          <button className={styles.stepBtn} onClick={() => setNights((n) => Math.max(1, n - 1))}>−</button>
          <span className={styles.stepValue}>{nights}</span>
          <button className={styles.stepBtn} onClick={() => setNights((n) => Math.min(30, n + 1))}>+</button>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <button
          className={styles.generateBtn}
          onClick={handleGenerate}
          disabled={generating || closetItems.length < 3}
        >
          {generating ? (
            <><span className={styles.spinner} /> Packing your bags…</>
          ) : '✦ Generate Trip Pack'}
        </button>

        {closetItems.length < 3 && (
          <p className={styles.closetNote}>Add 3+ items to your closet to use Trip Planner.</p>
        )}
      </div>

      {/* Results */}
      {result && (
        <div className={styles.results}>
          <h2 className={styles.resultTitle}>
            {result.destination} · {result.nights} nights
          </h2>

          {/* Packing list */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>🧳 Packing List</h3>
            <div className={styles.packingList}>
              {result.packingList.map((item, i) => {
                const closetItem = item.itemId ? result.itemMap[item.itemId] : null
                const photoUrl   = closetItem?.prettifiedUrl ?? closetItem?.imageUrl ?? closetItem?.thumbnailUrl
                return (
                  <div key={i} className={`${styles.packingItem} ${!item.fromCloset ? styles.suggestItem : ''}`}>
                    {item.fromCloset && closetItem ? (
                      <div className={styles.packThumb}>
                        {photoUrl
                          ? <img src={photoUrl} alt={item.name} className={styles.packThumbImg} />
                          : <span>{CATEGORY_EMOJIS[closetItem.category] ?? '👕'}</span>
                        }
                      </div>
                    ) : (
                      <div className={styles.packThumb}>
                        <span>🛍️</span>
                      </div>
                    )}
                    <div className={styles.packInfo}>
                      <p className={styles.packName}>{item.name}</p>
                      {item.note && <p className={styles.packNote}>{item.note}</p>}
                      {!item.fromCloset && (
                        <span className={styles.purchaseBadge}>Consider buying</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* Daily outfits */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>👗 Daily Outfits</h3>
            <div className={styles.dayList}>
              {result.dailyOutfits.map((day, i) => {
                const items = (day.itemIds ?? []).map((id) => result.itemMap[id]).filter(Boolean)
                return (
                  <div key={i} className={styles.dayCard}>
                    <p className={styles.dayLabel}>{day.label}</p>
                    <div className={styles.dayItems}>
                      {items.map((item) => {
                        const photo = item.prettifiedUrl ?? item.imageUrl ?? item.thumbnailUrl
                        return (
                          <div key={item.id} className={styles.dayItem}>
                            {photo
                              ? <img src={photo} alt={item.name} className={styles.dayImg} />
                              : <span>{CATEGORY_EMOJIS[item.category] ?? '👕'}</span>
                            }
                          </div>
                        )
                      })}
                    </div>
                    {day.note && <p className={styles.dayNote}>{day.note}</p>}
                  </div>
                )
              })}
            </div>
          </section>

          {/* Gap items */}
          {result.gapItems?.length > 0 && (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>🛍️ Consider Buying</h3>
              <ul className={styles.gapList}>
                {result.gapItems.map((g, i) => <li key={i} className={styles.gapItem}>{g}</li>)}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
