import { useEffect, useState } from 'react'
import {
  PRICE_RANGES, MATERIALS, COLOURS, SIZES, FIT_OPTIONS,
  getRetailersForItem,
} from '../data/retailers'
import { useShop } from '../context/ShopContext'
import { useInterests } from '../context/InterestContext'
import styles from './ShopPanel.module.css'

const COLOUR_HEX = {
  White:    '#f5f5f5', Black:    '#111',    Grey:    '#888',
  Navy:     '#1a2a4a', Brown:    '#6b4226', Beige:   '#d4b896',
  Olive:    '#6b7c3a', Green:    '#2d6a4f', Blue:    '#2563eb',
  Burgundy: '#7c1d2e', Red:      '#dc2626',
}

function FilterPills({ label, options, value, onChange }) {
  return (
    <div className={styles.filterGroup}>
      <p className={styles.filterLabel}>{label}</p>
      <div className={styles.pills}>
        <button
          className={`${styles.pill} ${!value ? styles.pillActive : ''}`}
          onClick={() => onChange(null)}
        >
          Any
        </button>
        {options.map((opt) => (
          <button
            key={opt}
            className={`${styles.pill} ${value === opt ? styles.pillActive : ''}`}
            onClick={() => onChange(value === opt ? null : opt)}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

function ColourPicker({ value, onChange }) {
  return (
    <div className={styles.filterGroup}>
      <p className={styles.filterLabel}>Colour</p>
      <div className={styles.colourRow}>
        <button
          className={`${styles.colourDot} ${!value ? styles.colourDotActive : ''}`}
          style={{ background: 'linear-gradient(135deg,#fff 50%,#000 50%)' }}
          title="Any"
          onClick={() => onChange(null)}
        />
        {COLOURS.map((c) => (
          <button
            key={c}
            className={`${styles.colourDot} ${value === c ? styles.colourDotActive : ''}`}
            style={{ background: COLOUR_HEX[c] ?? '#888' }}
            title={c}
            onClick={() => onChange(value === c ? null : c)}
          />
        ))}
      </div>
      {value && <p className={styles.colourLabel}>{value}</p>}
    </div>
  )
}

function getClickCounts() {
  try { return JSON.parse(localStorage.getItem('retailer_clicks') ?? '{}') } catch { return {} }
}

function recordClick(retailerName) {
  try {
    const counts = getClickCounts()
    counts[retailerName] = (counts[retailerName] ?? 0) + 1
    localStorage.setItem('retailer_clicks', JSON.stringify(counts))
  } catch {}
}

function RetailerCard({ retailer, index }) {
  const counts = getClickCounts()
  const clicks = counts[retailer.name] ?? 0

  return (
    <a
      href={retailer.searchUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.retailerCard}
      onClick={() => recordClick(retailer.name)}
    >
      <div className={styles.retailerRank}>#{index + 1}</div>
      <div className={styles.retailerBody}>
        <p className={styles.retailerName}>
          {retailer.name}
        </p>
        <p className={styles.retailerTagline}>{retailer.tagline}</p>
        {clicks > 0 && (
          <p className={styles.retailerClicks}>{clicks} visit{clicks !== 1 ? 's' : ''}</p>
        )}
      </div>
      <span className={styles.shopNow}>Shop →</span>
    </a>
  )
}

export default function ShopPanel({ item, onClose }) {
  const { addToShop, isInShop } = useShop()
  const { recordInterest } = useInterests() ?? {}

  // Opening the retailer panel = shopping intent for this item
  useEffect(() => {
    recordInterest?.('shop', { product: item })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id])

  const [priceRange, setPriceRange] = useState(null)
  const [material,   setMaterial]   = useState(null)
  const [colour,     setColour]     = useState(null)
  const [size,       setSize]       = useState(null)
  const [fit,        setFit]        = useState(null)
  const [retailers,  setRetailers]  = useState(null)
  const [saved,      setSaved]      = useState(isInShop(item.id))

  const fitOptions = FIT_OPTIONS[item.categoryId] ?? null

  function handleFind() {
    const filters = { priceRange, material, colour, size, fit }
    setRetailers(getRetailersForItem(item, filters))
  }

  function handleSave() {
    const filters = { priceRange, material, colour, size, fit }
    const list    = retailers ?? getRetailersForItem(item, filters)
    addToShop(item, filters, list)
    setSaved(true)
  }

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={onClose}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div className={styles.headerCenter}>
          <div className={styles.headerSwatch} style={{ background: item.gradient }}>
            <span>{item.emoji}</span>
          </div>
          <div>
            <p className={styles.headerName}>{item.name}</p>
            <p className={styles.headerDesc}>{item.description}</p>
          </div>
        </div>
      </div>

      <div className={styles.body}>
        {/* Filters */}
        <div className={styles.filters}>
          <FilterPills
            label="Price range"
            options={PRICE_RANGES}
            value={priceRange}
            onChange={setPriceRange}
          />
          <ColourPicker value={colour} onChange={setColour} />
          <FilterPills
            label="Material"
            options={MATERIALS}
            value={material}
            onChange={setMaterial}
          />
          <FilterPills
            label="Size"
            options={SIZES}
            value={size}
            onChange={setSize}
          />
          {fitOptions && (
            <FilterPills
              label="Fit"
              options={fitOptions}
              value={fit}
              onChange={setFit}
            />
          )}
        </div>

        {/* Find stores CTA */}
        <button className={styles.findBtn} onClick={handleFind}>
          Find stores →
        </button>

        {/* Results */}
        {retailers && (
          <div className={styles.results}>
            <p className={styles.resultsTitle}>
              Top {retailers.length} places to buy
              {colour ? ` · ${colour}` : ''}
              {material ? ` · ${material}` : ''}
            </p>
            <div className={styles.retailerList}>
              {retailers.map((r, i) => (
                <RetailerCard key={r.id} retailer={r} index={i} />
              ))}
            </div>

            <button
              className={`${styles.saveBtn} ${saved ? styles.saveBtnSaved : ''}`}
              onClick={handleSave}
              disabled={saved}
            >
              {saved ? '✓ Saved to Shop list' : '+ Save to my Shop list'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
