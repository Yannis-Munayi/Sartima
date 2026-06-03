import * as Sentry from '@sentry/react'

export function logError(service, message, context = {}) {
  console.error(`[${service}]`, message, context)
  const { error, ...extra } = context
  Sentry.withScope((scope) => {
    scope.setTag('service', service)
    scope.setExtras(extra)
    if (error instanceof Error) {
      Sentry.captureException(error)
    } else {
      Sentry.captureMessage(`${service}: ${message}`, 'error')
    }
  })
}

export function logWarn(service, message, context = {}) {
  console.warn(`[${service}]`, message, context)
  Sentry.withScope((scope) => {
    scope.setTag('service', service)
    scope.setExtras(context)
    Sentry.captureMessage(`${service}: ${message}`, 'warning')
  })
}
