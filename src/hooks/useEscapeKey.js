import { useEffect, useRef } from 'react'

// Escape closes the topmost open layer (sheet, modal, popover, tour) and only
// that one — the Terms modal opened from the paywall closes before the
// paywall does. Layers register in open order; one document listener serves
// them all. Global shortcuts check hasOpenLayer() so they stay quiet while a
// dialog owns the keyboard.

const layers = []

function onKeyDown(e) {
  if (e.key !== 'Escape' || e.isComposing || e.defaultPrevented || layers.length === 0) return
  e.preventDefault()
  layers[layers.length - 1].current?.()
}

export function hasOpenLayer() {
  return layers.length > 0
}

export function useEscapeKey(onEscape, enabled = true) {
  const handlerRef = useRef(onEscape)
  handlerRef.current = onEscape

  useEffect(() => {
    if (!enabled) return
    const entry = handlerRef
    layers.push(entry)
    if (layers.length === 1) document.addEventListener('keydown', onKeyDown)
    return () => {
      const i = layers.lastIndexOf(entry)
      if (i !== -1) layers.splice(i, 1)
      if (layers.length === 0) document.removeEventListener('keydown', onKeyDown)
    }
  }, [enabled])
}
