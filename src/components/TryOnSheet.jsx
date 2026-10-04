import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCloset } from '../context/ClosetContext'
import { useAvatar } from '../hooks/useAvatar'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { useWishlist } from '../context/WishlistContext'
import { useSubscription } from '../context/SubscriptionContext'
import { generateTryOnResult, TRYON_CATEGORIES } from '../services/tryOn'
import { purchaseTryOnPackSession } from '../services/subscriptionService'
import { recordSignal } from '../services/interestTracker'
import styles from './TryOnSheet.module.css'
import Icon from './Icon'

const MAX_PIECES = 3

const LOADING_STAGES = [
  'Analyzing your proportions…',
  'Fitting the garment…',
  'Finishing details…',
]

function LoadingView({ items, avatarUrl }) {
  const [stage, setStage] = useState(0)
  const primaryPhoto = items[0]?.prettifiedUrl ?? items[0]?.imageUrl ?? items[0]?.thumbnailUrl

  useEffect(() => {
    const stageTimer = setInterval(() => {
      setStage((s) => Math.min(s + 1, LOADING_STAGES.length - 1))
    }, 7000)
    return () => clearInterval(stageTimer)
  }, [])

  return (
    <div className={styles.loadingView}>
      <div className={styles.loadingPreview}>
        <div className={styles.loadingPreviewHalf}>
          {avatarUrl && <img src={avatarUrl} alt="You" className={styles.loadingPreviewImg} />}
          <span className={styles.loadingPreviewLabel}>You</span>
        </div>
        <div className={styles.loadingPreviewDivider} />
        <div className={styles.loadingPreviewHalf}>
          {primaryPhoto && <img src={primaryPhoto} alt="Outfit" className={styles.loadingPreviewImg} />}
          <span className={styles.loadingPreviewLabel}>
            {items.length > 1 ? `${items.length} pieces` : 'Garment'}
          </span>
        </div>
      </div>
      <div className={styles.loadingInfo}>
        <div className={styles.loadingBar}>
          <div className={styles.loadingBarIndeterminate} />
        </div>
        <p className={styles.loadingStage}>{LOADING_STAGES[stage]}</p>
        <p className={styles.loadingHint}>
          {items.length > 1
            ? `${items.length} pieces · ~${items.length * 20}s · Results are cached`
            : 'First time takes ~20s · Results are cached'}
        </p>
      </div>
    </div>
  )
}

function ClosetPicker({ selectedIds, onSelect, onClose }) {
  const { closetItems } = useCloset()
  useEscapeKey(onClose)
  const available = closetItems.filter(
    (i) =>
      TRYON_CATEGORIES.includes(i.category) &&
      !selectedIds.has(i.id) &&
      (i.imageUrl || i.thumbnailUrl)  // only items that have a photo
  )

  return (
    <div className={styles.picker}>
      <div className={styles.pickerHeader}>
        <p className={styles.pickerTitle}>Add a piece</p>
        <button className={styles.pickerCloseBtn} onClick={onClose}>✕</button>
      </div>
      {available.length === 0 ? (
        <p className={styles.pickerEmpty}>No more items to add from your closet.</p>
      ) : (
        <div className={styles.pickerGrid}>
          {available.map((item) => {
            const photo = item.prettifiedUrl ?? item.thumbnailUrl ?? item.imageUrl
            return (
              <button key={item.id} className={styles.pickerItem} onClick={() => onSelect(item)}>
                {photo && <img src={photo} alt={item.name} className={styles.pickerItemImg} />}
                <span className={styles.pickerItemName}>{item.name}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function TryOnSheet({ item, onClose, onSaved }) {
  const { user }   = useAuth()
  const { avatarUrl, avatarUpdatedAt, displayUrl, uploadAvatar, deleteAvatar, uploading, prettifying, prettifyFailed, uploadError } = useAvatar()
  const { saveOutfitBoard } = useWishlist()
  const { isPro }  = useSubscription()

  const [selectedItems, setSelectedItems] = useState([item])
  const [showPicker, setShowPicker]       = useState(false)
  const [phase, setPhase]                 = useState('idle')   // idle | loading | result | error
  const [resultUrl, setResultUrl]         = useState(null)
  const [errorMessage, setErrorMessage]   = useState(null)
  const [outOfCredits, setOutOfCredits]   = useState(false)
  const [buyingCredits, setBuyingCredits] = useState(false)
  const [saved, setSaved]                 = useState(false)
  useEscapeKey(onClose)

  const fileInputRef = useRef(null)
  const canTryOn     = selectedItems.length > 0 && !!avatarUrl
  const selectedIds  = new Set(selectedItems.map((i) => i.id))

  // Auto-generate once avatar is ready
  useEffect(() => {
    if (canTryOn && phase === 'idle') handleGenerate()
  }, [canTryOn])  // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAvatarFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    await uploadAvatar(file)
  }

  async function handleGenerate() {
    if (!avatarUrl || selectedItems.length === 0) return
    const missingImage = selectedItems.find((i) => !i.imageUrl && !i.thumbnailUrl)
    if (missingImage) {
      setErrorMessage(`"${missingImage.name}" has no photo — remove it and try again.`)
      setPhase('error')
      return
    }
    setPhase('loading')
    setResultUrl(null)
    setErrorMessage(null)
    setOutOfCredits(false)
    setSaved(false)
    setShowPicker(false)
    try {
      const url = await generateTryOnResult(user.uid, selectedItems, avatarUrl, avatarUpdatedAt)
      setResultUrl(url)
      setPhase('result')
      for (const tried of selectedItems) {
        recordSignal(user, 'tryOn', { product: tried })
      }
    } catch (err) {
      const message  = err?.message ?? ''
      const code     = err?.code ?? message
      if (code.includes('deadline-exceeded') || code.includes('timeout')) {
        setErrorMessage('Generation timed out — tap Try Again.')
      } else if (code.includes('invalid-argument')) {
        setErrorMessage("This item can't be used for try-on.")
      } else if (code.includes('resource-exhausted') && message.includes('limit_tryOns')) {
        setOutOfCredits(true)
        setErrorMessage("You've used all your Try-On credits this month.")
      } else if (code.includes('resource-exhausted')) {
        setErrorMessage('Please wait a moment before generating again.')
      } else {
        setErrorMessage('Generation failed. Check your connection and try again.')
      }
      setPhase('error')
    }
  }

  async function handleBuyCredits() {
    setBuyingCredits(true)
    try {
      await purchaseTryOnPackSession()
    } catch {
      setBuyingCredits(false)
    }
  }

  function handleAddItem(newItem) {
    if (!newItem.imageUrl && !newItem.thumbnailUrl) return  // item has no photo — skip silently
    if (selectedIds.has(newItem.id)) return                 // already selected
    setSelectedItems((prev) => [...prev, newItem])
    setShowPicker(false)
    setPhase((p) => (p === 'result' ? 'idle' : p))
    setResultUrl(null)
  }

  function handleRemoveItem(id) {
    setSelectedItems((prev) => prev.filter((i) => i.id !== id))
    setPhase((p) => (p === 'result' ? 'idle' : p))
    setResultUrl(null)
  }

  function handleSave() {
    if (!resultUrl) return
    const name = selectedItems.length === 1
      ? selectedItems[0].name
      : `${selectedItems.length}-piece look`
    saveOutfitBoard({
      id:        `tryon-${selectedItems.map((i) => i.id).join('-')}-${Date.now()}`,
      name,
      aesthetic: '',
      items:     selectedItems.map((i) => ({ ...i, tryOnUrl: resultUrl })),
      tryOnUrl:  resultUrl,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    setSaved(true)
    onSaved?.()
  }

  const headerTitle = selectedItems.length === 1 ? selectedItems[0].name : 'Virtual Try-On'
  const headerBrand = selectedItems.length === 1 ? selectedItems[0].brand : null

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.handle} />
          <div className={styles.headerRow}>
            <div>
              <h2 className={styles.title}>{headerTitle}</h2>
              {headerBrand && <p className={styles.brand}>{headerBrand}</p>}
            </div>
            <button className={styles.closeBtn} onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleAvatarFile}
        />

        {/* Body */}
        <div className={styles.body}>

          {/* No avatar — upload inline */}
          {!avatarUrl && (
            <div className={styles.noAvatar}>
              <p className={styles.noAvatarEmoji}><Icon name="user" size={24} /></p>
              <p className={styles.noAvatarTitle}>Add a photo of yourself</p>
              <p className={styles.noAvatarSub}>
                Upload a full-body photo in fitted clothing. The AI will dress you in the selected items.
              </p>
              <button
                className={styles.uploadAvatarBtn}
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || prettifying}
              >
                {uploading ? 'Uploading…' : prettifying ? 'Removing background…' : '+ Upload Photo'}
              </button>
              {uploadError && <p className={styles.uploadError}>{uploadError}</p>}
            </div>
          )}

          {/* Avatar controls — hidden while loading or showing result */}
          {avatarUrl && phase !== 'loading' && phase !== 'result' && (
            <div className={styles.avatarControls}>
              <div className={styles.avatarThumbWrap}>
                <img src={displayUrl ?? avatarUrl} alt="Your photo" className={styles.avatarThumb} />
                {prettifying && <div className={styles.avatarThumbOverlay}>Removing bg…</div>}
              </div>
              {prettifyFailed && (
                <p className={styles.prettifyWarning}>Background removal failed — generation may be less accurate.</p>
              )}
              {uploadError && <p className={styles.uploadError}>{uploadError}</p>}
              <div className={styles.avatarControlBtns}>
                <p className={styles.avatarControlLabel}>Your photo</p>
                <div className={styles.avatarControlRow}>
                  <button
                    className={styles.avatarChangeBtn}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading || prettifying}
                  >
                    Change
                  </button>
                  <button
                    className={styles.avatarDeleteBtn}
                    onClick={deleteAvatar}
                    disabled={uploading || prettifying}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Pieces strip — visible whenever avatar exists and not loading */}
          {avatarUrl && phase !== 'loading' && (
            <div className={styles.piecesStrip}>
              {selectedItems.map((si) => {
                const photo = si.prettifiedUrl ?? si.thumbnailUrl ?? si.imageUrl
                return (
                  <div key={si.id} className={styles.pieceThumb}>
                    {photo && <img src={photo} alt={si.name} className={styles.pieceThumbImg} />}
                    {selectedItems.length > 1 && (
                      <button
                        className={styles.pieceRemoveBtn}
                        onClick={() => handleRemoveItem(si.id)}
                        aria-label={`Remove ${si.name}`}
                      >
                        ×
                      </button>
                    )}
                  </div>
                )
              })}
              {selectedItems.length < MAX_PIECES && !showPicker && (
                <button
                  className={styles.addPieceBtn}
                  onClick={() => setShowPicker(true)}
                  disabled={uploading || prettifying}
                  title={uploading || prettifying ? 'Wait for photo to finish uploading' : 'Add a piece'}
                >
                  +
                </button>
              )}
            </div>
          )}

          {/* Closet picker */}
          {showPicker && (
            <ClosetPicker
              selectedIds={selectedIds}
              onSelect={handleAddItem}
              onClose={() => setShowPicker(false)}
            />
          )}

          {/* Loading */}
          {phase === 'loading' && (
            <LoadingView items={selectedItems} avatarUrl={displayUrl ?? avatarUrl} />
          )}

          {/* Result */}
          {phase === 'result' && resultUrl && (
            <div className={styles.resultView}>
              <div className={styles.resultImgWrap}>
                <img src={resultUrl} alt="Virtual try-on" className={styles.resultImg} />
              </div>
            </div>
          )}

          {/* Error */}
          {phase === 'error' && (
            <div className={styles.errorView}>
              <p className={styles.errorEmoji}><Icon name="alert" size={24} /></p>
              <p className={styles.errorTitle}>{outOfCredits ? 'Out of Try-On credits' : 'Generation failed'}</p>
              <p className={styles.errorSub}>{errorMessage ?? 'Check your connection and try again.'}</p>
              {outOfCredits && isPro ? (
                <button className={styles.retryBtn} onClick={handleBuyCredits} disabled={buyingCredits}>
                  {buyingCredits ? 'Redirecting…' : 'Buy 30 more — $2.99'}
                </button>
              ) : (
                <button className={styles.retryBtn} onClick={handleGenerate}>Try Again</button>
              )}
            </div>
          )}

          {/* Idle — shown after adding/removing pieces (manual trigger) */}
          {phase === 'idle' && canTryOn && !showPicker && (
            <div className={styles.idleView}>
              <div className={styles.idlePreview}>
                {(() => {
                  const photo = selectedItems[0]?.prettifiedUrl ?? selectedItems[0]?.imageUrl ?? selectedItems[0]?.thumbnailUrl
                  return photo ? <img src={photo} alt={selectedItems[0].name} className={styles.idleGarmentImg} /> : null
                })()}
              </div>
              <button className={styles.generateBtn} onClick={handleGenerate}>
                ✦ Generate Try-On
              </button>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {phase === 'result' && (
          <div className={styles.footer}>
            <button className={styles.regenerateBtn} onClick={handleGenerate}>
              ↺ Regenerate
            </button>
            <button
              className={`${styles.saveBtn} ${saved ? styles.saveBtnSaved : ''}`}
              onClick={handleSave}
              disabled={saved}
            >
              {saved ? 'Saved' : 'Save look'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
