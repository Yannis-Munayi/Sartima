// Dependency-free iOS/standalone-mode detection — split out of notifications.js
// so screens can check it synchronously at render time without pulling in
// the (heavier) Firebase Messaging SDK via a static import.

function isIOS() {
  return /iP(hone|ad|od)/.test(navigator.userAgent)
}

// iOS Safari only supports web push for an installed (Add to Home Screen) PWA.
export function isIOSStandaloneRequired() {
  if (!isIOS()) return false
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone
  return !standalone
}
