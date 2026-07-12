import { useState } from 'react'
import Banner from './Banner'
import { getAnalyticsConsent, setAnalyticsConsent } from '../services/firebase'

export default function AnalyticsConsentBanner() {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed || getAnalyticsConsent() !== null) return null

  function choose(granted) {
    setAnalyticsConsent(granted)
    setDismissed(true)
  }

  return (
    <Banner
      message="Sartima uses analytics cookies to understand app usage. You can change this anytime in Profile → Settings."
      actions={[
        { label: 'Decline', onClick: () => choose(false) },
        { label: 'Accept', onClick: () => choose(true), primary: true },
      ]}
    />
  )
}
