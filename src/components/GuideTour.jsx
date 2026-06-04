import { useRef, useState } from 'react'
import styles from './GuideTour.module.css'

export const GUIDE_STEPS = [
  // ── Welcome ───────────────────────────────────────────────────────────────
  {
    tab:   'home',
    title: 'Welcome to StyleLab ✦',
    desc:  'StyleLab is your personal style engine — discover your aesthetic identity, build a digital wardrobe, and get AI-powered daily outfit suggestions. This tour covers every key feature.',
  },

  // ── Swipe ─────────────────────────────────────────────────────────────────
  {
    tab:   'quiz',
    title: 'Swipe to Find Your Style',
    desc:  'The Swipe tab is where it all starts. Swipe right ❤️ to like an item, left ✕ to skip. Every like trains your aesthetic profile in real time. Tap the 🤍 icon on any card to save a piece to your Wishlist without affecting your profile score.',
  },

  // ── Aesthetic Profile on Home ─────────────────────────────────────────────
  {
    tab:   'home',
    title: 'Your Live Aesthetic Profile',
    desc:  'Once you start swiping, your Home screen shows a live breakdown of your top aesthetics — percentage bars that update with every swipe. Tap any bar to dive straight into that aesthetic. The more you rate, the sharper your results.',
  },

  // ── Explore ───────────────────────────────────────────────────────────────
  {
    tab:   'explore',
    title: 'Explore 51 Aesthetics 🔍',
    desc:  'The Aesthetics tab is the full library — all 51 styles from Old Money to Gorpcore, Cottagecore to Cyberpunk. Search by name or keyword. Use the filter chips to browse All, your 📌 Saved aesthetics, or 🔥 Popular picks.',
  },

  // ── Aesthetic deep-dive ───────────────────────────────────────────────────
  {
    tab:   'aesthetic:oldmoney',
    title: 'Inside an Aesthetic',
    desc:  'Tap any aesthetic to open its full profile. Four tabs: Story (the cultural origin and vibe), Items (essential pieces), Looks (complete styled outfits), and Guide (how to actually wear it). Tap "+ Save tab" in the header to pin it to your Home screen and your Saved filter.',
  },

  // ── Digital Closet ────────────────────────────────────────────────────────
  {
    tab:   'closet',
    title: 'Build Your Digital Closet 👗',
    desc:  'The Closet tab is your digital wardrobe. Tap the + button to add items — upload a photo (AI scans it and identifies each piece automatically) or search the product catalog by name or brand. Items are tagged with category, colour, season, and occasion.',
  },

  // ── Liked + Outfit Boards ─────────────────────────────────────────────────
  {
    tab:   'closet',
    title: 'Liked Items & Outfit Boards',
    desc:  'The Liked sub-tab holds every item you swiped right on — your personal taste archive. The Outfits sub-tab lets you build named outfit boards: tap "+ New Board", pick pieces from your library, and save combinations as reusable lookbooks.',
  },

  // ── Daily Look ────────────────────────────────────────────────────────────
  {
    tab:   'daily',
    title: 'Daily AI Outfit Generator ✦',
    desc:  'The Daily tab generates a fresh outfit for you every day. Choose whether to pull from your Closet, your Liked items, or both — then pick an occasion. The AI reads your local weather and selects pieces that work together. Tap an outfit to log it in My Log.',
  },

  // ── Calendar & Trip ───────────────────────────────────────────────────────
  {
    tab:   'daily',
    title: 'Calendar & Trip Planner 🗓️',
    desc:  'The Calendar sub-tab lets you plan outfit combinations for specific dates on a monthly view. The Trip sub-tab generates a full packing list and daily outfit schedule for any destination — just enter where you\'re going and how many nights.',
  },

  // ── Shop Scout ────────────────────────────────────────────────────────────
  {
    tab:   'home',
    title: 'Shop Scout 🛍️',
    desc:  'Tap the Shop Scout card on Home to get brand recommendations tailored to what you want to buy. Pick the clothing categories you\'re after, set a budget, and choose your priorities. StyleLab matches you to the best brands to shop from.',
  },

  // ── Profile ───────────────────────────────────────────────────────────────
  {
    tab:   'profile',
    title: 'Profile & Settings',
    desc:  'Your Profile lets you set a gender preference (Men / Women / Both) to filter outfit photos across the whole app, and toggle between dark and light mode. Check your Style Evolution to see how your top aesthetic has shifted across quiz sessions.',
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
      </div>
    </div>
  )
}
