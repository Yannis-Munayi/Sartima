import { useState } from 'react'
import { useCloset } from '../context/ClosetContext'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { generateTrip } from '../services/tripAI'
import LockedOverlay from '../components/LockedOverlay'
import styles from './TripPlannerScreen.module.css'
import Icon from '../components/Icon'

const CATEGORY_EMOJIS = {
  tops: '👕', bottoms: '👖', outerwear: '🧥',
  dresses: '👗', footwear: '👟', accessories: '👜',
}

export default function TripPlannerScreen() {
  const { user }        = useAuth()
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

    try {
      const parsed  = await generateTrip({ destination, nights, closetItems, gender: state.gender })
      const itemMap = Object.fromEntries(closetItems.map((i) => [i.id, i]))
      setResult({ ...parsed, itemMap })
    } catch (err) {
      setError('Failed to generate. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  if (!user) {
    const ghostPacking = ['White Oxford Shirt', 'Slim Chinos', 'Wool Overcoat', 'Leather Sneakers', 'Tote Bag']
    const ghostDays = ['Day 1 — Arrival', 'Day 2 — Exploring', 'Day 3 — Departure']
    return (
      <div className={styles.screen}>
        <div className={styles.header}>
          <h1 className={styles.title}>Trip Planner</h1>
          <p className={styles.sub}>Pack smart. AI selects from your closet.</p>
        </div>
        <LockedOverlay message="Sign in to generate AI-powered trip packing lists">
          <div className={styles.results} style={{ pointerEvents: 'none' }}>
            <h2 className={styles.resultTitle}>Paris, France · 3 nights</h2>
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Packing list</h3>
              <div className={styles.packingList}>
                {ghostPacking.map((name) => (
                  <div key={name} className={styles.packingItem}>
                    <div className={styles.packThumb}><span>👕</span></div>
                    <div className={styles.packInfo}><p className={styles.packName}>{name}</p></div>
                  </div>
                ))}
              </div>
            </section>
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Daily outfits</h3>
              {ghostDays.map((label) => (
                <div key={label} className={styles.dayPlan}>
                  <p className={styles.dayLabel}>{label}</p>
                </div>
              ))}
            </section>
          </div>
        </LockedOverlay>
      </div>
    )
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
            <h3 className={styles.sectionTitle}>Packing list</h3>
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
                        <Icon name="bag" size={18} />
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
            <h3 className={styles.sectionTitle}>Daily outfits</h3>
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
              <h3 className={styles.sectionTitle}>Consider buying</h3>
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
