"use client"

import Link from "next/link"
import { motion, useReducedMotion } from "motion/react"
import { ArrowRight, ShieldCheck } from "lucide-react"
import { CountUp } from "./CountUp"

type Confianza = { emitidos: number; consultados: number; tasa: number; ciudades: number }

export function ConfidenceCard({ data, delay = 0 }: { data?: Confianza; delay?: number }) {
  const reduce = useReducedMotion()
  const d = data || { emitidos: 0, consultados: 0, tasa: 0, ciudades: 0 }
  const stats = [
    { l: "Constancias emitidas", v: d.emitidos },
    { l: "Constancias verificadas", v: d.consultados },
    { l: "Verificadores únicos", v: d.ciudades },
  ]
  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-2xl bg-orange-500 p-5 text-white shadow-lg shadow-orange-500/20 sm:p-6"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.16)_1px,transparent_0)] [background-size:18px_18px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/15 blur-2xl" />
      <div className="relative">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          <h2 className="text-base font-semibold">Confianza generada</h2>
        </div>
        <p className="mt-1 text-sm text-white/80">Cuántas veces empresas han verificado tus constancias.</p>

        <div className="mt-5 flex items-end gap-3">
          <span className="text-5xl font-bold tabular-nums tracking-tight"><CountUp value={d.tasa} suffix="%" decimals={d.tasa % 1 ? 1 : 0} /></span>
          <span className="mb-1.5 text-sm text-white/80">de tus constancias<br />ya fueron verificadas</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/20">
          <motion.div
            className="h-full rounded-full bg-white"
            initial={reduce ? false : { width: 0 }}
            animate={{ width: `${Math.min(100, d.tasa)}%` }}
            transition={{ duration: 1, delay: delay + 0.3, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>

        <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-white/20 pt-4">
          {stats.map((s) => (
            <div key={s.l}>
              <dd className="text-xl font-bold tabular-nums"><CountUp value={s.v} /></dd>
              <dt className="text-[11px] leading-tight text-white/80">{s.l}</dt>
            </div>
          ))}
        </dl>
        <Link href="/verificar" className="group mt-4 inline-flex items-center gap-1 text-xs font-semibold text-white/90 hover:text-white">
          Así lo ven tus clientes <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </motion.section>
  )
}
