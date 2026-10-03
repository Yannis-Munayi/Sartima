import { useMemo } from 'react'
import { STYLES } from '../../data/styles'
import { getBrandsForAesthetic } from '../../data/brands'
import { useApp } from '../../context/AppContext'
import styles from '../../screens/HomeScreen.module.css'

export default function BrandsForYou({ navigate, gender }) {
  const { state } = useApp()

  const topAestheticId = useMemo(() => {
    const total = Object.values(state.styleScores).reduce((a, b) => a + b, 0)
    if (total === 0) return null
    const top = Object.entries(state.styleScores)
      .filter(([, s]) => s > 0)
      .sort(([, a], [, b]) => b - a)[0]
    return top ? top[0] : null
  }, [state.styleScores])

  const brands = useMemo(() => {
    if (!topAestheticId) return []
    return getBrandsForAesthetic(topAestheticId)
  }, [topAestheticId])

  if (brands.length === 0) return null

  const topStyle = STYLES[topAestheticId]

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>Brands for you</h2>
          <p className={styles.sectionSub}>Based on your {topStyle?.name ?? 'top'} aesthetic</p>
        </div>
      </div>
      <div className={styles.brandsScroll}>
        {brands.map((brand) => (
          <button
            key={brand.id}
            className={styles.brandCard}
            onClick={() => navigate(`brand:${brand.id}`)}
          >
            <p className={styles.brandCardName}>{brand.name}</p>
            <p className={styles.brandCardTag}>{brand.tagline}</p>
            <span className={styles.brandCardArrow}>↗</span>
          </button>
        ))}
      </div>
    </section>
  )
}
