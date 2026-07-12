import { LEGAL_DRAFT_NOTICE, LEGAL_UPDATED_AT } from '../data/legalContent'
import styles from './LegalModal.module.css'

export default function LegalModal({ doc, onClose }) {
  if (!doc) return null

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.modal} role="dialog" aria-modal="true">
        <div className={styles.header}>
          <h2 className={styles.title}>{doc.title}</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className={styles.body}>
          <p className={styles.updated}>Last updated {LEGAL_UPDATED_AT}</p>
          <p className={styles.draftNotice}>{LEGAL_DRAFT_NOTICE}</p>

          {doc.sections.map((section) => (
            <section key={section.heading} className={styles.section}>
              <h3 className={styles.heading}>{section.heading}</h3>
              {section.paragraphs.map((p, i) => (
                <p key={i} className={styles.paragraph}>{p}</p>
              ))}
            </section>
          ))}
        </div>
      </div>
    </>
  )
}
