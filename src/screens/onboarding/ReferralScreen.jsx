import styles from './OnboardingStep.module.css'

const SOURCES = [
  { id: 'instagram',  label: 'Instagram',  emoji: '📸' },
  { id: 'tiktok',     label: 'TikTok',     emoji: '🎵' },
  { id: 'friend',     label: 'Friend',     emoji: '👤' },
  { id: 'google',     label: 'Google',     emoji: '🔍' },
  { id: 'app_store',  label: 'App Store',  emoji: '📱' },
  { id: 'other',      label: 'Other',      emoji: '✦'  },
]

export default function ReferralScreen({ onSelect, onSkip }) {
  return (
    <div className={styles.step}>
      <div className={styles.iconBadge}>📡</div>
      <h1 className={styles.title}>
        How did you<br />hear <em>about us?</em>
      </h1>
      <p className={styles.sub}>Help us understand where our community comes from.</p>

      <div className={styles.sourceGrid}>
        {SOURCES.map((src) => (
          <button
            key={src.id}
            className={styles.sourceBtn}
            onClick={() => onSelect(src.id)}
          >
            <span className={styles.sourceEmoji}>{src.emoji}</span>
            <span className={styles.sourceLabel}>{src.label}</span>
          </button>
        ))}
      </div>

      <button className={styles.skipBtn} onClick={onSkip}>Skip</button>
    </div>
  )
}
