import { useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { useInterests } from '../context/InterestContext'
import { getPinterestUrl } from '../data/styles'
import styles from './ItemActionSheet.module.css'
import Icon from './Icon'

export default function ItemActionSheet({ item, onShop, onRemove, onClose }) {
  const { state } = useApp()
  const { recordInterest } = useInterests() ?? {}
  const isProduct    = item.type === 'product'
  const pinterestUrl = getPinterestUrl(null, state.gender, item.name)

  // Opening the sheet = the user clicked this product for a closer look
  useEffect(() => {
    recordInterest?.('view', { product: item })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id])

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        {/* Item preview */}
        <div className={styles.itemPreview} style={{ background: item.gradient }}>
          {isProduct && item.brand
            ? <span className={styles.itemBrand}>{item.brand}</span>
            : <span className={styles.itemEmoji}>{item.emoji}</span>
          }
        </div>
        <p className={styles.itemName}>{item.name}</p>
        <p className={styles.itemDesc}>{item.description}</p>

        <div className={styles.actions}>
          <a
            href={pinterestUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.actionBtn}
            onClick={onClose}
          >
            <span className={styles.actionIcon}><Icon name="bookmark" /></span>
            <span className={styles.actionText}>View on Pinterest</span>
            <span className={styles.actionArrow}>↗</span>
          </a>

          {isProduct && item.shopUrl ? (
            /* Direct shop link for products */
            <a
              href={item.shopUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`${styles.actionBtn} ${styles.shopBtn}`}
              onClick={() => { recordInterest?.('shop', { product: item }); onClose() }}
            >
              <span className={styles.actionIcon}><Icon name="bag" /></span>
              <span className={styles.actionText}>Shop at {item.brand}</span>
              <span className={styles.actionArrow}>↗</span>
            </a>
          ) : (
            /* ShopPanel for generic items */
            <button className={`${styles.actionBtn} ${styles.shopBtn}`} onClick={onShop}>
              <span className={styles.actionIcon}><Icon name="bag" /></span>
              <span className={styles.actionText}>Shop this item</span>
              <span className={styles.actionArrow}>→</span>
            </button>
          )}

          {/* Fallback search link for products */}
          {isProduct && item.shopFallbackUrl && (
            <a
              href={item.shopFallbackUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.actionBtn}
              onClick={() => { recordInterest?.('shop', { product: item }); onClose() }}
            >
              <span className={styles.actionIcon}><Icon name="search" /></span>
              <span className={styles.actionText}>Search {item.brand} for this</span>
              <span className={styles.actionArrow}>↗</span>
            </a>
          )}
        </div>

        {onRemove && (
          <button
            className={`${styles.actionBtn} ${styles.removeBtn}`}
            onClick={onRemove}
          >
            <span className={styles.actionIcon}><Icon name="trash" /></span>
            <span className={styles.actionText}>Remove from liked</span>
          </button>
        )}

        <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}
