// Native-app install helpers for the "Get the app" footer.
//
// Android ships as a signed APK (a Trusted Web Activity wrapping this site —
// see android/README.md), served from /downloads/sartima.apk.
// Windows installs the PWA itself through Edge/Chrome's install prompt, which
// gives a Start-menu app with its own window and the same auto-updates as the site.
//
// `beforeinstallprompt` fires once, early, and only to listeners that already
// exist, so this module is imported from main.jsx to attach before React mounts.

import { logWarn } from './logger'

export const ANDROID_APK_URL = '/downloads/sartima.apk'

const TWA_FLAG_KEY = 'sartima_in_android_app'

let deferredPrompt = null
let installed = false
const listeners = new Set()

function emit() {
  listeners.forEach(fn => fn())
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Keep the browser's mini-infobar quiet; the footer offers install instead.
    e.preventDefault()
    deferredPrompt = e
    emit()
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    installed = true
    emit()
  })

  // The Android app launches /?source=android; remember it for the session,
  // since in-app navigation drops the query string.
  try {
    if (new URLSearchParams(window.location.search).get('source') === 'android') {
      sessionStorage.setItem(TWA_FLAG_KEY, '1')
    }
  } catch { /* storage blocked — the referrer check below still works */ }
}

/** True when Sartima is already running as an installed app (Android TWA or desktop PWA). */
export function isRunningAsApp() {
  if (typeof window === 'undefined') return false
  if (document.referrer.startsWith('android-app://')) return true
  try {
    if (sessionStorage.getItem(TWA_FLAG_KEY) === '1') return true
  } catch { /* ignore */ }
  return ['standalone', 'minimal-ui', 'window-controls-overlay']
    .some(mode => window.matchMedia(`(display-mode: ${mode})`).matches)
}

export function getInstallState() {
  return { canPrompt: !!deferredPrompt, installed }
}

export function subscribeInstallState(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/**
 * Shows the browser's install dialog. Resolves to 'accepted', 'dismissed',
 * or 'unavailable' when the browser hasn't offered one (Firefox, Safari,
 * already installed, or the page hasn't met the install criteria yet).
 */
export async function promptInstall() {
  if (!deferredPrompt) return 'unavailable'
  const prompt = deferredPrompt
  deferredPrompt = null
  emit()
  try {
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    return outcome
  } catch (err) {
    logWarn('appInstall', 'install prompt failed', { error: err?.message })
    return 'unavailable'
  }
}
