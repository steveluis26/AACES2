import React from 'react'
import { cn } from '@/lib/utils'

export function FieldGroup({ children, className }: { children: React.ReactNode, className?: string }) {
  return <div className={cn('grid gap-4', className)}>{children}</div>
}

/**
 * Campo con etiqueta visible y error junto al input.
 * Sin `label`/`error`/`hint` se comporta como antes (contenedor simple).
 */
export function Field({
  children,
  className,
  label,
  htmlFor,
  hint,
  error,
  required,
}: {
  children: React.ReactNode
  className?: string
  label?: React.ReactNode
  htmlFor?: string
  hint?: React.ReactNode
  error?: React.ReactNode
  required?: boolean
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label !== undefined && (
        <label htmlFor={htmlFor} className="text-sm font-medium">
          {label}
          {required && <span className="ml-0.5 text-[var(--destructive)]" aria-hidden="true">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p id={htmlFor ? `${htmlFor}-error` : undefined} role="alert" className="text-xs text-[var(--destructive)]">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

export function FieldLabel({ htmlFor, children, className }: { htmlFor?: string, children: React.ReactNode, className?: string }) {
  return <label htmlFor={htmlFor} className={cn('text-sm font-medium', className)}>{children}</label>
}

export function FieldDescription({ children, className }: { children: React.ReactNode, className?: string }) {
  return <p className={cn('text-sm opacity-70', className)}>{children}</p>
}

export function FieldSeparator({ children, className }: { children?: React.ReactNode, className?: string }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="h-px flex-1 bg-[var(--border)]" />
      {children && <span className="text-xs opacity-70">{children}</span>}
      <div className="h-px flex-1 bg-[var(--border)]" />
    </div>
  )
}