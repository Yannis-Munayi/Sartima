import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import LegalModal from '../components/LegalModal'
import { PRIVACY_POLICY, TERMS_OF_SERVICE, LEGAL_VERSION } from '../data/legalContent'
import { ConsentCheckboxes } from './AuthScreen'
import Icon from '../components/Icon'
import styles from './AuthScreen.module.css'

/**
 * Full-screen consent gate, rendered by AppShell whenever a signed-in
 * account has no recorded ToS/age consent (new Google sign-ins, legacy
 * accounts that predate consent capture, or failed signup writes).
 * Recording consent here always stores the current LEGAL_VERSION, so the
 * legal-update banner is unnecessary for gated users.
 */
export default function ConsentGate({ onDone }) {
  const { user, recordConsent } = useAuth()

  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [ageAffirmed, setAgeAffirmed]     = useState(false)
  const [saving, setSaving]               = useState(false)
  const [legalDoc, setLegalDoc]           = useState(null) // 'terms' | 'privacy' | null

  async function handleConfirm() {
    setSaving(true)
    try {
      if (user) {
        await recordConsent(user.uid, { legalVersion: LEGAL_VERSION, ageAffirmed: true })
      }
    } catch {
      // Non-fatal: the user did consent — if the write failed the gate
      // simply reappears next session until it sticks.
    } finally {
      setSaving(false)
    }
    onDone()
  }

  return (
    <div className={styles.flow}>
      <div className={styles.dots}>
        <span className={`${styles.dot} ${styles.dotActive}`} />
      </div>

      <div className={styles.iconBadge}><Icon name="shield" size={22} /></div>

      <h1 className={styles.title}>One last<br /><em>thing</em></h1>
      <p className={styles.sub}>Please confirm the following to keep using your account.</p>

      <ConsentCheckboxes
        agreedToTerms={agreedToTerms}
        setAgreedToTerms={setAgreedToTerms}
        ageAffirmed={ageAffirmed}
        setAgeAffirmed={setAgeAffirmed}
        onOpenLegal={setLegalDoc}
      />

      <button
        type="button"
        className={styles.submitBtn}
        disabled={!agreedToTerms || !ageAffirmed || saving}
        onClick={handleConfirm}
      >
        {saving ? 'Please wait…' : 'Continue'}
      </button>

      <LegalModal
        doc={legalDoc === 'terms' ? TERMS_OF_SERVICE : legalDoc === 'privacy' ? PRIVACY_POLICY : null}
        onClose={() => setLegalDoc(null)}
      />
    </div>
  )
}
