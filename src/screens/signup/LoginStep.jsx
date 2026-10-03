import { useState } from 'react'
import { sendPasswordResetEmail } from 'firebase/auth'
import { auth } from '../../services/firebase'
import { useAuth } from '../../context/AuthContext'
import { EyeIcon, EyeOffIcon, GoogleIcon, friendlyError } from '../AuthScreen'
import Icon from '../../components/Icon'
import styles from '../AuthScreen.module.css'

// Minimal login-only surface reached via the "Log in" link on every signup
// step. Deliberately doesn't reuse full AuthScreen — that component also
// offers its own signup mode + "Continue as guest" button, which would
// duplicate/conflict with this flow's own account-creation steps and guest
// escape hatch.
export default function LoginStep({ onDone, onBack }) {
  const { login, signInWithGoogle } = useAuth()

  const [mode, setMode]           = useState('login') // 'login' | 'reset'
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [error, setError]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function handleGoogle() {
    setError('')
    setGoogleLoading(true)
    try {
      await signInWithGoogle()
      onDone()
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError('Google sign-in failed. Please try again.')
      }
    } finally {
      setGoogleLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (mode === 'reset') {
      setLoading(true)
      try {
        await sendPasswordResetEmail(auth, email)
        setResetSent(true)
      } catch (err) {
        if (err.code === 'auth/user-not-found') {
          setResetSent(true) // don't reveal whether the account exists
        } else {
          setError(friendlyError(err.code))
        }
      } finally {
        setLoading(false)
      }
      return
    }

    setLoading(true)
    try {
      await login(email, password)
      onDone()
    } catch (err) {
      setError(friendlyError(err.code))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.flow} style={{ padding: 'var(--space-6) var(--space-6) var(--space-10)' }}>
      <button className={styles.forgotBtn} style={{ alignSelf: 'flex-start', marginBottom: 'var(--space-5)' }} onClick={onBack}>
        ← Back
      </button>

      <div className={styles.iconBadge}><Icon name={mode === 'login' ? 'key' : 'lock'} size={22} /></div>
      <h1 className={styles.title}>
        {mode === 'login' ? <>Welcome<br /><em>back</em></> : <>Reset your<br /><em>password</em></>}
      </h1>
      <p className={styles.sub}>
        {mode === 'login'
          ? 'Sign in to continue your style journey.'
          : "Enter your account email and we'll send you a link to set a new password."}
      </p>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label>Email</label>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        {mode === 'login' && (
          <div className={styles.field}>
            <label>Password</label>
            <div className={styles.passwordWrap}>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className={styles.eyeBtn}
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>
        )}

        {mode === 'login' && (
          <div className={styles.forgotRow}>
            <button type="button" className={styles.forgotBtn} onClick={() => { setMode('reset'); setError(''); setResetSent(false) }}>
              Forgot password?
            </button>
          </div>
        )}

        {error && <p className={styles.error}>{error}</p>}

        {resetSent && (
          <p className={styles.successMsg}>
            If an account exists for <strong>{email}</strong>, a reset link is on
            its way. Check your inbox (and spam folder).
          </p>
        )}

        <button type="submit" className={styles.submitBtn} disabled={loading || (mode === 'reset' && resetSent)}>
          {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Send reset link'}
        </button>
      </form>

      {mode === 'reset' ? (
        <div className={styles.footerRow}>
          <button className={styles.switchBtn} onClick={() => { setMode('login'); setError('') }}>
            ← Back to sign in
          </button>
        </div>
      ) : (
        <>
          <div className={styles.divider}>
            <span className={styles.dividerLine} />
            <span className={styles.dividerText}>or</span>
            <span className={styles.dividerLine} />
          </div>
          <button type="button" className={styles.googleBtn} onClick={handleGoogle} disabled={googleLoading}>
            <GoogleIcon />
            {googleLoading ? 'Signing in…' : 'Continue with Google'}
          </button>
        </>
      )}
    </div>
  )
}
