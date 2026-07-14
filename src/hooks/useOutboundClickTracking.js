import { useEffect, useRef } from 'react'
import { trackEvent } from '../services/firebase'

// One capture-phase listener covers every outbound retailer/affiliate link
// (all rendered as <a target="_blank">) instead of instrumenting each of the
// ~15 components that render them. Together with 'feed_swipe' this closes the
// recommendation loop: impressions → likes → outbound conversion, attributed
// to the tab the click came from.
export function useOutboundClickTracking(activeTab) {
  const tabRef = useRef(activeTab)
  tabRef.current = activeTab

  useEffect(() => {
    function onClick(e) {
      const anchor = e.target.closest?.('a[target="_blank"]')
      if (!anchor?.href) return
      let url
      try { url = new URL(anchor.href) } catch { return }
      if (url.origin === window.location.origin) return
      trackEvent('outbound_click', {
        host: url.hostname,
        tab:  tabRef.current,
      })
    }
    document.addEventListener('click', onClick, { capture: true })
    return () => document.removeEventListener('click', onClick, { capture: true })
  }, [])
}
