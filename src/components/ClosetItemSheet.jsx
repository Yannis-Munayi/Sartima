import { useEffect, useRef, useState } from 'react'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from '../services/firebase'
import { useAuth } from '../context/AuthContext'
import { useCloset } from '../context/ClosetContext'
import { prettifyImage } from '../services/prettify'
import { useEscapeKey } from '../hooks/useEscapeKey'
import CareSymbolPicker from './CareSymbolPicker'
import {
  CARE_SYMBOLS,
  WASH_FREQUENCIES,
  WASH_FREQUENCY_DEFAULTS,
  STORAGE_DEFAULTS,
  inferColorGroup,
} from '../data/careSymbols'
import styles from './ClosetItemSheet.module.css'

const CATEGORIES = [
  { id: 'tops',        label: 'Tops',        emoji: '👕' },
  { id: 'bottoms',     label: 'Bottoms',     emoji: '👖' },
  { id: 'outerwear',   label: 'Outerwear',   emoji: '🧥' },
  { id: 'dresses',     label: 'Dresses',     emoji: '👗' },
  { id: 'footwear',    label: 'Footwear',    emoji: '👟' },
  { id: 'accessories', label: 'Accessories', emoji: '👜' },
]

const OCCASIONS = ['casual', 'work', 'date', 'gym', 'errand', 'formal', 'outdoor']
const SEASONS   = ['spring', 'summer', 'fall', 'winter']

const STORAGE_OPTIONS = [
  { id: 'hang',         label: 'Hang' },
  { id: 'fold',         label: 'Fold' },
  { id: 'hang-or-fold', label: 'Hang or Fold' },
]

function getDaysSince(isoStr) {
  if (!isoStr) return null
  const diff = Date.now() - new Date(isoStr).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

function getWashStatusLabel(item) {
  const freq = WASH_FREQUENCIES.find((f) => f.id === item.washFrequency)
  const days = getDaysSince(item.lastWashedAt)
  if (!item.lastWashedAt) return null
  if (!freq || freq.thresholdDays === null) return `Washed ${days}d ago`
  if (days >= freq.thresholdDays) return 'Due for wash'
  if (days === freq.thresholdDays - 1) return 'Due soon'
  return `Washed ${days === 0 ? 'today' : `${days}d ago`}`
}

export default function ClosetItemSheet({ item, onClose, onUpdate }) {
  const { user }                               = useAuth()
  const { updateClosetItem, removeFromCloset } = useCloset()

  const [mode, setMode]             = useState('view') // 'view' | 'edit'
  const [name, setName]             = useState(item.name)
  const [brand, setBrand]           = useState(item.brand ?? '')
  const [category, setCategory]     = useState(item.category)
  const [color, setColor]           = useState(item.color ?? '')
  const [price, setPrice]           = useState(item.price != null ? String(item.price) : '')
  const [occasions, setOccasions]   = useState(item.occasions ?? [])
  const [seasons, setSeasons]       = useState(item.seasons ?? [])

  // Care fields
  const [material,      setMaterial]      = useState(item.material ?? '')
  const [careSymbols,   setCareSymbols]   = useState(item.careSymbols ?? [])
  const [washFrequency, setWashFrequency] = useState(
    item.washFrequency ?? WASH_FREQUENCY_DEFAULTS[item.category] ?? 'every-2-3-wears'
  )
  const [storageMethod, setStorageMethod] = useState(
    item.storageMethod ?? STORAGE_DEFAULTS[item.category] ?? 'fold'
  )
  const [lastWashedAt, setLastWashedAt]   = useState(
    item.lastWashedAt ? item.lastWashedAt.slice(0, 10) : ''
  )

  const [saving, setSaving]         = useState(false)
  const [prettifying, setPrettifying] = useState(false)
  const [prettifyProgress, setProgress] = useState(0)
  const [error, setError]           = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Esc steps back one level, like the sheet's own Cancel buttons
  useEscapeKey(() => {
    if (confirmDelete) setConfirmDelete(false)
    else if (mode === 'edit') setMode('view')
    else onClose()
  })

  // Re-default wash + storage when category changes (only if user hasn't saved their own preference)
  const hasOwnFreq    = useRef(!!item.washFrequency)
  const hasOwnStorage = useRef(!!item.storageMethod)
  useEffect(() => {
    if (!hasOwnFreq.current)    setWashFrequency(WASH_FREQUENCY_DEFAULTS[category] ?? 'every-2-3-wears')
    if (!hasOwnStorage.current) setStorageMethod(STORAGE_DEFAULTS[category] ?? 'fold')
  }, [category])

  const photoUrl = item.prettifiedUrl ?? item.imageUrl ?? item.thumbnailUrl

  function toggleOccasion(occ) {
    setOccasions((prev) => prev.includes(occ) ? prev.filter((o) => o !== occ) : [...prev, occ])
  }

  function toggleSeason(s) {
    setSeasons((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])
  }

  async function handleSave() {
    if (!name.trim()) { setError('Name is required.'); return }
    setSaving(true)
    setError(null)
    const parsedPrice = price.trim() ? Number(price) : NaN
    try {
      await updateClosetItem(item.id, {
        name:         name.trim(),
        brand:        brand.trim(),
        category,
        color:        color.trim(),
        price:        Number.isFinite(parsedPrice) && parsedPrice >= 0 ? parsedPrice : undefined,
        occasions,
        seasons,
        material:     material.trim() || undefined,
        careSymbols,
        washFrequency,
        storageMethod,
        lastWashedAt: lastWashedAt ? new Date(lastWashedAt).toISOString() : undefined,
        colorGroup:   item.colorGroup ?? inferColorGroup(color.trim()) ?? undefined,
      })
      onUpdate()
    } catch {
      setError('Save failed. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handlePrettify() {
    const src = item.imageUrl ?? item.thumbnailUrl
    if (!src || !user) {
      setError('No photo to prettify.')
      return
    }
    setPrettifying(true)
    setProgress(0)
    setError(null)
    try {
      const resultBlob = await prettifyImage(src, (key, current, total) => {
        setProgress(total > 0 ? Math.round((current / total) * 100) : 0)
      })
      const path       = `users/${user.uid}/wardrobe/prettified/${item.id}.png`
      const storageRef = ref(storage, path)
      await uploadBytes(storageRef, resultBlob)
      const downloadUrl = await getDownloadURL(storageRef)
      await updateClosetItem(item.id, { prettifiedUrl: downloadUrl })
      onUpdate()
    } catch (err) {
      setError('Prettify failed. The browser may not support this feature.')
    } finally {
      setPrettifying(false)
    }
  }

  async function handleDelete() {
    await removeFromCloset(item.id)
    onClose()
  }

  const washStatusLabel = getWashStatusLabel(item)
  const hasCareData     = item.material || item.careSymbols?.length || item.lastWashedAt || item.storageMethod

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.sheet}>
        <div className={styles.handle} />

        {/* Photo */}
        <div className={styles.photoWrap}>
          {photoUrl ? (
            <img src={photoUrl} alt={item.name} className={styles.photo} />
          ) : (
            <div className={styles.photoPlaceholder}>
              {CATEGORIES.find((c) => c.id === item.category)?.emoji ?? '👕'}
            </div>
          )}
          {item.prettifiedUrl && (
            <span className={styles.prettifiedBadge}>✦ Prettified</span>
          )}
        </div>

        <div className={styles.body}>
          {mode === 'view' ? (
            <>
              <h3 className={styles.itemName}>{item.name}</h3>
              {item.brand && <p className={styles.itemBrand}>{item.brand}</p>}
              <p className={styles.itemMeta}>
                {item.category}
                {item.color ? ` · ${item.color}` : ''}
                {item.price != null ? ` · $${item.price.toFixed(2)}` : ''}
              </p>
              {item.price != null && item.timesWorn > 0 && (
                <p className={styles.itemMeta}>
                  ${(item.price / item.timesWorn).toFixed(2)} per wear ({item.timesWorn}×)
                </p>
              )}

              {/* Care summary */}
              {hasCareData && (
                <div className={styles.careSummary}>
                  {item.material && (
                    <span className={styles.carePill}>{item.material}</span>
                  )}
                  {item.storageMethod && (
                    <span className={styles.carePill}>
                      {item.storageMethod === 'hang' ? 'Hang' : item.storageMethod === 'fold' ? 'Fold' : 'Hang or fold'}
                    </span>
                  )}
                  {item.careSymbols?.slice(0, 4).map((id) => {
                    const sym = CARE_SYMBOLS.find((s) => s.id === id)
                    return sym ? (
                      <span key={id} className={styles.symbolMini} title={sym.label}>
                        {sym.abbreviation}
                      </span>
                    ) : null
                  })}
                  {washStatusLabel && (
                    <span className={`${styles.carePill} ${washStatusLabel === 'Due for wash' ? styles.carePillWarn : ''}`}>
                      {washStatusLabel}
                    </span>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className={styles.actions}>
                {(item.imageUrl || item.thumbnailUrl) && !item.prettifiedUrl && (
                  <button
                    className={styles.actionBtn}
                    onClick={handlePrettify}
                    disabled={prettifying}
                  >
                    {prettifying ? (
                      <>
                        <span className={styles.spinner} />
                        Prettifying… {prettifyProgress > 0 ? `${prettifyProgress}%` : ''}
                      </>
                    ) : '✦ Prettify'}
                  </button>
                )}
                <button className={styles.actionBtn} onClick={() => setMode('edit')}>
                  ✎ Edit Details
                </button>
                <button
                  className={`${styles.actionBtn} ${styles.actionDanger}`}
                  onClick={() => setConfirmDelete(true)}
                >
                  Remove
                </button>
              </div>

              {confirmDelete && (
                <div className={styles.confirmBox}>
                  <p className={styles.confirmText}>Remove this item from your closet?</p>
                  <div className={styles.confirmBtns}>
                    <button className={styles.confirmCancel} onClick={() => setConfirmDelete(false)}>Cancel</button>
                    <button className={styles.confirmDelete} onClick={handleDelete}>Remove</button>
                  </div>
                </div>
              )}

              {error && <p className={styles.error}>{error}</p>}
            </>
          ) : (
            <>
              <h3 className={styles.editTitle}>Edit Item</h3>

              <label className={styles.label}>Name</label>
              <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} />

              <label className={styles.label}>Brand</label>
              <input className={styles.input} placeholder="Optional" value={brand} onChange={(e) => setBrand(e.target.value)} />

              <label className={styles.label}>Color</label>
              <input className={styles.input} placeholder="e.g. navy" value={color} onChange={(e) => setColor(e.target.value)} />

              <label className={styles.label}>Price paid</label>
              <p className={styles.labelHint}>Optional — powers cost-per-wear on the back of this card.</p>
              <input
                className={styles.input}
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="e.g. 68"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />

              <label className={styles.label}>Category</label>
              <div className={styles.chipRow}>
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`${styles.chip} ${category === c.id ? styles.chipActive : ''}`}
                    onClick={() => setCategory(c.id)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              <label className={styles.label}>Occasions</label>
              <div className={styles.chipRow}>
                {OCCASIONS.map((occ) => (
                  <button
                    key={occ}
                    type="button"
                    className={`${styles.chip} ${occasions.includes(occ) ? styles.chipActive : ''}`}
                    onClick={() => toggleOccasion(occ)}
                  >
                    {occ}
                  </button>
                ))}
              </div>

              <label className={styles.label}>Seasons</label>
              <div className={styles.chipRow}>
                {SEASONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`${styles.chip} ${seasons.includes(s) ? styles.chipActive : ''}`}
                    onClick={() => toggleSeason(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>

              {/* ── Care & Longevity ── */}
              <div className={styles.sectionDivider}>
                <span>Care &amp; Longevity</span>
              </div>

              <label className={styles.label}>Material</label>
              <input
                className={styles.input}
                placeholder="e.g. 100% cotton, 60% polyester / 40% cotton"
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
              />

              <label className={styles.label}>Care Symbols</label>
              <p className={styles.labelHint}>Select the symbols from your garment's care label.</p>
              <CareSymbolPicker selected={careSymbols} onChange={setCareSymbols} />

              <label className={styles.label} style={{ marginTop: 'var(--space-4)' }}>How often to wash</label>
              <div className={styles.chipRow}>
                {WASH_FREQUENCIES.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={`${styles.chip} ${washFrequency === f.id ? styles.chipActive : ''}`}
                    onClick={() => { setWashFrequency(f.id); hasOwnFreq.current = true }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <label className={styles.label}>Store by</label>
              <div className={styles.chipRow}>
                {STORAGE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={`${styles.chip} ${storageMethod === opt.id ? styles.chipActive : ''}`}
                    onClick={() => { setStorageMethod(opt.id); hasOwnStorage.current = true }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <label className={styles.label}>Last washed</label>
              <div className={styles.dateRow}>
                <input
                  type="date"
                  className={styles.input}
                  value={lastWashedAt}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setLastWashedAt(e.target.value)}
                />
                <button
                  type="button"
                  className={styles.todayBtn}
                  onClick={() => setLastWashedAt(new Date().toISOString().slice(0, 10))}
                >
                  Today
                </button>
              </div>

              {error && <p className={styles.error}>{error}</p>}

              <div className={styles.editBtns}>
                <button className={styles.cancelBtn} onClick={() => setMode('view')}>Cancel</button>
                <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
