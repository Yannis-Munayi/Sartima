import styles from './SignupFlow.module.css'

export default function GuestWarningModal({ onKeepGoing, onContinueAsGuest }) {
  return (
    <div className={styles.modalBackdrop} onClick={onKeepGoing}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>Wait — don't miss out</h2>
        <p className={styles.modalBody}>
          These questions feed straight into your recommendations — the aesthetics,
          brands, and gaps you tell us about shape your very first style quiz and
          everything after it. Skipping means starting from scratch.
        </p>
        <div className={styles.modalActions}>
          <button className={styles.modalPrimaryBtn} onClick={onKeepGoing}>
            Keep going
          </button>
          <button className={styles.modalSecondaryBtn} onClick={onContinueAsGuest}>
            Continue as guest anyway
          </button>
        </div>
      </div>
    </div>
  )
}
