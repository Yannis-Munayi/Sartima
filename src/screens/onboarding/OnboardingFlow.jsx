import { useState } from 'react'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../services/firebase'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import OccupationScreen    from './OccupationScreen'
import BrandsScreen        from './BrandsScreen'
import ReferralScreen      from './ReferralScreen'
import ShoppingEmailScreen from './ShoppingEmailScreen'
import styles from './OnboardingFlow.module.css'

const STEPS = ['occupation', 'brands', 'referral', 'email']

export default function OnboardingFlow() {
  const { user }      = useAuth()
  const { dispatch }  = useApp()

  const [step, setStep]             = useState(0)
  const [occupation, setOccupation] = useState('')
  const [brands, setBrands]         = useState([])
  const [referral, setReferral]     = useState('')
  const [saving, setSaving]         = useState(false)

  async function finish(shoppingEmail) {
    setSaving(true)
    try {
      if (user) {
        await setDoc(doc(db, 'users', user.uid), {
          occupation,
          preferredBrands: brands,
          referralSource:  referral,
          shoppingEmail:   shoppingEmail ?? null,
          onboardingComplete: true,
          updatedAt: serverTimestamp(),
        }, { merge: true })
      }
    } catch {
      // non-fatal — still proceed to app
    } finally {
      setSaving(false)
      dispatch({ type: 'SET_ONBOARDING_COMPLETE' })
    }
  }

  function next() { setStep((s) => Math.min(s + 1, STEPS.length - 1)) }

  async function skip() {
    try {
      if (user) {
        await setDoc(doc(db, 'users', user.uid), {
          onboardingComplete: true,
          updatedAt: serverTimestamp(),
        }, { merge: true })
      }
    } catch {
      // non-fatal
    }
    dispatch({ type: 'SET_ONBOARDING_COMPLETE' })
  }

  return (
    <div className={styles.flow}>
      {/* Progress dots */}
      <div className={styles.dots}>
        {STEPS.map((_, i) => (
          <span
            key={i}
            className={`${styles.dot} ${i <= step ? styles.dotActive : ''}`}
          />
        ))}
      </div>

      {step === 0 && (
        <OccupationScreen
          value={occupation}
          onSelect={(val) => { setOccupation(val); next() }}
          onSkip={next}
        />
      )}
      {step === 1 && (
        <BrandsScreen
          selected={brands}
          onSelect={setBrands}
          onNext={next}
          onSkip={next}
        />
      )}
      {step === 2 && (
        <ReferralScreen
          onSelect={(val) => { setReferral(val); next() }}
          onSkip={next}
        />
      )}
      {step === 3 && (
        <ShoppingEmailScreen
          userEmail={user?.email ?? ''}
          onFinish={finish}
          saving={saving}
        />
      )}

      <button className={styles.skipAll} onClick={skip}>
        Skip all →
      </button>
    </div>
  )
}
