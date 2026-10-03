import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import AuthWidget from '../components/AuthWidget'
import styles from './screens.module.css'

export default function WelcomeScreen() {
  const { dispatch } = useApp()
  const { user }     = useAuth()

  return (
    <div className={styles.welcomeWrapper}>
      <div className={styles.welcomeGlow} />

      {/* Top-right: auth widget */}
      <div className={styles.welcomeTopBar}>
        <AuthWidget />
      </div>

      <div className={styles.welcomeContent}>
        <img className={styles.logoMark} src="/logo.png" alt="Sartima" width="64" height="64" />
        <h1 className={styles.welcomeTitle}>
          Find your<br />
          <span className={styles.accent}>style.</span>
        </h1>
        <p className={styles.welcomeSub}>
          Answer a few questions about what you're drawn to — we'll map your aesthetic and build your seasonal wardrobe blueprint.
        </p>
        <div className={styles.featurePills}>
          <span className={styles.pill}>Season-aware</span>
          <span className={styles.pill}>51 aesthetics</span>
          <span className={styles.pill}>8 categories</span>
        </div>
        <button
          className={styles.primaryBtn}
          onClick={() => dispatch({ type: 'GO_TO_SEASONS' })}
        >
          Get started
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
        <p className={styles.welcomeNote}>
          Takes about 5 minutes{user ? ' · Results auto-saved' : ' · Results saved when signed in'}
        </p>
      </div>
    </div>
  )
}
