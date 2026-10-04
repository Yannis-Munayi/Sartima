import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCloset } from '../context/ClosetContext'
import { useInterests } from '../context/InterestContext'
import { useClosetGaps } from './useClosetGaps'
import { useGapSignals } from './useGapSignals'
import { getGapReasoning } from '../services/gapReasoning'
import { dismissGap, loadDismissedCategories } from '../services/gapDismissals'
import { trackEvent } from '../services/firebase'
import { GAP_PIECE_FOR_CATEGORY } from '../services/wardrobeRecommend'

const MIN_CLOSET_FOR_OUTFITS = 3

// Everything the Home bell surfaces, as a flat list of
// { id, icon, title, body, onOpen, onDismiss? } — icon is an <Icon> name.
//
// - Closet prompt: shown until the closet has enough items for daily AI outfits.
// - Wardrobe gap: cheap deficit from useClosetGaps (closet vs. capsuleBaseline,
//   plus missingCategory hits from failed daily-outfit generations via
//   useGapSignals). The AI copy is only fetched once `panelOpen` is true, so
//   users who never open the bell don't spend a gapReasoning call.
export function useHomeNotifications({ navigate, panelOpen }) {
  const { user }        = useAuth()
  const { closetItems } = useCloset()
  const { interests }   = useInterests() ?? {}
  const gapSignals      = useGapSignals()
  const gaps            = useClosetGaps(gapSignals)

  const [dismissed, setDismissed] = useState(new Set())
  const [reasoning, setReasoning] = useState('')

  useEffect(() => {
    if (!user) { setDismissed(new Set()); return }
    loadDismissedCategories(user.uid).then(setDismissed)
  }, [user])

  const topGap = user ? gaps.find((g) => !dismissed.has(g.category)) ?? null : null

  useEffect(() => {
    setReasoning('')
  }, [topGap?.category, topGap?.owned])

  useEffect(() => {
    if (!panelOpen || !topGap) return
    let cancelled = false
    trackEvent('gap_card_shown', { category: topGap.category, deficit: topGap.deficit })
    const closetSummary = closetItems.slice(0, 12).map((i) => i.name)
    const topStyles = Object.entries(interests?.styleAffinities ?? {})
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([id]) => id)
    getGapReasoning({
      category: topGap.category,
      owned:    topGap.owned,
      target:   topGap.target,
      closetSummary,
      topStyles,
    }).then((r) => { if (!cancelled) setReasoning(r) })
    return () => { cancelled = true }
  }, [panelOpen, topGap?.category, topGap?.owned]) // eslint-disable-line react-hooks/exhaustive-deps

  const items = []

  if (!user || closetItems.length < MIN_CLOSET_FOR_OUTFITS) {
    items.push({
      id:     'closet-cta',
      icon:   'hanger',
      title:  'Build your digital closet',
      body:   `Add ${MIN_CLOSET_FOR_OUTFITS}+ items to unlock daily AI outfits`,
      onOpen: () => navigate('daily'),
    })
  }

  if (topGap) {
    items.push({
      id:    `gap:${topGap.category}`,
      icon:  'layers',
      title: `You're light on ${topGap.category}`,
      body:  reasoning || `${topGap.owned} of ${topGap.target} — round out your closet`,
      onOpen: () => {
        trackEvent('gap_card_shop_clicked', { category: topGap.category })
        // Representative Shop Scout piece deep-links into a pre-filled wizard
        // step; categories without one open the unfiltered wizard
        const pieceId = GAP_PIECE_FOR_CATEGORY[topGap.category]
        navigate(pieceId ? `wardrobe-builder:${pieceId}` : 'wardrobe-builder')
      },
      onDismiss: () => {
        dismissGap(user.uid, topGap.category)
        setDismissed((prev) => new Set(prev).add(topGap.category))
      },
    })
  }

  return items
}
