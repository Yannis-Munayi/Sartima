import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useWardrobeRecap } from '../hooks/useWardrobeRecap'
import { hasSeenRecapThisMonth, markRecapSeen } from '../services/recapSeen'
import { trackEvent } from '../services/firebase'

const MONTH_NAME = new Date().toLocaleString('en-US', { month: 'long' })

// Monthly "wardrobe recap" — Spotify-Wrapped-style reflection built from
// wearTracking.js data + the outfit log, surfaced once per month. Reuses the
// dot-row + insight-sentence visual language of ProfileScreen's
// StyleEvolutionChart, sourced from wear data instead of quiz sessions.
export default function WardrobeRecapCard() {
  const { user } = useAuth()
  const recap     = useWardrobeRecap(user)
  const [eligible, setEligible] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [sharing, setSharing] = useState(false)

  useEffect(() => {
    if (!user) { setEligible(false); return }
    hasSeenRecapThisMonth(user.uid).then((seen) => setEligible(!seen))
  }, [user])

  const shouldShow = !!(user && eligible && !dismissed && recap && recap.outfitsLogged > 0)

  useEffect(() => {
    if (shouldShow) trackEvent('recap_viewed', { outfitsLogged: recap.outfitsLogged, repeatRate: recap.repeatRate })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldShow])

  if (!shouldShow) return null

  function handleClose() {
    markRecapSeen(user.uid)
    setDismissed(true)
  }

  async function handleShare() {
    if (sharing) return
    setSharing(true)
    try {
      const { generateRecapShareCard, shareCardBlob } = await import('../services/shareCard')
      const blob = await generateRecapShareCard(recap, MONTH_NAME)
      await shareCardBlob(blob, {
        title:    `My ${MONTH_NAME} wardrobe recap`,
        text:     `My ${MONTH_NAME} wardrobe recap, from Sartima ✦`,
        fileName: `sartima-recap-${MONTH_NAME.toLowerCase()}.png`,
      })
      trackEvent('recap_shared')
    } catch {
      // non-fatal — sharing is best-effort
    } finally {
      setSharing(false)
    }
  }

  const photoUrl = recap.mostWornItem
    ? (recap.mostWornItem.prettifiedUrl ?? recap.mostWornItem.imageUrl ?? recap.mostWornItem.thumbnailUrl)
    : null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 250,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }} onClick={handleClose}>
      <div
        style={{
          width: '100%', maxWidth: 380,
          background: 'var(--bg-elevated)', borderRadius: 20,
          padding: '28px 22px', border: '1px solid var(--border)',
          textAlign: 'center',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--accent)', margin: '0 0 8px' }}>
          {MONTH_NAME} Recap
        </p>
        <h2 style={{ fontFamily: "'Cormorant Garamond', 'Playfair Display', serif", fontSize: 24, fontWeight: 600, color: 'var(--text)', margin: '0 0 20px' }}>
          Your wardrobe this month
        </h2>

        {photoUrl && (
          <div style={{ width: 96, height: 96, borderRadius: '50%', overflow: 'hidden', margin: '0 auto 12px', border: '3px solid var(--accent)' }}>
            <img src={photoUrl} alt={recap.mostWornItem.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        )}
        {recap.mostWornItem && (
          <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '0 0 20px' }}>
            Most worn: <strong>{recap.mostWornItem.name}</strong> ({recap.mostWornCount}×)
          </p>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-around', margin: '0 0 20px', padding: '16px 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
          <div>
            <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{recap.outfitsLogged}</p>
            <p style={{ fontSize: 11, color: 'var(--text-faint)', margin: 0 }}>outfits logged</p>
          </div>
          <div>
            <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{recap.uniqueItemsWorn}/{recap.totalClosetItems}</p>
            <p style={{ fontSize: 11, color: 'var(--text-faint)', margin: 0 }}>pieces worn</p>
          </div>
          <div>
            <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{recap.repeatRate}%</p>
            <p style={{ fontSize: 11, color: 'var(--text-faint)', margin: 0 }}>repeat rate</p>
          </div>
        </div>

        {recap.ghostCount > 0 && (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 20px', lineHeight: 1.5 }}>
            👻 {recap.ghostCount} closet {recap.ghostCount === 1 ? 'piece' : 'pieces'} went unworn this month.
          </p>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={handleShare}
            disabled={sharing}
            style={{
              flex: 1, padding: '13px 0',
              background: 'transparent', border: '1px solid var(--border-strong)', borderRadius: 6,
              color: 'var(--text-muted)', fontSize: 12, fontWeight: 600,
              letterSpacing: '1.5px', textTransform: 'uppercase', cursor: 'pointer',
            }}
          >
            {sharing ? '…' : '↗ Share'}
          </button>
          <button
            onClick={handleClose}
            style={{
              flex: 1, padding: '13px 0',
              background: 'var(--accent)', border: 'none', borderRadius: 6,
              color: '#0B0907', fontSize: 12, fontWeight: 700,
              letterSpacing: '1.5px', textTransform: 'uppercase', cursor: 'pointer',
            }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
