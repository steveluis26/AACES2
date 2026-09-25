"use client"

import { motion, useReducedMotion } from "motion/react"
import { ArrowRight, BarChart3, CheckCircle2, Lightbulb, TrendingUp } from "lucide-react"
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Panel } from "@/components/dashboard/Panel"
import type { Cupo, Recomendacion } from "@/lib/cupo"
import { fechaCorta } from "@/lib/cupo"

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
const MESES_L = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
const nombreMes = (v: string, largo = false) => {
  const [y, m] = String(v).split("-")
  const i = parseInt(m) - 1
  return largo ? `${MESES_L[i] ?? v} ${y}` : MESES[i] ?? v
}

function Globo({ active, payload, label, limite }: { active?: boolean; payload?: { value: number }[]; label?: string; limite?: number | null }) {
  if (!active || !payload?.length) return null
  const v = payload[0].value
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="capitalize text-muted-foreground">{nombreMes(String(label), true)}</p>
      <p className="mt-0.5 text-sm font-semibold">{v} {v === 1 ? "constancia" : "constancias"}</p>
      {limite ? <p className="text-muted-foreground">{Math.round((v / limite) * 100)}% de tu plan</p> : null}
    </div>
  )
}

const ESTILO: Record<Recomendacion["nivel"], { caja: string; icono: string; I: typeof CheckCircle2 }> = {
  ok: { caja: "border-green-500/30 bg-green-50/60 dark:bg-green-500/5", icono: "bg-green-600", I: CheckCircle2 },
  atencion: { caja: "border-amber-500/40 bg-amber-50/70 dark:bg-amber-500/5", icono: "bg-amber-500", I: TrendingUp },
  subir: { caja: "border-orange-500/40 bg-orange-50/70 dark:bg-orange-500/5", icono: "bg-orange-500", I: Lightbulb },
}

/** Uso mes a mes y qué plan le conviene según su ritmo. */
export function UsoConstancias({ cupo, onElegirPlan }: { cupo: Cupo; onElegirPlan?: (codigo: string) => void }) {
  const reduce = useReducedMotion()
  const hist = cupo.historial || []
  const rec = cupo.recomendacion
  const limite = !cupo.ilimitado && !cupo.es_prueba ? cupo.limite : null
  const mesActual = hist.length ? hist[hist.length - 1].mes : ""
  const total = hist.reduce((a, h) => a + h.emitidas, 0)
  const est = rec ? ESTILO[rec.nivel] : null

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Panel titulo="Constancias por mes" icono={BarChart3} className="lg:col-span-3">
        <p className="-mt-2 mb-3 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{total}</span> en los últimos {hist.length} meses
          {limite ? <> · la línea marca tu plan ({limite} al mes)</> : null}
        </p>
        <div className="h-56" role="img" aria-label={`Constancias emitidas por mes: ${hist.map((h) => `${nombreMes(h.mes, true)} ${h.emitidas}`).join(", ")}`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hist} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="mes" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} tickFormatter={(v) => nombreMes(v)} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12 }} domain={[0, (max: number) => Math.max(max, limite ?? 0)]} />
              <Tooltip content={<Globo limite={limite} />} cursor={{ fill: "rgba(249,115,22,0.08)" }} />
              {limite ? <ReferenceLine y={limite} stroke="#ef4444" strokeDasharray="5 4" strokeWidth={1.5} /> : null}
              <Bar dataKey="emitidas" radius={[6, 6, 0, 0]} maxBarSize={40} animationDuration={900}>
                {hist.map((h) => (
                  <Cell key={h.mes} fill={limite && h.emitidas > limite ? "#ef4444" : "#f97316"} fillOpacity={h.mes === mesActual ? 0.55 : 1} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">El mes actual se ve más claro porque aún no termina.</p>
      </Panel>

      {rec && est && (
        <motion.section
          initial={reduce ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className={`flex flex-col rounded-2xl border p-5 shadow-sm sm:p-6 lg:col-span-2 ${est.caja}`}
          aria-live="polite"
        >
          <span className={`flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-sm ${est.icono}`}><est.I className="h-5 w-5" /></span>
          <h2 className="mt-4 text-base font-semibold">{rec.titulo}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{rec.mensaje}</p>

          <dl className="mt-5 grid grid-cols-2 gap-3 border-t pt-4">
            <div>
              <dd className="text-xl font-bold tabular-nums">{rec.ritmo_mensual ? `~${rec.ritmo_mensual}` : "—"}</dd>
              <dt className="text-[11px] leading-tight text-muted-foreground">Promedio mensual (últimos 3 meses)</dt>
            </div>
            <div>
              <dd className="text-xl font-bold tabular-nums">{rec.proyeccion_periodo ?? "—"}</dd>
              <dt className="text-[11px] leading-tight text-muted-foreground">
                {rec.agota_el ? `Proyección del periodo · se acabarían el ${fechaCorta(rec.agota_el)}` : "Proyección de este periodo"}
              </dt>
            </div>
          </dl>

          {rec.plan_sugerido && onElegirPlan && (
            <button
              type="button"
              onClick={() => onElegirPlan(rec.plan_sugerido!.codigo)}
              className="group mt-5 inline-flex items-center justify-center gap-1.5 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600"
            >
              Ver plan {rec.plan_sugerido.nombre} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          )}
        </motion.section>
      )}
    </div>
  )
}
