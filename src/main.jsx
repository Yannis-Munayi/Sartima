import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import { initCrashReporter } from './services/crashReporter'
import './index.css'
import './styles/aestheticThemes.css'
import App from './App.jsx'

initCrashReporter()

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    // Only send errors in production; keep dev console noise-free
    enabled: import.meta.env.PROD,
    tracesSampleRate: 0,
  })
}

function ErrorFallback() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 'var(--space-3)',
      background: 'var(--bg)', color: 'var(--text)', padding: 'var(--space-6)', textAlign: 'center',
    }}>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', fontWeight: 700, margin: 0 }}>
        Something went wrong
      </p>
      <p style={{ fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-normal)', color: 'var(--text-muted)', margin: 0, maxWidth: 320 }}>
        Sartima hit an unexpected error. Reloading usually fixes it.
      </p>
      <button
        onClick={() => window.location.reload()}
        style={{
          marginTop: 'var(--space-3)', padding: 'var(--space-3) var(--space-8)', background: 'var(--accent)',
          border: 'none', borderRadius: 'var(--radius-md)', color: 'var(--bg)', fontSize: 'var(--text-sm)',
          fontWeight: 700, cursor: 'pointer',
        }}
      >
        Reload
      </button>
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
