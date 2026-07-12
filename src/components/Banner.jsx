import styles from './Banner.module.css'

// Generic slim bottom banner — used by AnalyticsConsentBanner and
// LegalUpdateBanner so both share one markup/CSS shape.
export default function Banner({ message, actions }) {
  return (
    <div className={styles.banner} role="status">
      <p className={styles.message}>{message}</p>
      <div className={styles.actions}>
        {actions.map((a) => (
          <button
            key={a.label}
            className={a.primary ? styles.primaryBtn : styles.secondaryBtn}
            onClick={a.onClick}
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  )
}
