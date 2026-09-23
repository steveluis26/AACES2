"use client"

import * as React from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { CalendarDays, ChevronLeft, ChevronRight, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type EventoCalendario = {
  id: string
  nombre: string
  ciudad?: string | null
  fecha_inicio?: string | null
  fecha_fin?: string | null
  estado?: string | null
  subcursos?: Array<{ nombre: string; ciudad?: string | null; fecha_inicio?: string | null; fecha_fin?: string | null }>
}

type Tramo<T> = { ev: T; inicio: Date; fin: Date }

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]

// Colores por curso (estables por id). El primero es el naranja de marca.
const COLORES = [
  { barra: "bg-orange-500", suave: "bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-200", punto: "bg-orange-500" },
  { barra: "bg-blue-500", suave: "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200", punto: "bg-blue-500" },
  { barra: "bg-emerald-500", suave: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200", punto: "bg-emerald-500" },
  { barra: "bg-purple-500", suave: "bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-200", punto: "bg-purple-500" },
  { barra: "bg-amber-500", suave: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200", punto: "bg-amber-500" },
  { barra: "bg-pink-500", suave: "bg-pink-100 text-pink-800 dark:bg-pink-500/20 dark:text-pink-200", punto: "bg-pink-500" },
]
export const colorCurso = (id: string) => COLORES[id.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % COLORES.length]

const fechaLocal = (s?: string | null): Date | null => {
  const p = String(s || "").slice(0, 10).split("-").map(Number)
  if (p.length !== 3 || !p[0] || !p[1] || !p[2]) return null
  return new Date(p[0], p[1] - 1, p[2])
}
const mismoDia = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
const clave = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

export function CalendarioMensual<T extends EventoCalendario>({
  eventos,
  year,
  month,
  onCambiarMes,
  onHoy,
  onSeleccionar,
}: {
  eventos: T[]
  year: number
  month: number
  onCambiarMes: (delta: -1 | 1) => void
  onHoy: () => void
  onSeleccionar: (ev: T) => void
}) {
  const reduce = useReducedMotion()
  const [direccion, setDireccion] = React.useState<1 | -1>(1)
  const hoy = new Date()

  // Tramos: cada curso (y subcurso) con su rango de fechas
  const tramos = React.useMemo(() => {
    const out: Tramo<T>[] = []
    for (const ev of eventos) {
      const i = fechaLocal(ev.fecha_inicio), f = fechaLocal(ev.fecha_fin ?? ev.fecha_inicio)
      if (i && f) out.push({ ev, inicio: i, fin: f })
      for (const sc of ev.subcursos || []) {
        const si = fechaLocal(sc.fecha_inicio), sf = fechaLocal(sc.fecha_fin ?? sc.fecha_inicio)
        if (si && sf) out.push({ ev: { ...ev, nombre: sc.nombre, ciudad: sc.ciudad, fecha_inicio: sc.fecha_inicio, fecha_fin: sc.fecha_fin }, inicio: si, fin: sf })
      }
    }
    return out.sort((a, b) => a.inicio.getTime() - b.inicio.getTime())
  }, [eventos])

  // Celdas del mes, semana de lunes a domingo
  const celdas = React.useMemo(() => {
    const primero = new Date(year, month, 1)
    const offset = (primero.getDay() + 6) % 7
    const total = Math.ceil((offset + new Date(year, month + 1, 0).getDate()) / 7) * 7
    return Array.from({ length: total }, (_, i) => new Date(year, month, 1 - offset + i))
  }, [year, month])

  const porDia = React.useMemo(() => {
    const m: Record<string, Tramo<T>[]> = {}
    for (const c of celdas) {
      m[clave(c)] = tramos.filter((t) => c >= t.inicio && c <= t.fin)
    }
    return m
  }, [celdas, tramos])

  const delMes = tramos.filter((t) => t.fin >= new Date(year, month, 1) && t.inicio <= new Date(year, month + 1, 0))
  // Color por orden de aparición en el mes: cursos distintos no comparten color hasta agotar la paleta
  const colorDe = React.useMemo(() => {
    const m = new Map<string, (typeof COLORES)[number]>()
    for (const t of tramos) if (!m.has(t.ev.id)) m.set(t.ev.id, COLORES[m.size % COLORES.length])
    return (id: string) => m.get(id) || colorCurso(id)
  }, [tramos])
  const inicioMes = new Date(year, month, 1)
  const agendaMovil = React.useMemo(() => {
    const grupos = new Map<string, { dia: Date; tramos: Tramo<T>[] }>()
    for (const t of delMes) {
      const dia = t.inicio < inicioMes ? inicioMes : t.inicio
      const k = clave(dia)
      if (!grupos.has(k)) grupos.set(k, { dia, tramos: [] })
      grupos.get(k)!.tramos.push(t)
    }
    return Array.from(grupos.values()).sort((a, b) => a.dia.getTime() - b.dia.getTime())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tramos, year, month])
  const titulo = new Date(year, month, 1).toLocaleDateString("es-MX", { month: "long", year: "numeric" })
  const cambiar = (d: -1 | 1) => { setDireccion(d); onCambiarMes(d) }
  const irADia = (c: Date) => document.getElementById(`dia-${clave(c)}`)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" })

  const variantes = {
    entra: (d: number) => (reduce ? { opacity: 1 } : { opacity: 0, x: d * 40 }),
    centro: { opacity: 1, x: 0 },
    sale: (d: number) => (reduce ? { opacity: 1 } : { opacity: 0, x: d * -40 }),
  }

  return (
    <div className="space-y-4">
      {/* Encabezado del mes */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold first-letter:uppercase">{titulo}</h3>
          <p className="text-sm text-muted-foreground">
            {delMes.length === 0 ? "Sin cursos este mes" : `${delMes.length} ${delMes.length === 1 ? "curso" : "cursos"} este mes`}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={() => { setDireccion(year * 12 + month > hoy.getFullYear() * 12 + hoy.getMonth() ? -1 : 1); onHoy() }}>Hoy</Button>
          <Button variant="outline" size="icon" className="h-9 w-9" aria-label="Mes anterior" onClick={() => cambiar(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" className="h-9 w-9" aria-label="Mes siguiente" onClick={() => cambiar(1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <AnimatePresence mode="wait" custom={direccion} initial={false}>
        <motion.div
          key={`${year}-${month}`}
          custom={direccion}
          variants={variantes}
          initial="entra"
          animate="centro"
          exit="sale"
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* ---------- Escritorio: cuadrícula ---------- */}
          <div className="hidden overflow-hidden rounded-xl border md:block">
            <div className="grid grid-cols-7 border-b bg-muted/40">
              {DIAS.map((d, i) => (
                <div key={d} className={cn("px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground", i >= 5 && "text-muted-foreground/70")}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {celdas.map((c, idx) => {
                const enMes = c.getMonth() === month
                const esHoy = mismoDia(c, hoy)
                const lunes = idx % 7 === 0
                const items = porDia[clave(c)]
                return (
                  <div
                    key={clave(c)}
                    className={cn(
                      "min-h-[118px] border-b border-r py-1.5 [&:nth-child(7n)]:border-r-0",
                      !enMes && "bg-muted/30",
                      enMes && idx % 7 >= 5 && "bg-muted/15",
                    )}
                  >
                    <div className="mb-1 px-2">
                      <span className={cn(
                        "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-medium",
                        esHoy ? "bg-orange-500 font-semibold text-white" : enMes ? "text-foreground" : "text-muted-foreground/50",
                      )}>
                        {c.getDate()}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {items.slice(0, 3).map((t, i) => {
                        const col = colorDe(t.ev.id)
                        const empieza = mismoDia(t.inicio, c)
                        const termina = mismoDia(t.fin, c)
                        const mostrarNombre = empieza || lunes
                        return (
                          <button
                            key={`${t.ev.id}-${t.ev.nombre}-${i}`}
                            type="button"
                            title={`${t.ev.nombre}${t.ev.ciudad ? ` · ${t.ev.ciudad}` : ""}`}
                            onClick={() => onSeleccionar(t.ev)}
                            className={cn(
                              "flex h-6 w-full items-center gap-1.5 truncate text-left text-xs font-medium transition-[filter,transform] duration-150 hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 active:scale-[0.98]",
                              col.suave,
                              empieza ? "ml-1.5 rounded-l-md pl-1.5" : "pl-2",
                              termina ? "mr-1.5 w-[calc(100%-0.375rem)] rounded-r-md" : "",
                              empieza && termina && "w-[calc(100%-0.75rem)]",
                            )}
                          >
                            {empieza && <span className={cn("h-3.5 w-1 shrink-0 rounded-full", col.barra)} />}
                            <span className={cn("truncate", !mostrarNombre && "invisible")}>{t.ev.nombre}</span>
                          </button>
                        )
                      })}
                      {items.length > 3 && (
                        <p className="px-2 text-[11px] font-medium text-muted-foreground">+{items.length - 3} más</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ---------- Móvil: mini calendario + agenda ---------- */}
          <div className="space-y-4 md:hidden">
            <div className="rounded-xl border p-3">
              <div className="grid grid-cols-7 text-center text-[11px] font-semibold uppercase text-muted-foreground">
                {DIAS.map((d) => <div key={d} className="py-1">{d.slice(0, 1)}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-y-1 text-center">
                {celdas.map((c) => {
                  const enMes = c.getMonth() === month
                  const items = porDia[clave(c)]
                  const esHoy = mismoDia(c, hoy)
                  return (
                    <button
                      key={clave(c)}
                      type="button"
                      disabled={!enMes || items.length === 0}
                      onClick={() => {
                        const g = agendaMovil.find((x) => items.some((t) => (t.inicio < inicioMes ? inicioMes : t.inicio).getTime() === x.dia.getTime()))
                        if (g) irADia(g.dia)
                      }}
                      aria-label={`${c.getDate()}${items.length ? `, ${items.length} cursos` : ""}`}
                      className={cn(
                        "mx-auto flex h-10 w-10 flex-col items-center justify-center rounded-full text-sm transition-colors",
                        !enMes && "text-muted-foreground/40",
                        enMes && items.length > 0 && "font-semibold hover:bg-muted",
                        esHoy && "bg-orange-500 text-white hover:bg-orange-500",
                      )}
                    >
                      {c.getDate()}
                      <span className="mt-0.5 flex h-1 gap-0.5">
                        {enMes && items.slice(0, 3).map((t, i) => (
                          <span key={i} className={cn("h-1 w-1 rounded-full", esHoy ? "bg-white" : colorDe(t.ev.id).punto)} />
                        ))}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {agendaMovil.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-10 text-center">
                <CalendarDays className="h-6 w-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No hay cursos programados este mes.</p>
              </div>
            ) : (
              <ol className="space-y-3">
                {agendaMovil.map(({ dia, tramos: ts }) => (
                  <li key={clave(dia)} id={`dia-${clave(dia)}`} className="flex scroll-mt-20 gap-3">
                    <div className={cn("flex w-12 shrink-0 flex-col items-center self-start rounded-xl border py-1.5", mismoDia(dia, hoy) && "border-orange-500 bg-orange-500 text-white")}>
                      <span className="text-[10px] font-semibold uppercase">{dia.toLocaleDateString("es-MX", { weekday: "short" }).replace(".", "")}</span>
                      <span className="text-lg font-bold leading-none">{dia.getDate()}</span>
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      {ts.map((t, i) => {
                        const col = colorDe(t.ev.id)
                        const dias = Math.round((t.fin.getTime() - t.inicio.getTime()) / 86400000) + 1
                        const corta = (d: Date) => d.toLocaleDateString("es-MX", { day: "numeric", month: "short" }).replace(".", "")
                        return (
                          <button
                            key={`${t.ev.id}-${i}`}
                            type="button"
                            onClick={() => onSeleccionar(t.ev)}
                            className="flex w-full items-stretch gap-3 overflow-hidden rounded-xl border bg-card text-left transition-colors active:bg-muted"
                          >
                            <span className={cn("w-1.5 shrink-0", col.barra)} />
                            <span className="min-w-0 flex-1 py-2.5 pr-3">
                              <span className="block text-sm font-medium leading-snug">{t.ev.nombre}</span>
                              <span className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                                {dias > 1 && <span>{corta(t.inicio)} – {corta(t.fin)} · {dias} días</span>}
                                {t.ev.ciudad && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{t.ev.ciudad}</span>}
                              </span>
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
