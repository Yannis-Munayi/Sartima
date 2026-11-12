import { useEffect, useState } from 'react'
import Icon from './Icon'
import { trackEvent } from '../services/firebase'
import {
  ANDROID_APK_URL,
  getInstallState,
  isRunningAsApp,
  promptInstall,
  subscribeInstallState,
} from '../services/appInstall'
import styles from './GetTheApp.module.css'

function windowsHelpText() {
  const ua = navigator.userAgent
  const chromium = /Edg\/|Chrome\//.test(ua) && !/OPR\//.test(ua)
  return chromium
    ? 'Click the install icon at the right of the address bar, or open the browser menu and choose Install Sartima.'
    : 'Open www.sartima.ca in Microsoft Edge or Google Chrome on your PC, then choose Install Sartima from the address bar.'
}

/**
 * "Get the app" links: Android APK download + Windows install.
 * variant="footer" is the full block at the bottom of Home;
 * variant="inline" is a single text line for the sign-in screen.
 * Renders nothing when Sartima is already running as an installed app.
 */
export default function GetTheApp({ variant = 'footer' }) {
  const [install, setInstall] = useState(getInstallState)
  const [installing, setInstalling] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => subscribeInstallState(() => setInstall(getInstallState())), [])

  if (isRunningAsApp()) return null

  const onAndroid = () => {
    trackEvent('app_download', { platform: 'android', placement: variant })
  }

  const onWindows = async () => {
    trackEvent('app_download', { platform: 'windows', placement: variant })
    if (!install.canPrompt) {
      setShowHelp(true)
      return
    }
    setInstalling(true)
    const outcome = await promptInstall()
    setInstalling(false)
    if (outcome === 'unavailable') setShowHelp(true)
  }

  const windowsLabel = install.installed ? 'Installed on this PC' : installing ? 'Opening installer…' : 'Windows'

  if (variant === 'inline') {
    return (
      <div className={styles.inline}>
        <span>Get the app:</span>
        <a className={styles.inlineLink} href={ANDROID_APK_URL} download onClick={onAndroid}>Android</a>
        <span aria-hidden="true">·</span>
        <button
          type="button"
          className={styles.inlineLink}
          onClick={onWindows}
          disabled={installing || install.installed}
        >
          {windowsLabel}
        </button>
        {showHelp && <p className={styles.help} role="status">{windowsHelpText()}</p>}
      </div>
    )
  }

  return (
    <footer className={styles.footer} aria-labelledby="get-the-app-title">
      <div className={styles.head}>
        <Icon name="download" size={18} className={styles.headIcon} />
        <div>
          <h2 id="get-the-app-title" className={styles.title}>Get the Sartima app</h2>
          <p className={styles.sub}>Same account, same closet — opens straight to your feed.</p>
        </div>
      </div>

      <div className={styles.buttons}>
        <a className={styles.btn} href={ANDROID_APK_URL} download onClick={onAndroid}>
          <Icon name="smartphone" size={20} />
          <span className={styles.btnText}>
            <span className={styles.btnLabel}>Android</span>
            <span className={styles.btnMeta}>Download APK</span>
          </span>
        </a>
        <button
          type="button"
          className={styles.btn}
          onClick={onWindows}
          disabled={installing || install.installed}
        >
          <Icon name="monitor" size={20} />
          <span className={styles.btnText}>
            <span className={styles.btnLabel}>{windowsLabel}</span>
            <span className={styles.btnMeta}>Install desktop app</span>
          </span>
        </button>
      </div>

      {showHelp && <p className={styles.help} role="status">{windowsHelpText()}</p>}
      <p className={styles.note}>
        Android: if asked, allow your browser to install apps, then open the downloaded file.
      </p>
    </footer>
  )
}
