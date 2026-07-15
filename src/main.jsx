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
      alignItems: 'center', justifyContent: 'center', gap: 16,
      background: '#0C0A08', color: '#fff', padding: 24, textAlign: 'center',
    }}>
      <p style={{ fontSize: 40, margin: 0 }}>⚠️</p>
      <p style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Something went wrong</p>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: 0, maxWidth: 320 }}>
        Sartima hit an unexpected error. Reloading usually fixes it.
      </p>
      <button
        onClick={() => window.location.reload()}
        style={{
          marginTop: 8, padding: '12px 28px', background: '#B8956A', border: 'none',
          borderRadius: 8, color: '#0B0907', fontSize: 13, fontWeight: 700, cursor: 'pointer',
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
