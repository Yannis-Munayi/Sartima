import { useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../services/firebase'
import { useEscapeKey } from '../hooks/useEscapeKey'
import styles from './FeedbackSheet.module.css'

const CATEGORIES = ['Bug', 'Feature Request', 'Idea', 'Other']

const callSubmitFeedback = httpsCallable(functions, 'submitFeedback')

export default function FeedbackSheet({ user, onClose }) {
  const [category, setCategory] = useState('Bug')
  const [message, setMessage] = useState('')
  const [contactEmail, setContactEmail] = useState(user?.email ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState(null)
  useEscapeKey(onClose)

  async function handleSubmit() {
    if (!message.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      if (user) {
        await callSubmitFeedback({
          category,
          message: message.trim(),
          contactEmail: contactEmail.trim() || null,
        })
      } else {
        window.location.href = `mailto:ytmunayi@gmail.com?subject=${encodeURIComponent(`[Sartima] ${category}`)}&body=${encodeURIComponent(message.trim())}`
      }
      setDone(true)
    } catch {
      setError('Failed to send. You can also email ytmunayi@gmail.com directly.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.sheet} role="dialog" aria-modal="true">
        <div className={styles.handle} />
        <div className={styles.header}>
          <h2 className={styles.title}>Send Feedback</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        {done ? (
          <div className={styles.success}>
            <span className={styles.successIcon}>✓</span>
            <p className={styles.successTitle}>Thanks for your feedback!</p>
            <p className={styles.successSub}>We read every message and use it to make Sartima better.</p>
            <button className={styles.doneBtn} onClick={onClose}>Done</button>
          </div>
        ) : (
          <div className={styles.body}>
            <div className={styles.field}>
              <label className={styles.label}>Category</label>
              <div className={styles.categoryRow}>
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    className={`${styles.categoryPill} ${category === c ? styles.categoryPillActive : ''}`}
                    onClick={() => setCategory(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="feedback-msg">Message</label>
              <textarea
                id="feedback-msg"
                className={styles.textarea}
                placeholder="Tell us what's on your mind..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="feedback-email">
                Email <span className={styles.optional}>(optional, for follow-up)</span>
              </label>
              <input
                id="feedback-email"
                type="email"
                className={styles.input}
                placeholder="your@email.com"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <button
              className={styles.submitBtn}
              onClick={handleSubmit}
              disabled={!message.trim() || submitting}
            >
              {submitting ? 'Sending…' : 'Send Feedback'}
            </button>
          </div>
        )}
      </div>
    </>
  )
}
