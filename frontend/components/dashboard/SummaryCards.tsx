"use client"

import Link from "next/link"
import { motion, useReducedMotion } from "motion/react"
import { AlertTriangle, ArrowUpRight, BookOpen, FileCheck2, Users } from "lucide-react"
import { CountUp } from "./CountUp"

type Kpis = {
  cursos_activos: number
  participantes: number
  constancias_mes: number
  por_vencer: number
}

export function SummaryCards({ kpis }: { kpis: Kpis }) {
  const reduce = useReducedMotion()
  const cards = [
    { label: "Cursos activos", sub: "En curso y próximos", value: kpis.cursos_activos, icon: BookOpen, href: "/cliente/cursos", alerta: false },
    { label: "Participantes inscritos", sub: "En todos tus cursos", value: kpis.participantes, icon: Users, href: "/cliente/participantes", alerta: false },
    { label: "Constancias del mes", sub: "Emitidas este mes", value: kpis.constancias_mes, icon: FileCheck2, href: "/cliente/constancias", alerta: false },
    { label: "Por vencer", sub: "En los próximos 30 días", value: kpis.por_vencer, icon: AlertTriangle, href: "/cliente/renovaciones", alerta: kpis.por_vencer > 0 },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {cards.map((c, i) => (
        <motion.div
          key={c.label}
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1 + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
        >
          <Link
            href={c.href}
            className={`group relative flex h-full flex-col justify-between gap-4 overflow-hidden rounded-2xl border bg-card p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md sm:p-5 ${c.alerta ? "border-amber-300/70 hover:border-amber-400 dark:border-amber-500/40" : "hover:border-orange-500/30"}`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 ${c.alerta ? "bg-amber-100 text-amber-600 dark:bg-amber-500/15" : "bg-orange-500/10 text-orange-500"}`}>
                <c.icon className="h-5 w-5" />
              </span>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-100" />
            </div>
            <div>
              <p className="text-3xl font-bold tabular-nums tracking-tight"><CountUp value={c.value} /></p>
              <p className="mt-1 text-sm font-medium">{c.label}</p>
              <p className="text-xs text-muted-foreground">{c.sub}</p>
            </div>
          </Link>
        </motion.div>
      ))}
    </div>
  )
}
