import React from 'react'
import { cn } from '@/lib/utils'

export function FieldGroup({ children, className }: { children: React.ReactNode, className?: string }) {
  return <div className={cn('grid gap-4', className)}>{children}</div>
}

export function Field({ children, className }: { children: React.ReactNode, className?: string }) {
  return <div className={cn('space-y-2', className)}>{children}</div>
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