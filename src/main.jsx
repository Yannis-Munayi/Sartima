import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import { initCrashReporter } from './services/crashReporter'
import './index.css'
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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
