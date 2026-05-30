import React from 'react'

interface DialogProps {
  open: boolean
  onClose?: () => void
  children: React.ReactNode
}

export function Dialog({ open, onClose, children }: DialogProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-lg border bg-popover text-popover-foreground shadow-xl">
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

export const DialogContent = ({ children }: { children: React.ReactNode }) => (
  <div className="px-6 py-4">{children}</div>
)

export const DialogFooter = ({ children }: { children: React.ReactNode }) => (
  <div className="flex flex-col items-stretch gap-2 border-t border px-6 py-4 sm:flex-row sm:flex-wrap sm:justify-end sm:items-center">{children}</div>
)
