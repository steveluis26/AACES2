"use client"

import Link from "next/link"
import { motion, useReducedMotion } from "motion/react"
import { ArrowRight } from "lucide-react"

/** Tarjeta de sección del dashboard: título, enlace opcional y entrada animada. */
export function Panel({ titulo, icono: Icono, href, hrefLabel = "Ver todo", delay = 0, className = "", children }: {
  titulo: string
  icono?: React.ComponentType<{ className?: string }>
  href?: string
  hrefLabel?: string
  delay?: number
  className?: string
  children: React.ReactNode
}) {
  const reduce = useReducedMotion()
  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className={`rounded-2xl border bg-card p-5 shadow-sm sm:p-6 ${className}`}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          {Icono && <Icono className="h-4 w-4 text-orange-500" />}
          {titulo}
        </h2>
        {href && (
          <Link href={href} className="group inline-flex items-center gap-1 text-xs font-medium text-orange-500 hover:text-orange-600">
            {hrefLabel} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}
      </div>
      {children}
    </motion.section>
  )
}

export function Vacio({ icono: Icono, texto, accion }: { icono: React.ComponentType<{ className?: string }>; texto: string; accion?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-8 text-center">
      <Icono className="h-6 w-6 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{texto}</p>
      {accion}
    </div>
  )
}
