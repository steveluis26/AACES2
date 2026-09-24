"use client"

import Link from "next/link"
import { Building2, CalendarDays, MapPin, Users } from "lucide-react"
import { parseFecha } from "@/lib/utils"
import { Panel, Vacio } from "./Panel"

type Curso = {
  curso_id: string
  nombre: string
  fecha_inicio: string | null
  fecha_fin: string | null
  empresa: string
  ciudad: string
  modalidad: string
  participantes: number
}

const MODALIDAD: Record<string, string> = {
  presencial: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  virtual: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  mixta: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
}

function cuando(ini: Date | null, fin: Date | null) {
  if (!ini) return null
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const dias = Math.round((ini.getTime() - hoy.getTime()) / 86400000)
  if (fin && ini <= hoy && fin >= hoy) return { t: "En curso", cls: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400" }
  if (dias === 0) return { t: "Hoy", cls: "bg-orange-500 text-white" }
  if (dias === 1) return { t: "Mañana", cls: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400" }
  if (dias > 1 && dias <= 7) return { t: `En ${dias} días`, cls: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400" }
  if (dias > 7) return { t: `En ${dias} días`, cls: "bg-muted text-muted-foreground" }
  return null
}

export function AgendaPanel({ agenda, delay = 0 }: { agenda: Curso[]; delay?: number }) {
  return (
    <Panel titulo="Próximos cursos" icono={CalendarDays} href="/cliente/cursos" hrefLabel="Ver agenda" delay={delay}>
      {!agenda || agenda.length === 0 ? (
        <Vacio icono={CalendarDays} texto="No hay cursos programados" accion={<Link href="/cliente/gestion" className="text-sm font-medium text-orange-500 hover:underline">Registrar un curso</Link>} />
      ) : (
        <ul className="-mx-2 space-y-1">
          {agenda.slice(0, 5).map((c) => {
            const ini = parseFecha(c.fecha_inicio?.slice(0, 10) ?? null)
            const fin = parseFecha(c.fecha_fin?.slice(0, 10) ?? null)
            const chip = cuando(ini, fin)
            return (
              <li key={c.curso_id}>
                <Link href={`/cliente/cursos?curso=${c.curso_id}`} className="group flex items-center gap-4 rounded-xl p-2 transition-colors hover:bg-muted/60">
                  <div className="flex w-14 shrink-0 flex-col items-center rounded-xl border bg-background py-1.5 shadow-sm transition-colors group-hover:border-orange-500/40">
                    <span className="text-[10px] font-semibold uppercase text-orange-500">{ini ? ini.toLocaleDateString("es-MX", { month: "short" }).replace(".", "") : "—"}</span>
                    <span className="text-xl font-bold leading-none">{ini ? ini.getDate() : ""}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold">{c.nombre}</p>
                      {chip && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${chip.cls}`}>{chip.t}</span>}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      {c.ciudad && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{c.ciudad}</span>}
                      {c.empresa && <span className="inline-flex min-w-0 items-center gap-1"><Building2 className="h-3 w-3" /><span className="truncate">{c.empresa}</span></span>}
                      <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{c.participantes} {c.participantes === 1 ? "inscrito" : "inscritos"}</span>
                    </div>
                  </div>
                  <span className={`hidden shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize sm:inline ${MODALIDAD[c.modalidad] || "bg-muted text-muted-foreground"}`}>
                    {c.modalidad || "general"}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}
