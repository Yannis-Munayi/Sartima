import { useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../services/firebase'
import { collectDiagnostics, getLogBuffer } from '../services/crashReporter'
import styles from './CrashReportSheet.module.css'

const callSubmitCrashReport = httpsCallable(functions, 'submitCrashReport')

export default function CrashReportSheet({ user, appState, onClose }) {
  const [doing, setDoing] = useState('')
  const [saw, setSaw] = useState('')
  const [showDiag, setShowDiag] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState(null)

  const logs = getLogBuffer()
  const errorCount = logs.filter(
    (e) => e.type === 'error' || e.type === 'uncaught' || e.type === 'unhandledRejection'
  ).length
  const networkCount = logs.filter((e) => e.type === 'networkError').length

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    try {
      if (user) {
        const diagnostics = collectDiagnostics(appState)
        await callSubmitCrashReport({
          doing: doing.trim(),
          saw: saw.trim(),
          diagnostics,
        })
      } else {
        const body = [
          doing ? `What I was doing: ${doing}` : '',
          saw ? `What I saw: ${saw}` : '',
          `Browser: ${navigator.userAgent}`,
        ].filter(Boolean).join('\n\n')
        window.location.href = `mailto:ytmunayi@gmail.com?subject=${encodeURIComponent('[StyleLab] Problem Report')}&body=${encodeURIComponent(body)}`
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
          <h2 className={styles.title}>Report a Problem</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        {done ? (
          <div className={styles.success}>
            <span className={styles.successIcon}>✓</span>
            <p className={styles.successTitle}>Report sent — thank you!</p>
            <p className={styles.successSub}>
              We'll investigate and follow up if we need more details.
            </p>
            <button className={styles.doneBtn} onClick={onClose}>Done</button>
          </div>
        ) : (
          <div className={styles.body}>
            <p className={styles.intro}>
              No technical knowledge needed — just describe what happened and we'll handle the rest.
            </p>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="crash-doing">
                What were you trying to do?
              </label>
              <textarea
                id="crash-doing"
                className={styles.textarea}
                placeholder="e.g. I was adding a photo to my closet…"
                value={doing}
                onChange={(e) => setDoing(e.target.value)}
                rows={3}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="crash-saw">
                What happened or what did you see?
              </label>
              <textarea
                id="crash-saw"
                className={styles.textarea}
                placeholder="e.g. The screen went blank / a spinner appeared and never stopped…"
                value={saw}
                onChange={(e) => setSaw(e.target.value)}
                rows={3}
              />
            </div>

            <button
              className={styles.diagToggle}
              onClick={() => setShowDiag((v) => !v)}
            >
              <span>{showDiag ? '▲' : '▼'}</span>
              What we'll include in the report
            </button>

            {showDiag && (
              <div className={styles.diagBox}>
                <div className={styles.diagItem}>
                  <span className={styles.diagDot} />
                  Browser &amp; device info (model, viewport, language)
                </div>
                <div className={styles.diagItem}>
                  <span className={styles.diagDot} />
                  Current screen &amp; app state
                </div>
                <div className={styles.diagItem}>
                  <span className={styles.diagDot} />
                  {errorCount} error{errorCount !== 1 ? 's' : ''} logged this session
                </div>
                {networkCount > 0 && (
                  <div className={styles.diagItem}>
                    <span className={styles.diagDot} />
                    {networkCount} network failure{networkCount !== 1 ? 's' : ''} logged
                  </div>
                )}
                <p className={styles.diagNote}>
                  No passwords, photos, or payment info are ever included.
                </p>
              </div>
            )}

            {error && <p className={styles.error}>{error}</p>}

            <button
              className={styles.submitBtn}
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? 'Sending…' : 'Send Report'}
            </button>
          </div>
        )}
      </div>
    </>
  )
}
