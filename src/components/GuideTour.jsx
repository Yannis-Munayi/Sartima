import { useRef, useState } from 'react'
import styles from './GuideTour.module.css'

export const GUIDE_STEPS = [
  // ── Home: Welcome ─────────────────────────────────────────────────────────
  {
    tab:   'home',
    title: 'Welcome to StyleLab ✦',
    desc:  'StyleLab is your personal fashion aesthetic engine. Swipe through clothes, discover which aesthetics match your taste, build outfit boards, and shop with intent — all in one place. This tour walks you through every feature.',
  },

  // ── Home: Hero carousel ───────────────────────────────────────────────────
  {
    tab:   'home',
    title: 'Hero Carousel — Featured Aesthetics',
    desc:  'The hero at the top rotates through five curated aesthetics. Each slide is a live outfit photo. Tap any slide to dive directly into that aesthetic\'s full profile — Story, Items, Looks, and Guide.',
  },

  // ── Home: Fresh Looks ─────────────────────────────────────────────────────
  {
    tab:   'home',
    title: 'Fresh Looks Today 🔄',
    desc:  'Below the hero you\'ll find a new set of curated clothing pieces every day. The selection rotates at midnight using a daily shuffle — come back tomorrow for a fresh batch. Tap any piece to see its aesthetic, or tap the heart to save it to your Wishlist instantly.',
  },

  // ── Home: Shop Scout ─────────────────────────────────────────────────────
  {
    tab:   'home',
    title: 'Shop Scout 👗',
    desc:  'Shop Scout helps you find the best brands to buy from based on your budget and priorities. Pick the clothing pieces you want, set a budget, choose what matters most (quality, sustainability, etc.), and get matched brands. Tap the card on Home to open it.',
  },

  // ── Home: Aesthetic Profile ───────────────────────────────────────────────
  {
    tab:   'home',
    title: 'Your Live Aesthetic Profile 📊',
    desc:  'Once you\'ve swiped on items in Swipe, your Home screen shows a live breakdown of your top aesthetics with percentage scores. This updates every time you swipe — the more you rate, the more accurate your profile gets.',
  },

  // ── Home: Stats pills ─────────────────────────────────────────────────────
  {
    tab:   'home',
    title: 'Stats at a Glance 💡',
    desc:  'Three tappable pills show your total Liked items, Wishlist saves, and Shop queue count. Tap any pill to jump straight to that collection inside My Style. They\'re your quick-access shortcut to everything you\'ve collected.',
  },

  // ── Home: Saved aesthetics + season ──────────────────────────────────────
  {
    tab:   'home',
    title: 'Saved Aesthetics & Season Picks 📌',
    desc:  'Any aesthetic you pin from the Aesthetics screen floats to the top of your Home in a dedicated Saved row. Below that, Season Picks shows aesthetics hand-curated for the current time of year — winter layers, summer breathables, and so on.',
  },

  // ── Home: Capsule Wardrobe ────────────────────────────────────────────────
  {
    tab:   'home',
    title: 'Your Capsule Wardrobe ✦',
    desc:  'Scroll further and you\'ll find Your Capsule Wardrobe — a curated set of full-outfit looks from your top aesthetic, filtered to the current season. These are real, styled outfits you can replicate. Tap any look to open the full aesthetic for more.',
  },

  // ── Home: Trending ────────────────────────────────────────────────────────
  {
    tab:   'home',
    title: 'Trending Now 🔥',
    desc:  'The Trending section shows aesthetics gaining momentum right now. Tap the shuffle button (↻) to randomise the order and surface fresh styles. Tap any card to explore that aesthetic in full.',
  },

  // ── Aesthetics ────────────────────────────────────────────────────────────
  {
    tab:   'explore',
    title: 'Aesthetics — All 51 Styles 🔍',
    desc:  'The Aesthetics tab is the complete library. All 51 aesthetics are displayed as visual cards, grouped by category (Academia, Street, Casual, Alternative, and more). Use the search bar at the top to find any aesthetic by name, vibe, or keyword like "dark" or "preppy".',
  },

  // ── Aesthetics: Filter ────────────────────────────────────────────────────
  {
    tab:   'explore',
    title: 'Filter by Category',
    desc:  'Tap a category chip below the search bar to filter the grid — only aesthetics in that group will show. Tap the chip again or choose "All" to clear the filter. Combine with search for precise lookups.',
  },

  // ── Aesthetic deep-dive: Story ────────────────────────────────────────────
  {
    tab:    'aesthetic:oldmoney',
    subTab: 'story',
    title:  'Inside an Aesthetic — Story Tab',
    desc:   'We\'ve opened Old Money as an example. The Story tab tells you the cultural origin, defining vibe, key influences, and visual traits of the aesthetic. It\'s the best starting point when you\'re new to a style — understand it before you wear it.',
  },

  // ── Aesthetic deep-dive: Items ────────────────────────────────────────────
  {
    tab:    'aesthetic:oldmoney',
    subTab: 'items',
    title:  'Items Tab — The Building Blocks',
    desc:   'The Items tab lists the essential clothing pieces that define this aesthetic — blazers, loafers, cable-knit sweaters, and more. Tap the 🤍 heart on any piece to add it to your Wishlist, or tap "Add to shop list" to queue it for a future purchase.',
  },

  // ── Aesthetic deep-dive: Looks ────────────────────────────────────────────
  {
    tab:    'aesthetic:oldmoney',
    subTab: 'looks',
    title:  'Looks Tab — Full Outfit Inspiration',
    desc:   'The Looks tab shows complete, styled outfits built from the aesthetic\'s core pieces — top, bottom, shoes, accessories all paired together. Each look has a live Pexels photo. This is your outfit-of-the-day reference.',
  },

  // ── Aesthetic deep-dive: Guide ────────────────────────────────────────────
  {
    tab:    'aesthetic:oldmoney',
    subTab: 'guide',
    title:  'Guide Tab — How to Wear It',
    desc:   'The Guide tab breaks the aesthetic into wearable sections: tops, bottoms, footwear, accessories, and more. Tap any section header to expand it and load real reference photos. This is the practical "how to dress" manual for the aesthetic.',
  },

  // ── Aesthetic: Pin ────────────────────────────────────────────────────────
  {
    tab:    'aesthetic:oldmoney',
    subTab: 'story',
    title:  'Pin an Aesthetic 📌',
    desc:   'Tap the 📌 button near the top of any aesthetic to save it. Pinned aesthetics jump to the top of the Aesthetics grid so you can find them instantly, and they also appear in your personalised Saved Aesthetics row on the Home screen.',
  },

  // ── Swipe: intro ──────────────────────────────────────────────────────────
  {
    tab:   'quiz',
    title: 'Swipe — Find Your Aesthetic ✦',
    desc:  'The Swipe tab is where StyleLab learns your taste. You\'ll pick your season and preferred clothing categories, then swipe through real outfit items. Every like or skip trains your personal aesthetic profile. Let\'s walk through it.',
  },

  // ── Forced season selection ───────────────────────────────────────────────
  {
    tab:         'quiz',
    forceScreen: 'seasons',
    forceSeason: 'spring',
    interactive: true,
    title:       'Step 1 — Pick a Season 🌸',
    desc:        'Seasons filter which items you\'ll be shown — winter looks different from summer. Tap Spring (highlighted) to continue the demo.',
  },

  // ── Forced category selection ─────────────────────────────────────────────
  {
    tab:           'quiz',
    forceScreen:   'categories',
    forceCategory: 'outerwear',
    interactive:   true,
    title:         'Step 2 — Choose Categories 🧥',
    desc:          'Categories narrow the item pool to clothes you actually wear. You can pick multiple. Tap Jackets & Coats (highlighted) to continue the demo.',
  },

  // ── Swipe: mechanics ──────────────────────────────────────────────────────
  {
    tab:   'quiz',
    title: 'Swipe Right — Like ❤️',
    desc:  'Swipe right or tap ❤️ to like an item. Liked items are saved to your Liked tab under My Style and count toward your aesthetic score. The more consistently you like within an aesthetic, the higher it ranks in your profile.',
  },
  {
    tab:   'quiz',
    title: 'Swipe Left — Skip ✕',
    desc:  'Swipe left or tap ✕ to pass on an item. Skips don\'t count against your score — they just remove the item from the current queue. Use skips freely; only likes shape your profile.',
  },
  {
    tab:   'quiz',
    title: 'Save to Wishlist Without Liking 🤍',
    desc:  'See the 🤍 icon on the card? Tap it to save the item to your Wishlist without it affecting your aesthetic score. Perfect for pieces you love the look of but aren\'t sure match your overall style direction.',
  },

  // ── Closet: Liked ────────────────────────────────────────────────────────
  {
    tab:           'closet',
    myStyleSubTab: 'liked',
    title:         'Closet — Liked Items ❤️',
    desc:          'Every item you swiped right on lives here. Tap "Generate my aesthetics" to run a fresh analysis on your current likes — StyleLab scores each aesthetic based on how many of its signature pieces you liked. Tap × on any card to remove it and update your profile.',
  },

  // ── Closet: Outfits ───────────────────────────────────────────────────────
  {
    tab:           'closet',
    myStyleSubTab: 'outfits',
    title:         'Outfit Boards 🗂️',
    desc:          'Boards let you combine your liked and saved pieces into named outfit collections — think of them as your personal lookbooks. Tap "+ New Board", select pieces from your library, give the board a name, and save. Boards sync to your account so they\'re available on any device.',
  },

  // ── Profile ───────────────────────────────────────────────────────────────
  {
    tab:   'profile',
    title: 'Profile — Settings & Evolution 🎉',
    desc:  'Your Profile lets you set gender preference (Men / Women / Both) to filter item photos across the whole app, toggle between dark and light mode, and view your Style Evolution timeline — a visual history of how your aesthetic profile has shifted across every quiz session. Sign in to back everything up across devices.',
  },
]

export default function GuideTour({ step, onNext, onBack, onSkip }) {
  const s       = GUIDE_STEPS[step]
  const isFirst = step === 0
  const isLast  = step === GUIDE_STEPS.length - 1

  // ── Draggable card ────────────────────────────────────────────────────────
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const dragging = useRef(false)
  const origin   = useRef({ mx: 0, my: 0, ox: 0, oy: 0 })

  function onPointerDown(e) {
    // only drag via the handle
    if (!e.currentTarget.classList.contains(styles.dragHandle)) return
    dragging.current = true
    origin.current = { mx: e.clientX, my: e.clientY, ox: offset.x, oy: offset.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e) {
    if (!dragging.current) return
    setOffset({
      x: origin.current.ox + (e.clientX - origin.current.mx),
      y: origin.current.oy + (e.clientY - origin.current.my),
    })
  }

  function onPointerUp() {
    dragging.current = false
  }

  return (
    <div className={styles.overlay}>
      <div
        className={styles.card}
        style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
      >
        {/* Drag handle */}
        <div
          className={styles.dragHandle}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <span className={styles.dragPill} />
        </div>

        {/* Progress dots */}
        <div className={styles.dots}>
          {GUIDE_STEPS.map((_, i) => (
            <span
              key={i}
              className={`${styles.dot} ${i === step ? styles.dotActive : i < step ? styles.dotDone : ''}`}
            />
          ))}
        </div>

        {/* Step counter + skip */}
        <div className={styles.meta}>
          <span className={styles.counter}>{step + 1} / {GUIDE_STEPS.length}</span>
          <button className={styles.skipBtn} onClick={onSkip}>Skip tour</button>
        </div>

        <h3 className={styles.title}>{s.title}</h3>
        <p className={styles.desc}>{s.desc}</p>

        {/* Interactive steps: no Next button — user must tap the highlighted element */}
        {!s.interactive && (
          <div className={styles.actions}>
            {!isFirst && (
              <button className={styles.backBtn} onClick={onBack}>← Back</button>
            )}
            <button
              className={`${styles.nextBtn} ${isFirst ? styles.nextBtnFull : ''}`}
              onClick={isLast ? onSkip : onNext}
            >
              {isLast ? 'Done ✓' : 'Next →'}
            </button>
          </div>
        )}

        {s.interactive && (
          <p className={styles.interactiveHint}>Tap the highlighted option above to continue</p>
        )}
      </div>
    </div>
  )
}
