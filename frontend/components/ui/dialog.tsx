import React from 'react'

interface DialogProps {
  open: boolean
  onClose?: () => void
  children: React.ReactNode
  className?: string
}

export function Dialog({ open, onClose, children, className }: DialogProps) {
  // Cierra con Esc y bloquea el scroll del fondo mientras está abierto
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose?.() }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200" onClick={onClose} />
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center p-4">
        <div role="dialog" aria-modal="true" className={`pointer-events-auto w-full max-w-lg overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-2xl motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:slide-in-from-bottom-2 motion-safe:duration-200 ${className || ''}`}>
          {children}
        </div>
      </div>
    </div>
  )
}

export const DialogHeader = ({ children }: { children: React.ReactNode }) => (
  <div className="border-b border px-6 py-4">{children}</div>
)

export const DialogTitle = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-lg font-semibold">{children}</h3>
)

export const DialogContent = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={`px-6 py-4 ${className || ''}`}>{children}</div>
)

export const DialogFooter = ({ children }: { children: React.ReactNode }) => (
  <div className="flex flex-col items-stretch gap-2 border-t border px-6 py-4 sm:flex-row sm:flex-wrap sm:justify-end sm:items-center">{children}</div>
)
