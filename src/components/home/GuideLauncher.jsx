import styles from '../../screens/HomeScreen.module.css'

// Note: distinct from src/components/GuideLauncherButton.jsx — this is the
// Home-screen "take the app tour" card, not the shared launcher button.
export default function GuideLauncher({ onStart }) {
  return (
    <section className={styles.section}>
      <button className={styles.guideLaunchBtn} onClick={() => onStart('full')}>
        <div className={styles.guideLaunchInner}>
          <span className={styles.guideLaunchIcon}>✦</span>
          <div>
            <span className={styles.guideLaunchTitle}>Take the app tour</span>
            <span className={styles.guideLaunchSub}>A complete walkthrough of every feature</span>
          </div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0, opacity: 0.4 }}>
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    </section>
  )
}
