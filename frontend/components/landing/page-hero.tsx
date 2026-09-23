"use client"
import { motion, useReducedMotion } from "motion/react"

const EASE = [0.22, 1, 0.36, 1] as const

/** Encabezado de páginas públicas (Producto, Blog, Contacto…) con entrada animada. */
export function PageHero({ eyebrow, title, description, children }: { eyebrow?: string; title: React.ReactNode; description?: React.ReactNode; children?: React.ReactNode }) {
  const reduce = useReducedMotion()
  const enter = (delay: number) => (reduce ? {} : { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.7, delay, ease: EASE } })
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-background to-muted/20 pb-12 pt-32 text-center md:pb-16 md:pt-40">
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-16 h-[320px] w-[620px] -translate-x-1/2 rounded-full bg-orange-500/10 blur-3xl" />
      <div className="relative mx-auto max-w-3xl px-6">
        {eyebrow && (
          <motion.span {...enter(0)} className="inline-flex items-center rounded-full bg-orange-500 px-3 py-1 text-xs font-semibold text-white">
            {eyebrow}
          </motion.span>
        )}
        <motion.h1 {...enter(0.08)} className="mt-4 text-balance text-3xl font-semibold sm:text-4xl md:text-5xl">{title}</motion.h1>
        {description && <motion.p {...enter(0.16)} className="mx-auto mt-4 max-w-2xl text-pretty text-lg text-muted-foreground">{description}</motion.p>}
        {children && <motion.div {...enter(0.24)} className="mt-8">{children}</motion.div>}
      </div>
    </section>
  )
}
