import { useEffect, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { useShop } from '../../context/ShopContext'
import { useInterests } from '../../context/InterestContext'
import { fetchPhotos } from '../../services/stockPhotos'
import { resolveProductImage, getAltProductImage } from '../../services/productImage'
import ProductImageToggle from '../../components/ProductImageToggle'
import ShopPanel from '../../components/ShopPanel'
import listStyles from '../ShopList.module.css'
import Icon from '../../components/Icon'

function ProductRowPhoto({ product }) {
  const [photo, setPhoto] = useState(null)
  const { state } = useApp()
  const gender = state.gender
  const altPhoto = getAltProductImage(product, gender)
  const ref     = useRef(null)
  const fetched = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !fetched.current) {
        fetched.current = true
        resolveProductImage(product, gender).then((url) => setPhoto(url ?? null))
        obs.disconnect()
      }
    }, { rootMargin: '60px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [product.id, gender])

  return (
    <div ref={ref} className={listStyles.productRowPhoto}>
      <ProductImageToggle photo={photo} altPhoto={altPhoto} alt={product.name} imgClassName={listStyles.productRowImg} />
    </div>
  )
}

function ScoutedGroupCard({ group, onRemove }) {
  const [open, setOpen] = useState(false)
  const { recordInterest } = useInterests() ?? {}

  return (
    <div className={listStyles.card}>
      <button className={listStyles.cardHeader} onClick={() => setOpen(!open)}>
        <div className={listStyles.cardPhoto} style={{ background: 'var(--surface-hover)' }}>
          <span className={listStyles.cardEmoji}>{group.emoji}</span>
        </div>
        <div className={listStyles.cardInfo}>
          <p className={listStyles.cardName}>{group.pieceName}</p>
          <p className={listStyles.cardFilters}>
            {[
              group.budgetLabel,
              group.filters?.color,
              group.filters?.material && group.filters.material !== 'any' && group.filters.material,
              group.filters?.size,
            ].filter(Boolean).join(' · ')}
          </p>
          <p className={listStyles.cardCount}>{group.products.length} products</p>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" className={listStyles.chevron}
          style={{ transform: open ? 'rotate(180deg)' : 'none' }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className={listStyles.cardBody}>
          <div className={listStyles.productRows}>
            {group.products.map((product) => (
              <div key={product.id} className={listStyles.productRow}>
                <ProductRowPhoto product={product} />
                <div className={listStyles.productRowBody}>
                  <p className={listStyles.productRowBrand}>{product.brand}</p>
                  <p className={listStyles.productRowName}>{product.name}</p>
                  <p className={listStyles.productRowDesc}>{product.description}</p>
                </div>
                <a
                  href={product.shopUrl ?? product.shopFallbackUrl}
                  target="_blank" rel="noopener noreferrer"
                  className={listStyles.productRowBuy}
                  onClick={() => recordInterest?.('shop', { product })}
                >
                  Buy →
                </a>
              </div>
            ))}
          </div>
          <div className={listStyles.cardActions}>
            <button className={listStyles.removeBtn} onClick={() => onRemove(group.id)}>
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ShopItemCard({ entry, onRemove, onReopen }) {
  const { item, filters, retailers } = entry
  const [photo, setPhoto]   = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [open, setOpen]     = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchPhotos(`${item.name} fashion outfit`, 1).then(([url] = []) => {
      if (!cancelled) setPhoto(url ?? null)
    })
    return () => { cancelled = true }
  }, [item.id])

  const filterSummary = [filters.colour, filters.material, filters.size, filters.fit, filters.priceRange]
    .filter(Boolean).join(' · ')

  return (
    <div className={listStyles.card}>
      <button className={listStyles.cardHeader} onClick={() => setOpen(!open)}>
        <div className={listStyles.cardPhoto} style={{ background: item.gradient ?? 'var(--surface-hover)' }}>
          {photo && (
            <img src={photo} alt={item.name} className={listStyles.cardImg}
              style={{ opacity: loaded ? 1 : 0 }}
              onLoad={() => setLoaded(true)} onError={() => setLoaded(true)}
            />
          )}
          <span className={listStyles.cardEmoji}>{item.emoji}</span>
        </div>
        <div className={listStyles.cardInfo}>
          <p className={listStyles.cardName}>{item.name}</p>
          <p className={listStyles.cardFilters}>{filterSummary || 'No filters applied'}</p>
          <p className={listStyles.cardCount}>{retailers.length} stores</p>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" className={listStyles.chevron}
          style={{ transform: open ? 'rotate(180deg)' : 'none' }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className={listStyles.cardBody}>
          <div className={listStyles.storeList}>
            {retailers.map((r, i) => (
              <a key={r.id} href={r.searchUrl} target="_blank" rel="noopener noreferrer"
                className={listStyles.storeRow}
              >
                <span className={listStyles.storeRank}>#{i + 1}</span>
                <span className={listStyles.storeName}>{r.name}</span>
                <span className={listStyles.storeTagline}>{r.tagline}</span>
                <span className={listStyles.shopNow}>Shop →</span>
              </a>
            ))}
          </div>
          <div className={listStyles.cardActions}>
            <button className={listStyles.reopenBtn} onClick={() => onReopen(entry)}>Update filters</button>
            <button className={listStyles.removeBtn} onClick={() => onRemove(item.id)}>Remove</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function MyListView() {
  const { shopList, removeFromShop, scoutedGroups, removeScoutedGroup } = useShop()
  const [reopenEntry, setReopenEntry] = useState(null)

  const isEmpty = shopList.length === 0 && scoutedGroups.length === 0

  return (
    <div>
      {isEmpty && (
        <div className={listStyles.empty}>
          <span className={listStyles.emptyIcon}><Icon name="bag" size={24} /></span>
          <p className={listStyles.emptyTitle}>Nothing here yet</p>
          <p className={listStyles.emptySub}>
            Complete a Scout search to save products here, or tap "Shop this item" anywhere in the app.
          </p>
        </div>
      )}

      {scoutedGroups.length > 0 && (
        <>
          <p className={listStyles.sectionTitle}>Scout Results</p>
          <div className={listStyles.list}>
            {scoutedGroups.map((group) => (
              <ScoutedGroupCard key={group.id} group={group} onRemove={removeScoutedGroup} />
            ))}
          </div>
        </>
      )}

      {shopList.length > 0 && (
        <>
          <p className={listStyles.sectionTitle}>Saved Items</p>
          <div className={listStyles.list}>
            {shopList.map((entry) => (
              <ShopItemCard key={entry.item.id} entry={entry}
                onRemove={removeFromShop} onReopen={setReopenEntry}
              />
            ))}
          </div>
        </>
      )}

      {reopenEntry && (
        <ShopPanel item={reopenEntry.item} onClose={() => setReopenEntry(null)} />
      )}
    </div>
  )
}
