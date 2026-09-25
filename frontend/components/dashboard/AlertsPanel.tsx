"use client"

import Link from "next/link"
import { AlertTriangle, CalendarClock, CheckCircle2, ChevronRight, FileCheck2, ListChecks, UserCheck, Building2 } from "lucide-react"
import { Panel } from "./Panel"

type Alerta = { tipo: string; cantidad: number; prioridad: string }
type Pendientes = { acreditar: number; emitir: number; vencer: number }
type Vencimiento = { empresa: string; por_vencer: number; vencidos: number }

const ALERTAS: Record<string, { t: string; href: string; icono: React.ComponentType<{ className?: string }> }> = {
  cursos_sin_instructor: { t: "Cursos sin instructor asignado", href: "/cliente/cursos", icono: UserCheck },
  cursos_sin_empresa: { t: "Cursos sin empresa contratante", href: "/cliente/cursos", icono: Building2 },
  participantes_sin_constancia: { t: "Participantes sin constancia", href: "/cliente/participantes", icono: FileCheck2 },
}

/** Lo que el cliente tiene que atender: pendientes, alertas y vencimientos por empresa. */
export function AlertsPanel({ alertas, pendientes, vencimientos, delay = 0 }: {
  alertas: Alerta[]
  pendientes?: Pendientes
  vencimientos?: Vencimiento[]
  delay?: number
}) {
  const items: { t: string; n: number; href: string; icono: React.ComponentType<{ className?: string }>; tono: "rojo" | "ambar" | "naranja" }[] = []
  if (pendientes?.vencer) items.push({ t: "Constancias por vencer (30 días)", n: pendientes.vencer, href: "/cliente/renovaciones", icono: CalendarClock, tono: "ambar" })
  if (pendientes?.acreditar) items.push({ t: "Participantes por acreditar", n: pendientes.acreditar, href: "/cliente/cursos", icono: UserCheck, tono: "naranja" })
  if (pendientes?.emitir) items.push({ t: "Constancias por emitir", n: pendientes.emitir, href: "/cliente/constancias", icono: FileCheck2, tono: "naranja" })
  for (const a of alertas || []) {
    if (a.tipo === "constancias_por_vencer") continue
    const m = ALERTAS[a.tipo]
    if (m && a.cantidad > 0) items.push({ t: m.t, n: a.cantidad, href: m.href, icono: m.icono, tono: a.prioridad === "alta" ? "rojo" : "ambar" })
  }
  const tonos = {
    rojo: "bg-red-100 text-red-600 dark:bg-red-500/15",
    ambar: "bg-amber-100 text-amber-600 dark:bg-amber-500/15",
    naranja: "bg-orange-500/10 text-orange-500",
  }
  const vencidas = (vencimientos || []).filter((v) => v.por_vencer > 0 || v.vencidos > 0).slice(0, 4)

  return (
    <Panel titulo="Pendientes" icono={ListChecks} delay={delay}>
      {items.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl bg-green-50 p-4 text-sm text-green-700 dark:bg-green-500/10 dark:text-green-400">
          <CheckCircle2 className="h-5 w-5 shrink-0" /> Todo al día. No tienes pendientes.
        </div>
      ) : (
        <ul className="-mx-2 space-y-0.5">
          {items.map((it) => (
            <li key={it.t}>
              <Link href={it.href} className="group flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-muted/60">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tonos[it.tono]}`}><it.icono className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1 text-sm">{it.t}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums">{it.n}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {vencidas.length > 0 && (
        <div className="mt-4 border-t pt-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><AlertTriangle className="h-3.5 w-3.5 text-amber-500" />Vencimientos por empresa</p>
          <ul className="space-y-1.5">
            {vencidas.map((v) => (
              <li key={v.empresa} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{v.empresa}</span>
                <span className="flex shrink-0 gap-1.5 text-xs">
                  {v.por_vencer > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">{v.por_vencer} por vencer</span>}
                  {v.vencidos > 0 && <span className="rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-700 dark:bg-red-500/15 dark:text-red-400">{v.vencidos} {v.vencidos === 1 ? "vencida" : "vencidas"}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  )
}
