import { useRef, useState } from 'react'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from '../services/firebase'
import { useAuth } from '../context/AuthContext'
import { useCloset } from '../context/ClosetContext'
import { prettifyImage } from '../services/prettify'
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

export default function ClosetItemSheet({ item, onClose, onUpdate }) {
  const { user }                         = useAuth()
  const { updateClosetItem, removeFromCloset } = useCloset()

  const [mode, setMode]             = useState('view') // 'view' | 'edit'
  const [name, setName]             = useState(item.name)
  const [brand, setBrand]           = useState(item.brand ?? '')
  const [category, setCategory]     = useState(item.category)
  const [color, setColor]           = useState(item.color ?? '')
  const [occasions, setOccasions]   = useState(item.occasions ?? [])
  const [seasons, setSeasons]       = useState(item.seasons ?? [])
  const [saving, setSaving]         = useState(false)
  const [prettifying, setPrettifying] = useState(false)
  const [prettifyProgress, setProgress] = useState(0)
  const [error, setError]           = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

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
    try {
      await updateClosetItem(item.id, { name: name.trim(), brand: brand.trim(), category, color: color.trim(), occasions, seasons })
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
      // Upload prettified blob to Firebase Storage
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
                {CATEGORIES.find((c) => c.id === item.category)?.emoji} {item.category}
                {item.color ? ` · ${item.color}` : ''}
              </p>

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
                  🗑 Remove
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

              <label className={styles.label}>Category</label>
              <div className={styles.chipRow}>
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    className={`${styles.chip} ${category === c.id ? styles.chipActive : ''}`}
                    onClick={() => setCategory(c.id)}
                  >
                    {c.emoji} {c.label}
                  </button>
                ))}
              </div>

              <label className={styles.label}>Occasions</label>
              <div className={styles.chipRow}>
                {OCCASIONS.map((occ) => (
                  <button
                    key={occ}
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
                    className={`${styles.chip} ${seasons.includes(s) ? styles.chipActive : ''}`}
                    onClick={() => toggleSeason(s)}
                  >
                    {s}
                  </button>
                ))}
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
