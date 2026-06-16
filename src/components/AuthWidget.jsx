import { useAuth } from '../context/AuthContext'
import { useApp } from '../context/AppContext'
import styles from './AuthWidget.module.css'

/**
 * Reusable auth bar for tab screen headers.
 * - Signed out: "Sign in" button → auth screen
 * - Signed in:  avatar pill + "Sign out" button
 */
export default function AuthWidget() {
  const { user, logout } = useAuth()
  const { dispatch }     = useApp()

  async function handleSignOut() {
    await logout()
  }

  if (!user) {
    return (
      <button
        className={styles.signInBtn}
        onClick={() => dispatch({ type: 'GO_TO_AUTH' })}
      >
        Sign in
      </button>
    )
  }

  return (
    <div className={styles.row}>
      <div className={styles.pill}>
        <span className={styles.avatar}>
          {(user.displayName ?? user.email ?? '?')[0].toUpperCase()}
        </span>
        <span className={styles.name}>
          {user.displayName?.split(' ')[0] ?? user.email?.split('@')[0] ?? 'You'}
        </span>
      </div>
      <button className={styles.signOutBtn} onClick={handleSignOut}>
        Sign out
      </button>
    </div>
  )
}
