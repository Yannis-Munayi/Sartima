const MAX_BUFFER = 50
let _buffer = []
let _installed = false

function push(entry) {
  if (_buffer.length >= MAX_BUFFER) _buffer.shift()
  _buffer.push({ ...entry, ts: Date.now() })
}

export function initCrashReporter() {
  if (_installed || typeof window === 'undefined') return
  _installed = true

  const _consoleError = console.error
  console.error = (...args) => {
    _consoleError.apply(console, args)
    push({
      type: 'error',
      message: args.map((a) => (a instanceof Error ? a.message : String(a))).join(' '),
      stack: args.find((a) => a instanceof Error)?.stack ?? undefined,
    })
  }

  const _consoleWarn = console.warn
  console.warn = (...args) => {
    _consoleWarn.apply(console, args)
    push({
      type: 'warn',
      message: args.map((a) => String(a)).join(' '),
    })
  }

  // Unhandled JS errors (syntax errors, reference errors, etc.)
  window.addEventListener('error', (event) => {
    push({
      type: 'uncaught',
      message: event.message ?? String(event.error),
      stack: event.error?.stack ?? undefined,
      source: event.filename ? `${event.filename}:${event.lineno}` : undefined,
    })
  })

  // Unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    push({
      type: 'unhandledRejection',
      message: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    })
  })

  // Wrap fetch to capture failed network requests
  const _fetch = window.fetch
  window.fetch = async function (input, init) {
    const url =
      typeof input === 'string' ? input
      : input instanceof Request ? input.url
      : String(input)
    const method =
      init?.method
      ?? (input instanceof Request ? input.method : 'GET')
    try {
      const res = await _fetch.call(this, input, init)
      if (!res.ok) {
        push({ type: 'networkError', message: `${method} ${url} → ${res.status}`, status: res.status, url })
      }
      return res
    } catch (err) {
      push({ type: 'networkError', message: `${method} ${url} → ${err.message}`, url })
      throw err
    }
  }
}

export function getLogBuffer() {
  return [..._buffer]
}

export function collectDiagnostics(appState = {}) {
  const mem = typeof performance !== 'undefined' ? performance?.memory : null
  return {
    logs: getLogBuffer(),
    browser: {
      userAgent: navigator.userAgent,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      screen: { width: screen.width, height: screen.height },
      url: window.location.href,
      language: navigator.language,
      onLine: navigator.onLine,
    },
    memory: mem
      ? {
          usedMB: Math.round(mem.usedJSHeapSize / 1048576),
          totalMB: Math.round(mem.totalJSHeapSize / 1048576),
          limitMB: Math.round(mem.jsHeapSizeLimit / 1048576),
        }
      : null,
    appState,
    collectedAt: Date.now(),
  }
}
