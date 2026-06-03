import { useRef, useState } from 'react'
import { fetchPhotos as fetchPexels } from '../services/pexels'
import { fetchPhotos as fetchGoogle } from '../services/google'
import styles from './CatalogSearchSheet.module.css'

const CATEGORY_MAP = {
  tops:        ['shirt', 'top', 'blouse', 'tee', 't-shirt', 'sweater', 'hoodie', 'polo', 'turtleneck'],
  bottoms:     ['pant', 'trouser', 'jean', 'denim', 'skirt', 'short', 'legging', 'jogger', 'chino'],
  outerwear:   ['jacket', 'coat', 'blazer', 'parka', 'trench', 'vest', 'bomber'],
  dresses:     ['dress', 'gown', 'romper', 'jumpsuit'],
  footwear:    ['shoe', 'boot', 'sneaker', 'heel', 'loafer', 'sandal', 'oxford'],
  accessories: ['bag', 'hat', 'cap', 'scarf', 'belt', 'watch', 'necklace', 'sunglasses', 'backpack'],
}

function inferCategory(query) {
  const q = query.toLowerCase()
  for (const [cat, keywords] of Object.entries(CATEGORY_MAP)) {
    if (keywords.some((kw) => q.includes(kw))) return cat
  }
  return 'tops'
}

export default function CatalogSearchSheet({ onAdd, onClose }) {
  const inputRef = useRef(null)
  const [query,    setQuery]    = useState('')
  const [results,  setResults]  = useState([])     // [{ url, selected }]
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  const [adding,   setAdding]   = useState(false)

  async function handleSearch(e) {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    setResults([])
    try {
      // Try Google Custom Search first (best product shots), fall back to Pexels
      let urls = await fetchGoogle(`${query} clothing fashion product white background`, 12)
      if (!urls.length) {
        urls = await fetchPexels(`${query} fashion clothing outfit`, 12)
      }
      if (!urls.length) {
        setError('No results found. Try a different search term.')
        return
      }
      setResults(urls.map((url) => ({ url, selected: false })))
    } finally {
      setLoading(false)
    }
  }

  function toggle(url) {
    setResults((prev) => prev.map((r) => r.url === url ? { ...r, selected: !r.selected } : r))
  }

  async function handleAdd() {
    const selected = results.filter((r) => r.selected)
    if (!selected.length) return
    setAdding(true)
    setError(null)
    try {
      const category = inferCategory(query)
      for (const { url } of selected) {
        await onAdd({
          id:           `ci_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          type:         'catalog',
          name:         query.trim(),
          category,
          thumbnailUrl: url,
          color:        '',
          aiDetected:   false,
          favorite:     false,
          tags:         [],
          seasons:      [],
          occasions:    [],
          addedAt:      new Date().toISOString(),
        })
      }
      onClose()
    } catch {
      setError('Failed to add items. Please try again.')
    } finally {
      setAdding(false)
    }
  }

  const selectedCount = results.filter((r) => r.selected).length

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.sheet}>
        <div className={styles.handle} />

        <div className={styles.header}>
          <h3 className={styles.title}>Search Catalog</h3>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <p className={styles.sub}>Search for items to add to your closet.</p>

        <form onSubmit={handleSearch} className={styles.searchRow}>
          <input
            ref={inputRef}
            className={styles.searchInput}
            placeholder='e.g. "white linen shirt" or "Nike Air Force 1"'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <button type="submit" className={styles.searchBtn} disabled={loading}>
            {loading ? '…' : '→'}
          </button>
        </form>

        {error && <p className={styles.error}>{error}</p>}

        {results.length > 0 && (
          <>
            <p className={styles.resultsLabel}>
              Tap to select items · {selectedCount} selected
            </p>
            <div className={styles.grid}>
              {results.map(({ url, selected }) => (
                <button
                  key={url}
                  className={`${styles.resultCard} ${selected ? styles.resultSelected : ''}`}
                  onClick={() => toggle(url)}
                >
                  <img
                    src={url}
                    alt="catalog item"
                    className={styles.resultImg}
                    onError={(e) => { e.currentTarget.style.display = 'none' }}
                  />
                  {selected && <span className={styles.checkmark}>✓</span>}
                </button>
              ))}
            </div>
          </>
        )}

        {selectedCount > 0 && (
          <button className={styles.addBtn} onClick={handleAdd} disabled={adding}>
            {adding ? 'Adding…' : `Add ${selectedCount} item${selectedCount > 1 ? 's' : ''} to Closet`}
          </button>
        )}
      </div>
    </div>
  )
}
