'use client'

import { useEffect } from 'react'

// Baliza de errores del cliente: captura window.onerror y unhandledrejection
// y los reporta a /api/v1/telemetry/client-error (backend -> /tmp/aaces_client_errors.log).
// Así el agente puede leer los errores de JS del navegador sin que el usuario
// tenga que pegar la consola manualmente.
//
// Montar una sola vez por árbol de pantallas. Es innocuo: nunca rompe la UI.

export function ErrorBeacon() {
  useEffect(() => {
    const report = (body: Record<string, unknown>) => {
      try {
        const payload = {
          ...body,
          href: typeof window !== 'undefined' ? window.location.href : null,
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        }
        // Usar sendBeacon si existe (sobrevive a la navegación), si no fetch.
        if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
          const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
          navigator.sendBeacon('/api/v1/telemetry/client-error', blob)
        } else {
          fetch('/api/v1/telemetry/client-error', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            keepalive: true,
          }).catch(() => {})
        }
      } catch {
        /* nunca debe lanzar */
      }
    }

    const onError = (e: ErrorEvent) => {
      report({
        kind: 'error',
        message: e.message || 'Unknown error',
        source: e.filename || '',
        lineno: e.lineno ?? null,
        colno: e.colno ?? null,
        stack: e.error?.stack || null,
      })
    }

    const onRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason as any
      report({
        kind: 'unhandledrejection',
        message: reason?.message || String(reason) || 'Unhandled promise rejection',
        stack: reason?.stack || null,
      })
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  return null
}
