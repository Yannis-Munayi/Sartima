import { useEscapeKey } from '../hooks/useEscapeKey'
import { IS_MAC } from '../hooks/useKeyboardShortcuts'
import styles from './ShortcutsDialog.module.css'

const MOD = IS_MAC ? '⌘' : 'Ctrl'

// `then` marks a sequence (press G, release, press H); otherwise keys are held together
function buildSections(showQuizTab) {
  return [
    {
      title: 'General',
      rows: [
        { keys: ['/'],      label: 'Focus search' },
        { keys: [MOD, 'K'], label: 'Search the catalog' },
        { keys: ['?'],      label: 'Show keyboard shortcuts' },
        { keys: ['Esc'],    label: 'Close a dialog or leave a field' },
      ],
    },
    {
      title: 'Go to',
      rows: [
        { keys: ['G', 'H'], then: true, label: 'Home' },
        { keys: ['G', 'A'], then: true, label: 'Aesthetics' },
        { keys: ['G', 'B'], then: true, label: 'Brands' },
        ...(showQuizTab ? [{ keys: ['G', 'D'], then: true, label: 'Discover' }] : []),
        { keys: ['G', 'S'], then: true, label: 'Search' },
        { keys: ['G', 'O'], then: true, label: 'Outfits' },
        { keys: ['G', 'P'], then: true, label: 'Profile' },
      ],
    },
    {
      title: 'Style quiz',
      rows: [
        { keys: ['←'], label: 'Skip' },
        { keys: ['→'], label: 'Like' },
      ],
    },
    {
      title: 'Guided tour',
      rows: [
        { keys: ['←'], label: 'Previous step' },
        { keys: ['→'], label: 'Next step' },
      ],
    },
  ]
}

export default function ShortcutsDialog({ showQuizTab, onClose }) {
  useEscapeKey(onClose)

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 id="shortcuts-title" className={styles.title}>Keyboard shortcuts</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close" autoFocus>✕</button>
        </div>

        {buildSections(showQuizTab).map((section) => (
          <section key={section.title} className={styles.section}>
            <h3 className={styles.sectionTitle}>{section.title}</h3>
            <ul className={styles.list}>
              {section.rows.map((row) => (
                <li key={row.label} className={styles.row}>
                  <span>{row.label}</span>
                  <span className={styles.keys}>
                    {row.keys.map((k, i) => (
                      <span key={k} className={styles.keyGroup}>
                        {i > 0 && row.then && <span className={styles.then}>then</span>}
                        <kbd className={styles.kbd}>{k}</kbd>
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
