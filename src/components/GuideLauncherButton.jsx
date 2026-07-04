import { GUIDE_ORDER } from '../data/guideSteps'
import styles from './GuideLauncherButton.module.css'

function resolveGuideKey(activeTab) {
  if (activeTab.startsWith('aesthetic:')) return 'explore'
  if (activeTab.startsWith('brand:'))     return 'brands'
  if (GUIDE_ORDER.includes(activeTab))    return activeTab
  return 'home'
}

export default function GuideLauncherButton({ activeTab, onLaunch }) {
  return (
    <button
      className={styles.launcher}
      onClick={() => onLaunch(resolveGuideKey(activeTab))}
      aria-label="Take a guided tour of this tab"
    >
      ?
    </button>
  )
}
