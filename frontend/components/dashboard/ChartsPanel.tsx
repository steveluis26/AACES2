"use client"

import { BarChart3, Layers } from "lucide-react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { motion, useReducedMotion } from "motion/react"
import { Panel, Vacio } from "./Panel"

type ConstanciaMes = { mes: string; emitidas: number }
type Categoria = { categoria: string; cantidad: number; porcentaje: number }

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
const MESES_L = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
const nombreMes = (v: string, largo = false) => {
  const [y, m] = String(v).split("-")
  const i = parseInt(m) - 1
  return largo ? `${MESES_L[i] ?? v} ${y}` : MESES[i] ?? v
}

function Globo({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="capitalize text-muted-foreground">{nombreMes(String(label), true)}</p>
      <p className="mt-0.5 text-sm font-semibold">{payload[0].value} {payload[0].value === 1 ? "constancia" : "constancias"}</p>
    </div>
  )
}

export function ConstanciasChart({ data, delay = 0 }: { data: ConstanciaMes[]; delay?: number }) {
  const total = data.reduce((a, d) => a + (d.emitidas || 0), 0)
  return (
    <Panel titulo="Constancias emitidas por mes" icono={BarChart3} href="/cliente/reportes" hrefLabel="Ver reportes" delay={delay}>
      {data.length === 0 ? (
        <Vacio icono={BarChart3} texto="Aún no has emitido constancias. Aquí verás la tendencia mes a mes." />
      ) : (
        <>
          <p className="-mt-2 mb-3 text-sm text-muted-foreground"><span className="font-semibold text-foreground">{total}</span> {data.length === 1 ? "en el último mes" : `en los últimos ${data.length} meses`}</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="mes" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} tickFormatter={(v) => nombreMes(v)} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                <Tooltip content={<Globo />} cursor={{ fill: "rgba(249,115,22,0.08)" }} />
                <Bar dataKey="emitidas" fill="#f97316" radius={[6, 6, 0, 0]} maxBarSize={40} animationDuration={900} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </Panel>
  )
}

export function ModalidadPanel({ data, delay = 0 }: { data: Categoria[]; delay?: number }) {
  const reduce = useReducedMotion()
  const total = data.reduce((a, d) => a + (d.cantidad || 0), 0) || 1
  return (
    <Panel titulo="Cursos por modalidad" icono={Layers} delay={delay}>
      {data.length === 0 ? (
        <Vacio icono={Layers} texto="Sin cursos todavía" />
      ) : (
        <ul className="space-y-4">
          {data.map((d, i) => {
            const pct = Math.round((d.cantidad / total) * 100)
            return (
              <li key={d.categoria}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="capitalize">{d.categoria}</span>
                  <span className="tabular-nums text-muted-foreground"><span className="font-semibold text-foreground">{d.cantidad}</span> · {pct}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className="h-full rounded-full bg-orange-500"
                    style={{ opacity: 1 - i * 0.18 }}
                    initial={reduce ? false : { width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, delay: delay + 0.2 + i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}
