"use client"

import * as React from "react"
import { motion, useReducedMotion } from "motion/react"
import { cn } from "@/lib/utils"

/** Sección numerada de formulario (mismo patrón que "Crear curso"). */
export function FormStep({ n, title, desc, children, className }: { n?: number; title: string; desc?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("space-y-4", className)}>
      <div className="flex items-start gap-3">
        {n !== undefined && (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-500 text-xs font-bold text-white">{n}</span>
        )}
        <div>
          <h3 className="text-sm font-semibold leading-7">{title}</h3>
          {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
        </div>
      </div>
      <div className={n !== undefined ? "sm:pl-10" : undefined}>{children}</div>
    </section>
  )
}

/** Selector segmentado con indicador animado. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  id,
  ariaLabel,
  className,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: React.ReactNode }[]
  id?: string
  ariaLabel?: string
  className?: string
}) {
  const reduce = useReducedMotion()
  const group = React.useId()
  return (
    <div id={id} role="radiogroup" aria-label={ariaLabel} className={cn("grid auto-cols-fr grid-flow-col gap-1 rounded-lg bg-muted p-1", className)}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative rounded-md px-3 py-1.5 text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500",
              active ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId={reduce ? undefined : `seg-${group}`}
                className="absolute inset-0 rounded-md bg-background shadow-sm"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Envuelve un input con prefijo ($) y/o sufijo (MXN, meses, h). */
export function Affix({ prefix, suffix, children }: { prefix?: string; suffix?: string; children: React.ReactElement<{ className?: string }> }) {
  const child = React.cloneElement(children, {
    className: cn(children.props.className, prefix && "pl-7", suffix && (suffix.length > 3 ? "pr-16" : "pr-12")),
  })
  return (
    <div className="relative">
      {prefix && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{prefix}</span>}
      {child}
      {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>}
    </div>
  )
}

/** Atajos rápidos en forma de chips (ej. 12 / 24 / 36 meses). */
export function QuickChips({ values, current, onPick, format }: { values: (string | number)[]; current: string; onPick: (v: string) => void; format?: (v: string | number) => string }) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {values.map((v) => {
        const active = current === String(v)
        return (
          <button
            key={v}
            type="button"
            onClick={() => onPick(String(v))}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors duration-200",
              active ? "border-orange-500 bg-orange-50 text-orange-500 dark:bg-orange-500/10" : "hover:bg-muted",
            )}
          >
            {format ? format(v) : v}
          </button>
        )
      })}
    </div>
  )
}

/** Interruptor accesible dentro de una tarjeta con título y descripción. */
export function SwitchCard({ checked, onChange, title, desc, id }: { checked: boolean; onChange: (v: boolean) => void; title: string; desc?: string; id: string }) {
  return (
    <label htmlFor={id} className={cn(
      "flex cursor-pointer items-start justify-between gap-4 rounded-xl border p-4 transition-colors duration-200",
      checked ? "border-orange-500/40 bg-orange-50/60 dark:bg-orange-500/5" : "hover:bg-muted/50",
    )}>
      <span>
        <span className="block text-sm font-medium">{title}</span>
        {desc && <span className="mt-0.5 block text-xs text-muted-foreground">{desc}</span>}
      </span>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2",
          checked ? "bg-orange-500" : "bg-gray-300 dark:bg-gray-600",
        )}
      >
        <span className={cn("inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200", checked ? "translate-x-5" : "translate-x-0.5")} />
      </button>
    </label>
  )
}

export const textareaCls =
  "flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:text-sm"
