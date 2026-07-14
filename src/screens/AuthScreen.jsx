import { useState } from 'react'
import { sendPasswordResetEmail } from 'firebase/auth'
import { httpsCallable } from 'firebase/functions'
import { auth, functions } from '../services/firebase'
import { useAuth } from '../context/AuthContext'
import { useApp } from '../context/AppContext'
import LegalModal from '../components/LegalModal'
import { PRIVACY_POLICY, TERMS_OF_SERVICE, LEGAL_VERSION } from '../data/legalContent'
import styles from './AuthScreen.module.css'

// ── Password strength ─────────────────────────────────────────────────────────

function getStrength(pwd) {
  if (!pwd || pwd.length < 8) return 0
  let score = 0
  if (/[a-z]/.test(pwd)) score++
  if (/[A-Z]/.test(pwd)) score++
  if (/[0-9]/.test(pwd)) score++
  if (/[^a-zA-Z0-9]/.test(pwd)) score++
  return score // 1–4
}

const STRENGTH_LABEL = ['', 'Weak', 'Medium', 'Strong', 'Very strong']
const STRENGTH_COLOR = ['', '#e05252', '#f5a623', '#4caf50', '#4caf50']

function StrengthBar({ password }) {
  if (!password) return null
  const tooShort = password.length < 8
  const score    = tooShort ? 0 : getStrength(password)
  const barColor = score <= 1 ? '#e05252' : score === 2 ? '#f5a623' : '#4caf50'
  const label    = tooShort
    ? `${8 - password.length} more char${8 - password.length !== 1 ? 's' : ''} needed`
    : STRENGTH_LABEL[Math.min(score, 4)]

  return (
    <div className={styles.strengthWrap}>
      <div className={styles.strengthBars}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={styles.strengthSegment}
            style={{ background: !tooShort && score >= i ? barColor : 'rgba(255,255,255,0.1)' }}
          />
        ))}
      </div>
      <span
        className={styles.strengthLabel}
        style={{ color: tooShort ? 'rgba(255,255,255,0.25)' : STRENGTH_COLOR[Math.min(score, 4)] || STRENGTH_COLOR[1] }}
      >
        {label}
      </span>
    </div>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}

// ── Consent checkboxes (shared by signup form + global ConsentGate) ──────────

export function ConsentCheckboxes({ agreedToTerms, setAgreedToTerms, ageAffirmed, setAgeAffirmed, onOpenLegal }) {
  return (
    <div className={styles.consentGroup}>
      <label className={styles.consentRow}>
        <input
          type="checkbox"
          checked={agreedToTerms}
          onChange={(e) => setAgreedToTerms(e.target.checked)}
        />
        <span>
          I agree to the{' '}
          <button type="button" className={styles.legalLink} onClick={() => onOpenLegal('terms')}>Terms of Service</button>
          {' '}and{' '}
          <button type="button" className={styles.legalLink} onClick={() => onOpenLegal('privacy')}>Privacy Policy</button>.
        </span>
      </label>
      <label className={styles.consentRow}>
        <input
          type="checkbox"
          checked={ageAffirmed}
          onChange={(e) => setAgeAffirmed(e.target.checked)}
        />
        <span>I am at least 16 years old.</span>
      </label>
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function AuthScreen() {
  const { signup, login, signInWithGoogle } = useAuth()
  const { dispatch } = useApp()

  const [mode, setMode]             = useState('login') // 'login' | 'signup' | 'reset'
  const [name, setName]             = useState('')
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [confirm, setConfirm]       = useState('')
  const [gender, setGender]         = useState('both')
  const [error, setError]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [resetSent, setResetSent]         = useState(false)
  const [showPassword, setShowPassword]   = useState(false)
  const [showConfirm, setShowConfirm]     = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [ageAffirmed, setAgeAffirmed]     = useState(false)
  const [legalDoc, setLegalDoc]           = useState(null) // 'terms' | 'privacy' | null

  function switchMode(next) {
    setMode(next)
    setError('')
    setConfirm('')
    setResetSent(false)
    setShowPassword(false)
    setShowConfirm(false)
  }

  async function handleGoogle() {
    setError('')
    setGoogleLoading(true)
    try {
      await signInWithGoogle()
      // New Google accounts are caught by the global ConsentGate (App.jsx),
      // which records ToS/age consent before the app becomes usable.
      dispatch({ type: 'AUTH_FLOW_DONE' })
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

    if (mode === 'signup') {
      if (!name.trim()) return setError('Please enter your name.')
      if (password.length < 8) return setError('Password must be at least 8 characters.')
      if (getStrength(password) < 2) return setError('Password is too weak — add uppercase letters, numbers, or symbols.')
      if (password !== confirm) return setError('Passwords do not match.')
      if (!agreedToTerms) return setError('Please agree to the Terms of Service and Privacy Policy.')
      if (!ageAffirmed) return setError('Please confirm you are at least 16 years old.')

      setLoading(true)
      let emailValid = true
      try {
        const validateFn = httpsCallable(functions, 'validateEmail')
        const { data } = await validateFn({ email })
        if (!data.valid) {
          setError("This email address doesn't appear to exist. Please use a real email.")
          emailValid = false
        }
      } catch {
        // If the check fails (network/cold-start), proceed — Firebase email
        // verification acts as the fallback gate for unreachable addresses.
      }

      if (!emailValid) {
        setLoading(false)
        return
      }

      try {
        await signup(email, password, name.trim(), { legalVersion: LEGAL_VERSION, ageAffirmed: true })
        dispatch({ type: 'SET_GENDER', gender })
        // A verification email was sent in the background (VerifyEmailBanner
        // nudges until confirmed). Go straight to the onboarding wizard —
        // brand-new accounts always need it.
        dispatch({ type: 'GO_TO_ONBOARDING' })
      } catch (err) {
        setError(friendlyError(err.code))
      } finally {
        setLoading(false)
      }
      return
    }

    // Login flow
    setLoading(true)
    try {
      await login(email, password)
      dispatch({ type: 'AUTH_FLOW_DONE' })
    } catch (err) {
      setError(friendlyError(err.code))
    } finally {
      setLoading(false)
    }
  }

  function friendlyError(code) {
    switch (code) {
      case 'auth/email-already-in-use':  return 'That email is already registered. Try signing in.'
      case 'auth/invalid-email':         return 'Please enter a valid email address.'
      case 'auth/weak-password':         return 'Password must be at least 8 characters.'
      case 'auth/too-many-requests':     return 'Too many attempts. Please wait a few minutes and try again.'
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':    return 'Incorrect email or password.'
      default:                           return 'Something went wrong. Please try again.'
    }
  }

  return (
    <div className={styles.flow}>
      <div className={styles.dots}>
        <span className={`${styles.dot} ${styles.dotActive}`} />
      </div>

      <div className={styles.iconBadge}>
        {mode === 'login' ? '🔑' : mode === 'reset' ? '🔒' : '✨'}
      </div>

      <h1 className={styles.title}>
        {mode === 'login'
          ? <>Welcome<br /><em>back</em></>
          : mode === 'reset'
            ? <>Reset your<br /><em>password</em></>
            : <>Create your<br /><em>account</em></>}
      </h1>
      <p className={styles.sub}>
        {mode === 'login'
          ? 'Sign in to continue your style journey.'
          : mode === 'reset'
            ? "Enter your account email and we'll send you a link to set a new password."
            : 'Save your results and track your style over time.'}
      </p>

      <form className={styles.form} onSubmit={handleSubmit}>
        {mode === 'signup' && (
          <>
            <div className={styles.field}>
              <label>Name</label>
              <input
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>

            <div className={styles.field}>
              <label>Shop for</label>
              <div className={styles.genderRow}>
                {[{ id: 'men', label: 'Men' }, { id: 'women', label: 'Women' }, { id: 'both', label: 'Both' }].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={`${styles.genderPill} ${gender === opt.id ? styles.genderPillActive : ''}`}
                    onClick={() => setGender(opt.id)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

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

        {mode !== 'reset' && (
          <div className={styles.field}>
            <label>Password</label>
            <div className={styles.passwordWrap}>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder={mode === 'signup' ? 'At least 8 characters' : '••••••••'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
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
            {mode === 'signup' && <StrengthBar password={password} />}
          </div>
        )}

        {mode === 'login' && (
          <div className={styles.forgotRow}>
            <button
              type="button"
              className={styles.forgotBtn}
              onClick={() => switchMode('reset')}
            >
              Forgot password?
            </button>
          </div>
        )}

        {mode === 'signup' && (
          <div className={styles.field}>
            <label>Confirm password</label>
            <div className={styles.passwordWrap}>
              <input
                type={showConfirm ? 'text' : 'password'}
                placeholder="Repeat your password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
              />
              <button
                type="button"
                className={styles.eyeBtn}
                onClick={() => setShowConfirm((v) => !v)}
                aria-label={showConfirm ? 'Hide password' : 'Show password'}
              >
                {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>
        )}

        {mode === 'signup' && (
          <ConsentCheckboxes
            agreedToTerms={agreedToTerms}
            setAgreedToTerms={setAgreedToTerms}
            ageAffirmed={ageAffirmed}
            setAgeAffirmed={setAgeAffirmed}
            onOpenLegal={setLegalDoc}
          />
        )}

        {error && <p className={styles.error}>{error}</p>}

        {resetSent && (
          <p className={styles.successMsg}>
            If an account exists for <strong>{email}</strong>, a reset link is on
            its way. Check your inbox (and spam folder).
          </p>
        )}

        <button type="submit" className={styles.submitBtn} disabled={loading || (mode === 'reset' && resetSent)}>
          {loading
            ? 'Please wait…'
            : mode === 'login' ? 'Sign in' : mode === 'reset' ? 'Send reset link' : 'Create account'}
        </button>
      </form>

      {mode !== 'reset' && (
        <>
          <div className={styles.divider}>
            <span className={styles.dividerLine} />
            <span className={styles.dividerText}>or</span>
            <span className={styles.dividerLine} />
          </div>

          <button
            type="button"
            className={styles.googleBtn}
            onClick={handleGoogle}
            disabled={googleLoading}
          >
            <GoogleIcon />
            {googleLoading ? 'Signing in…' : 'Continue with Google'}
          </button>
        </>
      )}

      <div className={styles.footerRow}>
        {mode === 'login' ? (
          <span>
            No account?{' '}
            <button className={styles.switchBtn} onClick={() => switchMode('signup')}>
              Create one
            </button>
          </span>
        ) : mode === 'reset' ? (
          <span>
            Remember your password?{' '}
            <button className={styles.switchBtn} onClick={() => switchMode('login')}>
              Sign in
            </button>
          </span>
        ) : (
          <span>
            Already have one?{' '}
            <button className={styles.switchBtn} onClick={() => switchMode('login')}>
              Sign in
            </button>
          </span>
        )}
      </div>

      <button
        className={styles.guestBtn}
        onClick={() => dispatch({ type: 'AUTH_FLOW_DONE' })}
      >
        Continue as guest
      </button>

      <div className={styles.legalFooter}>
        <button type="button" className={styles.legalLink} onClick={() => setLegalDoc('terms')}>Terms</button>
        <span aria-hidden="true"> · </span>
        <button type="button" className={styles.legalLink} onClick={() => setLegalDoc('privacy')}>Privacy</button>
      </div>

      <LegalModal
        doc={legalDoc === 'terms' ? TERMS_OF_SERVICE : legalDoc === 'privacy' ? PRIVACY_POLICY : null}
        onClose={() => setLegalDoc(null)}
      />
    </div>
  )
}
