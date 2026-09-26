"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { AlertCircle, CalendarDays, Check, CheckCircle2, FileDown, Loader2, Search, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { apiRequest } from "@/app/services/api"
import { descargarBlob, plantillasApi } from "@/lib/plantillas"
import type { Cupo } from "@/lib/cupo"
import { avisosDeError, type Aviso } from "@/lib/congruencia"
import { AvisosCongruencia } from "@/components/congruencia/avisos-congruencia"
import { parseFecha } from "@/lib/utils"

type Curso = { id: string; nombre: string; fecha_inicio: string | null; fecha_fin: string | null; ciudad?: string | null }
type Inscrito = { id: string; nombre: string; apellido?: string | null; apellido_paterno?: string | null; apellido_materno?: string | null; estado_acreditacion?: boolean; codigo_validacion?: string | null }

// Igual que en el PDF: nombre + apellidos (paterno/materno o el campo apellido)
const nombreDe = (p: Inscrito) =>
  [p.nombre, [p.apellido_paterno, p.apellido_materno].filter(Boolean).join(" ") || p.apellido].filter(Boolean).join(" ")

export function GenerarDc3({ abierto, onCerrar, plantillaId, plantillaNombre, cursoInicial }: {
  abierto: boolean
  onCerrar: () => void
  plantillaId: string
  plantillaNombre: string
  cursoInicial?: string
}) {
  const reduce = useReducedMotion()
  const [cursos, setCursos] = useState<Curso[]>([])
  const [q, setQ] = useState("")
  const [curso, setCurso] = useState<string>(cursoInicial || "")
  const [inscritos, setInscritos] = useState<Inscrito[] | null>(null)
  const [marcados, setMarcados] = useState<Set<string>>(new Set())
  const [generando, setGenerando] = useState(false)
  const [listo, setListo] = useState<number | null>(null)
  const [cupo, setCupo] = useState<Cupo | null>(null)
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const [confirmado, setConfirmado] = useState(false)

  useEffect(() => {
    if (!abierto) return
    setListo(null)
    apiRequest<Cupo>("/cupo").then(setCupo).catch(() => setCupo(null))
    apiRequest<{ items: Curso[] }>("/clientes/cursos?limit=100")
      .then((r) => setCursos((r.items || []).sort((a, b) => String(b.fecha_inicio || "").localeCompare(String(a.fecha_inicio || "")))))
      .catch(() => setCursos([]))
  }, [abierto])

  useEffect(() => {
    setAvisos([]); setConfirmado(false)
    if (!curso) { setInscritos(null); return }
    setInscritos(null)
    apiRequest<Inscrito[]>(`/clientes/cursos/${curso}/participantes`)
      .then((r) => {
        const lista = Array.isArray(r) ? r : []
        setInscritos(lista)
        setMarcados(new Set(lista.filter((p) => p.estado_acreditacion).map((p) => p.id)))
      })
      .catch(() => setInscritos([]))
  }, [curso])

  const visibles = useMemo(() => cursos.filter((c) => !q || c.nombre.toLowerCase().includes(q.toLowerCase())), [cursos, q])
  const acreditados = (inscritos || []).filter((p) => p.estado_acreditacion)
  const cursoSel = cursos.find((c) => c.id === curso)
  const fechaCorta = (v?: string | null) => parseFecha(v?.slice(0, 10) ?? null)?.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }) ?? ""

  const toggle = (id: string) => setMarcados((s) => {
    const n = new Set(s)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    return n
  })
  const todos = marcados.size === acreditados.length && acreditados.length > 0
  // Solo gastan constancia quienes aún no tienen folio; volver a generar las demás es gratis
  const nuevos = (inscritos || []).filter((p) => marcados.has(p.id) && !p.codigo_validacion).length
  const disponibles = cupo ? cupo.disponibles : null
  const sinCupo = !!cupo && (!cupo.activa || (disponibles !== null && nuevos > disponibles))

  const generar = async () => {
    setGenerando(true)
    try {
      const r = await plantillasApi.generar(plantillaId, curso, Array.from(marcados), confirmado)
      descargarBlob(r.blob, r.nombre)
      setListo(r.generados)
      apiRequest<Cupo>("/cupo").then(setCupo).catch(() => {})
      toast.success(`${r.generados} ${r.generados === 1 ? "DC-3 generado" : "DC-3 generados"}`, { description: "Se descargó un PDF listo para imprimir." })
    } catch (e) {
      const av = avisosDeError(e)
      if (av) { setAvisos(av); setConfirmado(false) }
      else toast.error((e as Error).message)
    } finally {
      setGenerando(false)
    }
  }

  return (
    <Sheet open={abierto} onOpenChange={(o) => { if (!o) onCerrar() }}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b px-6 py-5 text-left">
          <SheetTitle>Generar DC-3</SheetTitle>
          <SheetDescription>Con la plantilla “{plantillaNombre}”. Cada participante sale en su propia hoja, con su QR de verificación.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          <AnimatePresence mode="wait">
            {listo !== null ? (
              <motion.div key="ok" initial={reduce ? false : { opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center py-10 text-center">
                <motion.span initial={reduce ? false : { scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 15 }} className="flex h-16 w-16 items-center justify-center rounded-full bg-green-600 text-white shadow-lg shadow-green-600/30">
                  <CheckCircle2 className="h-8 w-8" />
                </motion.span>
                <h3 className="mt-5 text-lg font-semibold">¡Listo! {listo} {listo === 1 ? "DC-3" : "DC-3"} en un PDF</h3>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">Revisa tu carpeta de descargas. Cada constancia ya es verificable con su QR y aparece en tu Centro de Constancias.</p>
                <div className="mt-6 flex gap-2">
                  <Button variant="outline" onClick={() => setListo(null)}>Generar otro grupo</Button>
                  <Button asChild><Link href="/cliente/constancias">Ver constancias</Link></Button>
                </div>
              </motion.div>
            ) : (
              <motion.div key="form" initial={false} className="space-y-6">
                <section className="space-y-3">
                  <p className="flex items-center gap-2 text-sm font-semibold"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-xs font-bold text-white">1</span>Elige el curso</p>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar curso…" className="pl-9" aria-label="Buscar curso" />
                  </div>
                  <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
                    {visibles.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No hay cursos.</p>}
                    {visibles.map((c) => (
                      <button key={c.id} type="button" onClick={() => setCurso(c.id)}
                        className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all ${curso === c.id ? "border-orange-500/60 bg-orange-50/70 shadow-sm dark:bg-orange-500/5" : "hover:bg-muted/50"}`}>
                        <CalendarDays className={`h-4 w-4 shrink-0 ${curso === c.id ? "text-orange-500" : "text-muted-foreground"}`} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{c.nombre}</span>
                          <span className="block text-xs text-muted-foreground">{fechaCorta(c.fecha_inicio)}{c.ciudad ? ` · ${c.ciudad}` : ""}</span>
                        </span>
                        {curso === c.id && <Check className="h-4 w-4 text-orange-500" />}
                      </button>
                    ))}
                  </div>
                </section>

                {curso && (
                  <section className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex items-center gap-2 text-sm font-semibold"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-xs font-bold text-white">2</span>Participantes</p>
                      {acreditados.length > 0 && (
                        <button type="button" onClick={() => setMarcados(todos ? new Set() : new Set(acreditados.map((p) => p.id)))} className="text-xs font-medium text-orange-500 hover:underline">
                          {todos ? "Quitar todos" : "Seleccionar todos"}
                        </button>
                      )}
                    </div>
                    {inscritos === null ? (
                      <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-orange-500" /></div>
                    ) : inscritos.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-8 text-center">
                        <Users className="h-5 w-5 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Este curso no tiene participantes.</p>
                      </div>
                    ) : (
                      <>
                        {acreditados.length < inscritos.length && (
                          <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                            {inscritos.length - acreditados.length} {inscritos.length - acreditados.length === 1 ? "participante no está acreditado" : "participantes no están acreditados"}. Solo se generan DC-3 de acreditados; acredítalos en la <Link href={`/cliente/cursos?curso=${curso}`} className="font-semibold underline">agenda del curso</Link>.
                          </p>
                        )}
                        <AvisosCongruencia avisos={avisos} confirmado={confirmado} onConfirmar={setConfirmado} />
                        {sinCupo && (
                          <div role="alert" className="rounded-xl border border-red-500/30 bg-red-50 p-3 text-sm text-red-800 dark:bg-red-500/10 dark:text-red-300">
                            <p className="flex items-start gap-2 font-medium">
                              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                              {!cupo?.activa
                                ? "Tu suscripción no está activa, no puedes emitir constancias nuevas."
                                : `Este grupo usa ${nuevos} ${nuevos === 1 ? "constancia nueva" : "constancias nuevas"} y ${!disponibles ? "ya no te quedan disponibles" : `te ${disponibles === 1 ? "queda" : "quedan"} ${disponibles}`}.`}
                            </p>
                            <p className="mt-1 pl-6 text-xs">
                              {cupo?.activa && "Quita participantes, "}compra un paquete extra o <Link href="/cliente/pagos" className="font-semibold underline">mejora tu plan</Link>.
                            </p>
                          </div>
                        )}
                        <ul className="space-y-1.5">
                          {inscritos.map((p) => {
                            const ok = !!p.estado_acreditacion
                            const on = marcados.has(p.id)
                            return (
                              <li key={p.id}>
                                <button type="button" disabled={!ok} role="checkbox" aria-checked={on} onClick={() => toggle(p.id)}
                                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50 ${on ? "border-orange-500/50 bg-orange-50/70 dark:bg-orange-500/5" : "hover:bg-muted/50"}`}>
                                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${on ? "border-orange-500 bg-orange-500 text-white" : "border-input"}`}>{on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}</span>
                                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{nombreDe(p)}</span>
                                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${ok ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
                                    {ok ? (p.codigo_validacion ? "Acreditado · con folio" : "Acreditado") : "Sin acreditar"}
                                  </span>
                                </button>
                              </li>
                            )
                          })}
                        </ul>
                      </>
                    )}
                  </section>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {listo === null && (
          <SheetFooter className="flex-row items-center gap-2 border-t bg-background px-6 py-4 sm:justify-between">
            <span className="hidden text-sm text-muted-foreground sm:block">
              {curso ? `${marcados.size} seleccionados${cursoSel ? ` · ${cursoSel.nombre}` : ""}` : "Elige un curso"}
              {cupo && disponibles !== null && cupo.activa && <span className="block text-xs">{nuevos} {nuevos === 1 ? "nueva usa" : "nuevas usan"} tu plan · te {disponibles === 1 ? "queda" : "quedan"} {disponibles}</span>}
            </span>
            <Button onClick={generar} disabled={!curso || marcados.size === 0 || generando || sinCupo || (avisos.length > 0 && !confirmado)} className="flex-1 sm:flex-none">
              {generando ? <><Loader2 className="h-4 w-4 animate-spin" /> Generando…</> : <><FileDown className="h-4 w-4" /> Generar {marcados.size || ""} DC-3</>}
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  )
}
