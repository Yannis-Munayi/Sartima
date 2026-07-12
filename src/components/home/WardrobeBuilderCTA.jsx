import styles from '../../screens/HomeScreen.module.css'

export default function WardrobeBuilderCTA({ navigate }) {
  return (
    <section className={styles.section}>
      <button
        className={styles.wardrobeCTA}
        onClick={() => navigate('wardrobe-builder')}
      >
        <div className={styles.wardrobeCTAIcon}>👗</div>
        <div className={styles.wardrobeCTAText}>
          <p className={styles.wardrobeCTATitle}>Shop Scout</p>
          <p className={styles.wardrobeCTASub}>
            Pick pieces, set your budget → find the best brands to shop
          </p>
        </div>
        <span className={styles.wardrobeCTAArrow}>→</span>
      </button>
    </section>
  )
}
