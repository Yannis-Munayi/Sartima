import Banner from './Banner'

export default function LegalUpdateBanner({ onReview, onAcknowledge }) {
  return (
    <Banner
      message="We've updated our Terms of Service and Privacy Policy."
      actions={[
        { label: 'Review', onClick: onReview },
        { label: 'Got it', onClick: onAcknowledge, primary: true },
      ]}
    />
  )
}
