import { STYLES } from '../../data/styles'
import { AESTHETIC_DEPTH } from '../../data/aestheticDepth'
import { useNavigation } from '../../context/NavigationContext'
import { BRAND_NAME_TO_ID } from '../../data/brands'
import styles from '../AestheticScreen.module.css'

function StorySection({ title, children }) {
  return (
    <section className={styles.storySection}>
      <div className={styles.storySectionHeader}>
        <h3 className={styles.storySectionTitle}>{title}</h3>
      </div>
      {children}
    </section>
  )
}

export default function StoryTab({ aestheticId }) {
  const navigate = useNavigation()
  const data  = AESTHETIC_DEPTH[aestheticId]
  const style = STYLES[aestheticId]
  if (!data) {
    return <p className={styles.emptyText}>Deep dive coming soon for this aesthetic.</p>
  }

  function handleBrandClick(brandName) {
    const brandId = BRAND_NAME_TO_ID[brandName]
    if (brandId) navigate(`brand:${brandId}`)
  }

  return (
    <div className={styles.storyTab}>
      <div className={styles.storyMeta}>
        <span className={styles.storyPill}>{data.era}</span>
        <span className={styles.storyPill}>{data.origin}</span>
      </div>

      <StorySection title="History & Origin">
        <p className={styles.storyBody}>{data.history}</p>
      </StorySection>

      <StorySection title="Key Garments">
        <div className={styles.garmentList}>
          {data.keyGarments.map((g) => (
            <div key={g.name} className={styles.garmentRow}>
              <span className={styles.garmentName}>{g.name}</span>
              <span className={styles.garmentDesc}>{g.desc}</span>
            </div>
          ))}
        </div>
      </StorySection>

      <StorySection title="Icons Who Shaped It">
        <div className={styles.personList}>
          {data.icons.map((p) => (
            <div key={p.name} className={styles.personCard}>
              <span className={styles.personName}>{p.name}</span>
              <span className={styles.personMeta}>{p.role} · {p.era}</span>
            </div>
          ))}
        </div>
      </StorySection>

      <StorySection title="Modern Representatives">
        <div className={styles.personList}>
          {data.modernReps.map((p) => (
            <div key={p.name} className={styles.personCard}>
              <span className={styles.personName}>{p.name}</span>
              <span className={styles.personMeta}>{p.type}</span>
            </div>
          ))}
        </div>
      </StorySection>

      <StorySection title="Cultural Context">
        <p className={styles.storyBody}>{data.culturalContext}</p>
      </StorySection>

      {style?.brands?.length > 0 && (
        <StorySection title="Brands to Know">
          <div className={styles.brandChips}>
            {style.brands.map((b) => {
              const hasBrandPage = !!BRAND_NAME_TO_ID[b]
              return hasBrandPage ? (
                <button
                  key={b}
                  className={`${styles.brandChip} ${styles.brandChipLink}`}
                  onClick={() => handleBrandClick(b)}
                >
                  {b} ↗
                </button>
              ) : (
                <span key={b} className={styles.brandChip}>{b}</span>
              )
            })}
          </div>
        </StorySection>
      )}
    </div>
  )
}
