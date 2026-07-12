import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useCloset } from '../../context/ClosetContext'
import { useInterests } from '../../context/InterestContext'
import { useClosetGaps } from '../../hooks/useClosetGaps'
import { useGapSignals } from '../../hooks/useGapSignals'
import { getGapReasoning } from '../../services/gapReasoning'
import { dismissGap, loadDismissedCategories } from '../../services/gapDismissals'
import { trackEvent } from '../../services/firebase'
import styles from '../../screens/HomeScreen.module.css'

const CATEGORY_EMOJIS_HOME = {
  tops: '👕', bottoms: '👖', outerwear: '🧥',
  dresses: '👗', footwear: '👟', accessories: '👜',
}

// Representative Shop Scout piece per gap category — deep-links the CTA into
// a pre-filled wizard step instead of a blank browse. 'accessories' has no
// Shop Scout piece today, so it falls back to the unfiltered wizard entry.
const GAP_CATEGORY_TO_PIECE = {
  tops:        'plain-tee',
  bottoms:     'slim-jeans',
  outerwear:   'bomber',
  footwear:    'clean-sneakers',
  accessories: null,
}

// The everyday "what should I buy next" surface — cheap deficit comes from
// useClosetGaps (closet vs. capsuleBaseline, plus any missingCategory hits
// from failed daily-outfit generations via useGapSignals); the copy on top
// comes from a lightweight AI call once we know which gap to talk about.
export default function GapCard({ navigate }) {
  const { user }         = useAuth()
  const { closetItems }  = useCloset()
  const { interests }    = useInterests() ?? {}
  const gapSignals       = useGapSignals()
  const gaps             = useClosetGaps(gapSignals)

  const [dismissed, setDismissed] = useState(new Set())
  const [reasoning, setReasoning] = useState('')
  const [loaded, setLoaded]       = useState(false)

  useEffect(() => {
    if (!user) { setDismissed(new Set()); return }
    loadDismissedCategories(user.uid).then(setDismissed)
  }, [user])

  const topGap = gaps.find((g) => !dismissed.has(g.category)) ?? null

  useEffect(() => {
    if (topGap) trackEvent('gap_card_shown', { category: topGap.category, deficit: topGap.deficit })
  }, [topGap?.category])

  useEffect(() => {
    setReasoning('')
    setLoaded(false)
    if (!topGap) return
    const closetSummary = closetItems.slice(0, 12).map((i) => i.name)
    const topStyles = Object.entries(interests?.styleAffinities ?? {})
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([id]) => id)
    getGapReasoning({
      category:      topGap.category,
      owned:         topGap.owned,
      target:        topGap.target,
      closetSummary,
      topStyles,
    }).then((r) => { setReasoning(r); setLoaded(true) })
  }, [topGap?.category, topGap?.owned]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!user || !topGap) return null

  function handleDismiss(e) {
    e.stopPropagation()
    dismissGap(user.uid, topGap.category)
    setDismissed((prev) => new Set(prev).add(topGap.category))
  }

  function handleShop() {
    trackEvent('gap_card_shop_clicked', { category: topGap.category })
    const pieceId = GAP_CATEGORY_TO_PIECE[topGap.category]
    navigate(pieceId ? `wardrobe-builder:${pieceId}` : 'wardrobe-builder')
  }

  const emoji = CATEGORY_EMOJIS_HOME[topGap.category] ?? '🧩'

  return (
    <section className={styles.section}>
      <div className={styles.closetCta} onClick={handleShop}>
        <span className={styles.closetCtaIcon}>{emoji}</span>
        <div style={{ flex: 1 }}>
          <p className={styles.closetCtaTitle}>You're light on {topGap.category}</p>
          <p className={styles.closetCtaSub}>
            {loaded && reasoning ? reasoning : `${topGap.owned} of ${topGap.target} — round out your closet`}
          </p>
        </div>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss"
          style={{ background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: 16, cursor: 'pointer', padding: 4, flexShrink: 0 }}
        >
          ✕
        </button>
      </div>
    </section>
  )
}
