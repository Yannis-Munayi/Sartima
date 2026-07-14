import { useEffect, useMemo, useState } from 'react'
import { addDoc, collection, getDocs, orderBy, query as firestoreQuery, serverTimestamp } from 'firebase/firestore'
import { db } from '../services/firebase'
import { useAuth } from '../context/AuthContext'
import { resolveProductImage, getAltProductImage } from '../services/productImage'
import { useWishlist } from '../context/WishlistContext'
import { useInterests } from '../context/InterestContext'
import { useApp } from '../context/AppContext'
import ItemActionSheet from '../components/ItemActionSheet'
import ProductImageToggle from '../components/ProductImageToggle'
import ShopPanel from '../components/ShopPanel'
import AuthWidget from '../components/AuthWidget'
import WardrobeUpload from '../components/WardrobeUpload'

import styles from './WishlistScreen.module.css'

const UPLOAD_BUCKET_META = {
  tops:        { label: 'Tops',        emoji: '👕' },
  knitwear:    { label: 'Knitwear',    emoji: '🧶' },
  bottoms:     { label: 'Bottoms',     emoji: '👖' },
  outerwear:   { label: 'Outerwear',   emoji: '🧥' },
  footwear:    { label: 'Footwear',    emoji: '👟' },
  accessories: { label: 'Accessories', emoji: '👜' },
  activewear:  { label: 'Activewear',  emoji: '🏃' },
  other:       { label: 'Other',       emoji: '📦' },
}

function ItemWishCard({ entry, onRemove, onSelect }) {
  const { recordInterest } = useInterests() ?? {}
  const [photo, setPhoto] = useState(null)
  const { state } = useApp()
  const gender = state.gender

  const isProduct = entry.type === 'product'
  const altPhoto = getAltProductImage(entry, gender)

  useEffect(() => {
    let cancelled = false
    resolveProductImage(entry, gender).then((url) => {
      if (!cancelled) setPhoto(url ?? null)
    })
    return () => { cancelled = true }
  }, [entry.id, entry.name, gender])

  return (
    <div className={styles.itemCard}>
      <button className={styles.itemPhotoBtn} onClick={() => onSelect(entry)}>
        <div className={styles.itemPhoto} style={{ background: entry.gradient }}>
          <ProductImageToggle photo={photo} altPhoto={altPhoto} alt={entry.name} imgClassName={styles.itemImg} />
          {isProduct && entry.brand && (
            <span className={styles.brandBadge}>{entry.brand}</span>
          )}
          <div className={styles.itemOverlay}>
            <span className={styles.itemOverlayIcon}>⋯</span>
          </div>
        </div>
      </button>
      <button className={styles.removeBtn} onClick={() => onRemove(entry.id)} aria-label="Remove">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
      <p className={styles.itemName}>{isProduct && entry.brand ? `${entry.brand} ${entry.name}` : entry.name}</p>
      {isProduct && entry.shopUrl && (
        <a
          href={entry.shopUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.shopLink}
          onClick={(e) => { e.stopPropagation(); recordInterest?.('shop', { product: entry }) }}
        >
          Shop ↗
        </a>
      )}
    </div>
  )
}

function PhotoWishCard({ entry, onRemove }) {
  const [loaded, setLoaded] = useState(false)
  return (
    <div className={styles.photoCard}>
      <div className={styles.photoWrap}>
        <img
          src={entry.photoUrl}
          alt={entry.label}
          className={styles.photoImg}
          style={{ opacity: loaded ? 1 : 0 }}
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
        />
        <button className={styles.removeBtn} onClick={() => onRemove(entry.id)} aria-label="Remove">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      <p className={styles.photoLabel}>{entry.label}</p>
      <p className={styles.photoSub}>{entry.catLabel}</p>
    </div>
  )
}

function UploadedWardrobeItem({ item }) {
  return (
    <div className={styles.itemCard}>
      <div className={styles.itemPhoto} style={{ background: 'rgba(255,255,255,0.05)' }}>
        {item.imageUrl
          ? <img src={item.imageUrl} alt={item.name} className={styles.itemImg} style={{ opacity: 1 }} />
          : <span style={{ position: 'absolute', bottom: 8, right: 8, fontSize: 18 }}>📦</span>
        }
        {item.aiDetected && <span className={styles.aiBadge}>✦ AI</span>}
      </div>
      <p className={styles.itemName}>{item.name}</p>
    </div>
  )
}

export default function WishlistScreen() {
  const { user }                         = useAuth()
  const { wishlist, removeFromWishlist } = useWishlist()
  const [activeItem,    setActiveItem]   = useState(null)
  const [shopItem,      setShopItem]     = useState(null)
  const [uploadedItems, setUploadedItems] = useState([])
  const [showUpload,    setShowUpload]   = useState(false)

  useEffect(() => {
    if (!user) return
    const q = firestoreQuery(
      collection(db, 'users', user.uid, 'uploadedItems'),
      orderBy('uploadedAt', 'desc')
    )
    getDocs(q).then((snap) => {
      setUploadedItems(snap.docs.map((d) => ({ ...d.data(), firestoreId: d.id })))
    }).catch(() => {})
  }, [user])

  async function handleSaveUpload(item) {
    if (!user) return
    await addDoc(collection(db, 'users', user.uid, 'uploadedItems'), {
      ...item,
      uploadedAt: serverTimestamp(),
    })
    setUploadedItems((prev) => [item, ...prev])
  }

  const uploadedGrouped = useMemo(() => {
    const map = {}
    for (const item of uploadedItems) {
      const key = item.category ?? 'other'
      if (!map[key]) map[key] = []
      map[key].push(item)
    }
    return Object.entries(map).map(([id, items]) => ({
      meta: UPLOAD_BUCKET_META[id] ?? { label: id, emoji: '📦' },
      items,
    }))
  }, [uploadedItems])

  // Products saved via wishlist heart (type:'product'), old quiz items (type:'item'), and outfit photos
  const productEntries = wishlist.filter((e) => e.type === 'product')
  const itemEntries    = wishlist.filter((e) => e.type === 'item' || !e.type)
  const photoEntries   = wishlist.filter((e) => e.type === 'photo')
  const total          = wishlist.length + uploadedItems.length

  function handleOpenShop() {
    setShopItem(activeItem)
    setActiveItem(null)
  }

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div>
            <h1 className={styles.title}>My Wardrobe</h1>
            {total > 0 && (
              <p className={styles.sub}>{total} piece{total !== 1 ? 's' : ''} saved</p>
            )}
          </div>
          <div className={styles.headerRight}>
            {user && (
              <button className={styles.uploadBtn} onClick={() => setShowUpload(true)}>
                + Upload
              </button>
            )}
            <AuthWidget />
          </div>
        </div>
      </div>

      {total === 0 && (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>👗</span>
          <p className={styles.emptyTitle}>Your wardrobe is empty</p>
          <p className={styles.emptySub}>
            Save items from Explore, or upload photos of your own clothes.
          </p>
        </div>
      )}

      <div className={styles.body}>
        {uploadedGrouped.map(({ meta, items }) => (
          <section key={`up_${meta.label}`} className={styles.section}>
            <h2 className={styles.sectionLabel}>{meta.emoji} {meta.label} <span className={styles.uploadedBadge}>Uploaded</span></h2>
            <div className={styles.itemGrid}>
              {items.map((item) => (
                <UploadedWardrobeItem key={item.firestoreId ?? item.id} item={item} />
              ))}
            </div>
          </section>
        ))}

        {productEntries.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionLabel}>🛍️ Saved Products</h2>
            <div className={styles.itemGrid}>
              {productEntries.map((entry) => (
                <ItemWishCard
                  key={entry.id}
                  entry={entry}
                  onRemove={removeFromWishlist}
                  onSelect={setActiveItem}
                />
              ))}
            </div>
          </section>
        )}

        {itemEntries.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionLabel}>🧥 Clothing Pieces</h2>
            <div className={styles.itemGrid}>
              {itemEntries.map((entry) => (
                <ItemWishCard
                  key={entry.id}
                  entry={entry}
                  onRemove={removeFromWishlist}
                  onSelect={setActiveItem}
                />
              ))}
            </div>
          </section>
        )}

        {photoEntries.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionLabel}>📸 Outfit Photos</h2>
            <div className={styles.photoGrid}>
              {photoEntries.map((entry) => (
                <PhotoWishCard key={entry.id} entry={entry} onRemove={removeFromWishlist} />
              ))}
            </div>
          </section>
        )}
      </div>

      {activeItem && (
        <ItemActionSheet
          item={activeItem}
          onShop={handleOpenShop}
          onClose={() => setActiveItem(null)}
        />
      )}

      {shopItem && (
        <ShopPanel
          item={shopItem}
          onClose={() => setShopItem(null)}
        />
      )}

      {showUpload && (
        <WardrobeUpload
          uid={user?.uid}
          onSave={handleSaveUpload}
          onClose={() => setShowUpload(false)}
        />
      )}
    </div>
  )
}
