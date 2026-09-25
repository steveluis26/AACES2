"use client"

import Link from "next/link"
import { motion, useReducedMotion } from "motion/react"
import { AlertTriangle, ArrowRight, FileBadge, Package } from "lucide-react"
import { Cupo, fechaCorta, nivelCupo } from "@/lib/cupo"
import { CountUp } from "./CountUp"

const BARRA = { ok: "bg-orange-500", alerta: "bg-amber-500", lleno: "bg-red-500" }

/** Cuántas constancias lleva la agencia en su periodo y cuántas le quedan. */
export function CupoCard({ cupo, delay = 0 }: { cupo?: Cupo; delay?: number }) {
  const reduce = useReducedMotion()
  if (!cupo) return null
  const nivel = nivelCupo(cupo)
  const pct = cupo.porcentaje ?? 0

  const titulo = cupo.es_prueba ? "Constancias de tu prueba" : "Constancias este mes"
  const subtitulo = !cupo.activa
    ? "Tu suscripción no está activa: no puedes emitir constancias nuevas. Las que ya emitiste siguen siendo válidas."
    : cupo.ilimitado
      ? `Plan ${cupo.plan_nombre}: sin límite de constancias.`
      : cupo.es_prueba
        ? `Tu plan de prueba incluye ${cupo.limite} constancias en total.`
        : `Plan ${cupo.plan_nombre} · se reinicia el ${fechaCorta(cupo.periodo_fin)}`

  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className={`rounded-2xl border bg-card p-5 shadow-sm sm:p-6 ${nivel === "lleno" ? "border-red-500/40" : nivel === "alerta" ? "border-amber-500/40" : ""}`}
      aria-label="Uso de constancias"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <FileBadge className="h-4 w-4 text-orange-500" /> {titulo}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{subtitulo}</p>

          {cupo.activa && !cupo.ilimitado && (
            <>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl font-bold tabular-nums tracking-tight"><CountUp value={cupo.usados} /></span>
                <span className="text-sm text-muted-foreground">de {cupo.limite} emitidas</span>
                <span className="ml-auto text-sm font-medium tabular-nums">
                  {cupo.restantes_plan === 0 ? "Sin disponibles" : `Te quedan ${cupo.restantes_plan}`}
                </span>
              </div>
              <div
                className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted"
                role="progressbar" aria-valuemin={0} aria-valuemax={cupo.limite ?? 0} aria-valuenow={cupo.usados}
                aria-label={`${cupo.usados} de ${cupo.limite} constancias usadas`}
              >
                <motion.div
                  className={`h-full rounded-full ${BARRA[nivel]}`}
                  initial={reduce ? false : { width: 0 }}
                  animate={{ width: `${Math.max(pct, cupo.usados ? 2 : 0)}%` }}
                  transition={{ duration: 0.9, delay: delay + 0.2, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
            </>
          )}
          {cupo.activa && cupo.ilimitado && (
            <p className="mt-4 text-3xl font-bold tabular-nums tracking-tight"><CountUp value={cupo.usados} /> <span className="text-sm font-normal text-muted-foreground">emitidas este mes</span></p>
          )}

          {cupo.extra > 0 && (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-orange-500/10 px-2.5 py-1 text-xs font-medium text-orange-600 dark:text-orange-400">
              <Package className="h-3.5 w-3.5" /> {cupo.extra} extra de tus paquetes · no caducan
            </p>
          )}
          {nivel !== "ok" && cupo.activa && (
            <p className="mt-3 flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {nivel === "lleno"
                ? "Ya no puedes emitir constancias nuevas en este periodo. Compra un paquete extra o sube de plan."
                : "Estás cerca del límite de tu plan."}
            </p>
          )}
        </div>

        {(nivel !== "ok" || cupo.es_prueba) && (
          <Link
            href="/cliente/pagos"
            className="group inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600"
          >
            {cupo.es_prueba ? "Elegir un plan" : "Mejorar mi plan"} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}
      </div>
    </motion.section>
  )
}
