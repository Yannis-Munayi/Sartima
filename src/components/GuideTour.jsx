import { useRef, useState } from 'react'
import { GUIDE_LABELS } from '../data/guideSteps'
import styles from './GuideTour.module.css'

export default function GuideTour({ step, steps, isFullTour, onNext, onBack, onSkip }) {
  const s       = steps[step]
  const isFirst = step === 0
  const isLast  = step === steps.length - 1
  const label   = GUIDE_LABELS[s.guideKey] ?? ''

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

        <span className={styles.guideLabel}>
          {isFullTour ? `Full Tour — ${label}` : label}
        </span>

        {/* Progress dots */}
        <div className={styles.dots}>
          {steps.map((_, i) => (
            <span
              key={i}
              className={`${styles.dot} ${i === step ? styles.dotActive : i < step ? styles.dotDone : ''}`}
            />
          ))}
        </div>

        {/* Step counter + skip */}
        <div className={styles.meta}>
          <span className={styles.counter}>{step + 1} / {steps.length}</span>
          <button className={styles.skipBtn} onClick={onSkip}>Skip tour</button>
        </div>

        <h3 className={styles.title}>{s.title}</h3>
        <p className={styles.desc}>{s.desc}</p>
        {s.note && <p className={styles.note}>{s.note}</p>}

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
