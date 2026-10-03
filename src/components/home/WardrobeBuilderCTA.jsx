import Icon from '../Icon'
import styles from '../../screens/HomeScreen.module.css'

// Shares the feature-card pattern with GuideLauncher (guideLaunch* classes)
// so every home-screen CTA card reads the same.
export default function WardrobeBuilderCTA({ navigate }) {
  return (
    <section className={styles.section}>
      <button className={styles.guideLaunchBtn} onClick={() => navigate('wardrobe-builder')}>
        <div className={styles.guideLaunchInner}>
          <span className={styles.guideLaunchIcon}><Icon name="bag" size={18} /></span>
          <div>
            <span className={styles.guideLaunchTitle}>Shop Scout</span>
            <span className={styles.guideLaunchSub}>Pick pieces and a budget, get the brands worth buying</span>
          </div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"
          stroke="currentColor" strokeWidth="2" className={styles.guideLaunchChevron}>
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    </section>
  )
}
