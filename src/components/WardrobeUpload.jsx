import { useRef, useState } from 'react'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from '../services/firebase'
import { analyzeOutfit } from '../services/claudeVision'
import styles from './WardrobeUpload.module.css'

const CATEGORIES = [
  { id: 'tops',        label: 'Tops',       emoji: '👕' },
  { id: 'bottoms',     label: 'Bottoms',    emoji: '👖' },
  { id: 'outerwear',   label: 'Outerwear',  emoji: '🧥' },
  { id: 'dresses',     label: 'Dresses',    emoji: '👗' },
  { id: 'footwear',    label: 'Footwear',   emoji: '👟' },
  { id: 'accessories', label: 'Accessories',emoji: '👜' },
]

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function uploadImage(file, uid, folder) {
  const ext      = file.name.split('.').pop() || 'jpg'
  const path     = `users/${uid}/wardrobe/${folder}/${Date.now()}.${ext}`
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, file)
  return getDownloadURL(storageRef)
}

// ── Single piece upload ──────────────────────────────────────────────────────
function AddPiecePane({ uid, onSave, onClose }) {
  const fileRef = useRef(null)
  const [preview,  setPreview]  = useState(null)
  const [file,     setFile]     = useState(null)
  const [name,     setName]     = useState('')
  const [category, setCategory] = useState('tops')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState(null)

  function handleFile(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setError(null)
  }

  async function handleSave() {
    if (!name.trim()) { setError('Give this piece a name.'); return }
    setSaving(true)
    try {
      const imageUrl = file ? await uploadImage(file, uid, 'pieces') : null
      await onSave({
        id:         `piece_${Date.now()}`,
        type:       'uploaded',
        name:       name.trim(),
        category,
        imageUrl,
        aiDetected: false,
        uploadedAt: new Date().toISOString(),
      })
      onClose()
    } catch (err) {
      setError('Upload failed. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.pane}>
      <h3 className={styles.paneTitle}>Add a Piece</h3>

      {/* Photo picker */}
      <button className={styles.photoZone} onClick={() => fileRef.current?.click()}>
        {preview
          ? <img src={preview} alt="preview" className={styles.photoPreview} />
          : <span className={styles.photoPlaceholder}>📷 Tap to choose photo</span>
        }
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFile}
      />

      {/* Name */}
      <input
        className={styles.nameInput}
        placeholder="Item name  e.g. White Linen Shirt"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      {/* Category */}
      <div className={styles.catGrid}>
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            className={`${styles.catPill} ${category === c.id ? styles.catPillActive : ''}`}
            onClick={() => setCategory(c.id)}
          >
            {c.emoji} {c.label}
          </button>
        ))}
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
        {saving ? 'Saving…' : 'Save to Wardrobe'}
      </button>
    </div>
  )
}

// ── Outfit photo analysis ────────────────────────────────────────────────────
function AnalyzeOutfitPane({ uid, onSave, onClose }) {
  const fileRef = useRef(null)
  const [preview,   setPreview]   = useState(null)
  const [file,      setFile]      = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [cooldown,  setCooldown]  = useState(false)
  const [items,     setItems]     = useState(null) // detected items
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState(null)

  function handleFile(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setItems(null)
    setError(null)
  }

  async function handleAnalyze() {
    if (!file) return
    setAnalyzing(true)
    setCooldown(true)
    setError(null)
    try {
      const base64   = await fileToBase64(file)
      const detected = await analyzeOutfit(base64, file.type)
      setItems(detected.map((item) => ({ ...item, include: true })))
    } catch (err) {
      setError(
        err.message?.includes('API key') || err.message?.includes('auth')
          ? 'AI analysis unavailable — check your VITE_ANTHROPIC_API_KEY.'
          : 'Analysis failed. Please try again.'
      )
    } finally {
      setAnalyzing(false)
      setTimeout(() => setCooldown(false), 15_000)
    }
  }

  async function handleSaveAll() {
    const toSave = items.filter((i) => i.include)
    if (!toSave.length) { setError('Select at least one item to save.'); return }
    setSaving(true)
    try {
      const imageUrl = await uploadImage(file, uid, 'outfits')
      const outfitId = `outfit_${Date.now()}`
      for (const item of toSave) {
        await onSave({
          ...item,
          type:       'uploaded',
          imageUrl,
          aiDetected: true,
          outfitId,
          uploadedAt: new Date().toISOString(),
        })
      }
      onClose()
    } catch {
      setError('Save failed. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  function toggleItem(id) {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, include: !i.include } : i))
  }

  function updateItemName(id, name) {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, name } : i))
  }

  return (
    <div className={styles.pane}>
      <h3 className={styles.paneTitle}>Analyze an Outfit</h3>
      <p className={styles.paneSub}>Upload a photo and Claude AI will identify every item you're wearing.</p>

      <button className={styles.photoZone} onClick={() => fileRef.current?.click()}>
        {preview
          ? <img src={preview} alt="outfit preview" className={styles.photoPreview} />
          : <span className={styles.photoPlaceholder}>📸 Tap to choose outfit photo</span>
        }
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFile}
      />

      {/* Analyze button — shown before results */}
      {file && !items && (
        <button className={styles.analyzeBtn} onClick={handleAnalyze} disabled={analyzing || cooldown}>
          {analyzing
            ? <><span className={styles.spinner} /> Analyzing…</>
            : cooldown ? 'Please wait…'
            : '✦ Identify items with AI'
          }
        </button>
      )}

      {error && <p className={styles.error}>{error}</p>}

      {/* Detected items list */}
      {items && (
        <>
          <p className={styles.detectedLabel}>
            {items.filter((i) => i.include).length} of {items.length} items selected
          </p>
          <div className={styles.detectedList}>
            {items.map((item) => (
              <div
                key={item.id}
                className={`${styles.detectedItem} ${item.include ? '' : styles.detectedItemOff}`}
              >
                <button
                  className={styles.checkBtn}
                  onClick={() => toggleItem(item.id)}
                  aria-label={item.include ? 'Deselect' : 'Select'}
                >
                  {item.include ? '✓' : '○'}
                </button>
                <div className={styles.detectedBody}>
                  <input
                    className={styles.detectedName}
                    value={item.name}
                    onChange={(e) => updateItemName(item.id, e.target.value)}
                    disabled={!item.include}
                  />
                  <span className={styles.detectedMeta}>
                    {CATEGORIES.find((c) => c.id === item.category)?.emoji}{' '}
                    {item.color} · {CATEGORIES.find((c) => c.id === item.category)?.label}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <button className={styles.saveBtn} onClick={handleSaveAll} disabled={saving}>
            {saving ? 'Saving…' : `Add ${items.filter((i) => i.include).length} items to Wardrobe`}
          </button>
        </>
      )}
    </div>
  )
}

// ── Root component ───────────────────────────────────────────────────────────
export default function WardrobeUpload({ uid, onSave, onClose }) {
  const [mode, setMode] = useState(null) // null | 'piece' | 'outfit'

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.sheet}>
        <div className={styles.handle} />

        {/* Mode selector */}
        {!mode && (
          <div className={styles.modeSelect}>
            <h3 className={styles.modeTitle}>Add to Wardrobe</h3>
            <p className={styles.modeSub}>Upload a single piece or let AI analyze a full outfit.</p>
            <div className={styles.modeButtons}>
              <button className={styles.modeBtn} onClick={() => setMode('piece')}>
                <span className={styles.modeBtnIcon}>👕</span>
                <span className={styles.modeBtnLabel}>Add a Piece</span>
                <span className={styles.modeBtnSub}>Upload one clothing item</span>
              </button>
              <button className={styles.modeBtn} onClick={() => setMode('outfit')}>
                <span className={styles.modeBtnIcon}>✦</span>
                <span className={styles.modeBtnLabel}>Analyze Outfit</span>
                <span className={styles.modeBtnSub}>AI identifies all items worn</span>
              </button>
            </div>
            <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          </div>
        )}

        {mode === 'piece'  && <AddPiecePane    uid={uid} onSave={onSave} onClose={onClose} />}
        {mode === 'outfit' && <AnalyzeOutfitPane uid={uid} onSave={onSave} onClose={onClose} />}
      </div>
    </div>
  )
}
