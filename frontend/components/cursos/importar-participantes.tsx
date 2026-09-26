"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, FileUp, Loader2, RefreshCw, UserCheck, UserPlus, Users, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { descargarBlob } from "@/lib/plantillas"

type Fila = {
  fila: number
  estado: "nuevo" | "existente" | "inscrito" | "error"
  errores: string[]
  avisos: string[]
  datos: { nombres: string; apellido_paterno: string; apellido_materno: string; curp: string; correo: string; puesto: string }
}
type Analisis = {
  columnas: { encabezado: string; campo: string; etiqueta: string }[]
  ignoradas: string[]
  filas: Fila[]
  resumen: { nuevo: number; existente: number; inscrito: number; error: number; total: number; a_importar: number }
}

const ESTADO: Record<Fila["estado"], { t: string; c: string }> = {
  nuevo: { t: "Nuevo", c: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400" },
  existente: { t: "Ya registrado", c: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400" },
  inscrito: { t: "Ya inscrito", c: "bg-muted text-muted-foreground" },
  error: { t: "Con error", c: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400" },
}

// apiRequest siempre manda JSON; aquí hay que subir el archivo como multipart
async function subir(cursoId: string, archivo: File, confirmar: boolean) {
  const fd = new FormData()
  fd.append("archivo", archivo)
  fd.append("confirmar", String(confirmar))
  const token = localStorage.getItem("aaces_token") || ""
  const r = await fetch(`/api/v1/clientes/cursos/${cursoId}/importar`, { method: "POST", body: fd, headers: { Authorization: `Bearer ${token}` } })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(typeof data.detail === "string" ? data.detail : `Error ${r.status}`)
  return data
}

/** Importar la lista de un grupo desde Excel o CSV: subir, revisar fila por fila y confirmar. */
export function ImportarParticipantes({ abierto, onCerrar, cursoId, cursoNombre, onListo }: {
  abierto: boolean
  onCerrar: () => void
  cursoId: string
  cursoNombre: string
  onListo: () => void
}) {
  const reduce = useReducedMotion()
  const input = useRef<HTMLInputElement>(null)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [analisis, setAnalisis] = useState<Analisis | null>(null)
  const [cargando, setCargando] = useState(false)
  const [arrastrando, setArrastrando] = useState(false)
  const [soloProblemas, setSoloProblemas] = useState(false)
  const [listo, setListo] = useState<{ inscritos: number; creados: number; reutilizados: number } | null>(null)

  const reiniciar = () => { setArchivo(null); setAnalisis(null); setListo(null); setSoloProblemas(false) }
  const cerrar = () => { reiniciar(); onCerrar() }

  const revisar = async (f?: File | null) => {
    if (!f) return
    setArchivo(f)
    setCargando(true)
    try {
      const a: Analisis = await subir(cursoId, f, false)
      setAnalisis(a)
      setSoloProblemas(a.resumen.error > 0)
    } catch (e) {
      toast.error((e as Error).message)
      setArchivo(null)
    } finally {
      setCargando(false)
    }
  }

  const confirmar = async () => {
    if (!archivo) return
    setCargando(true)
    try {
      const r = await subir(cursoId, archivo, true)
      setListo(r)
      toast.success(`${r.inscritos} ${r.inscritos === 1 ? "participante inscrito" : "participantes inscritos"}`)
      onListo()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setCargando(false)
    }
  }

  const plantilla = async () => {
    try {
      const token = localStorage.getItem("aaces_token") || ""
      const r = await fetch("/api/v1/clientes/importar/plantilla", { headers: { Authorization: `Bearer ${token}` } })
      if (!r.ok) throw new Error("No se pudo descargar la plantilla")
      descargarBlob(await r.blob(), "plantilla_participantes_AACES.xlsx")
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const filas = analisis ? analisis.filas.filter((f) => !soloProblemas || f.estado === "error" || f.avisos.some((a) => a.startsWith("Sin CURP"))) : []
  const r = analisis?.resumen

  return (
    <Sheet open={abierto} onOpenChange={(o) => { if (!o) cerrar() }}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl">
        <SheetHeader className="border-b px-6 py-5 text-left">
          <SheetTitle>Importar participantes</SheetTitle>
          <SheetDescription>{cursoNombre}. Sube la lista en Excel o CSV; revisas cada fila antes de guardar.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <AnimatePresence mode="wait">
            {listo ? (
              <motion.div key="ok" initial={reduce ? false : { opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center py-10 text-center">
                <motion.span initial={reduce ? false : { scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 15 }} className="flex h-16 w-16 items-center justify-center rounded-full bg-green-600 text-white shadow-lg shadow-green-600/30">
                  <CheckCircle2 className="h-8 w-8" />
                </motion.span>
                <h3 className="mt-5 text-lg font-semibold">¡Listo! {listo.inscritos} {listo.inscritos === 1 ? "inscrito" : "inscritos"}</h3>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  {listo.creados} {listo.creados === 1 ? "nuevo" : "nuevos"} y {listo.reutilizados} que ya tenías registrados. Inscribir no gasta constancias: los folios se generan al acreditar.
                </p>
                <div className="mt-6 flex gap-2">
                  <Button variant="outline" onClick={reiniciar}>Importar otro archivo</Button>
                  <Button onClick={cerrar}>Cerrar</Button>
                </div>
              </motion.div>
            ) : !analisis ? (
              <motion.div key="subir" initial={false} className="space-y-5">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => !cargando && input.current?.click()}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") input.current?.click() }}
                  onDragOver={(e) => { e.preventDefault(); setArrastrando(true) }}
                  onDragLeave={() => setArrastrando(false)}
                  onDrop={(e) => { e.preventDefault(); setArrastrando(false); revisar(e.dataTransfer.files?.[0]) }}
                  className={`flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-all ${arrastrando ? "scale-[1.01] border-orange-500 bg-orange-50 dark:bg-orange-500/10" : "hover:border-orange-500/50 hover:bg-muted/50"}`}
                >
                  <input ref={input} type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" className="hidden" onChange={(e) => { revisar(e.target.files?.[0]); e.target.value = "" }} />
                  {cargando ? (
                    <><Loader2 className="h-8 w-8 animate-spin text-orange-500" /><p className="font-medium">Revisando {archivo?.name}…</p></>
                  ) : (
                    <>
                      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500"><FileUp className="h-6 w-6" /></span>
                      <div>
                        <p className="font-medium">Arrastra tu lista aquí</p>
                        <p className="text-sm text-muted-foreground">o toca para elegirla · Excel (.xlsx) o CSV · hasta 1,000 participantes</p>
                      </div>
                    </>
                  )}
                </div>
                <div className="flex flex-col gap-3 rounded-xl bg-muted/50 p-4 text-sm sm:flex-row sm:items-center">
                  <FileSpreadsheet className="h-5 w-5 shrink-0 text-green-600" />
                  <p className="flex-1 text-muted-foreground">
                    ¿Tu lista tiene otras columnas? Reconocemos nombres como “Correo electrónico”, “Celular” o “Puesto”. Si prefieres, usa nuestra plantilla.
                  </p>
                  <Button type="button" variant="outline" size="sm" onClick={plantilla} className="shrink-0"><Download className="h-4 w-4" /> Plantilla</Button>
                </div>
              </motion.div>
            ) : (
              <motion.div key="revisar" initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                <div className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2"><FileSpreadsheet className="h-4 w-4 shrink-0 text-green-600" /><span className="truncate font-medium">{archivo?.name}</span></span>
                  <button type="button" onClick={reiniciar} className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-orange-500 hover:underline"><RefreshCw className="h-3.5 w-3.5" /> Cambiar archivo</button>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    { n: r!.nuevo, t: "Nuevos", i: UserPlus, c: "text-green-600" },
                    { n: r!.existente, t: "Ya registrados", i: UserCheck, c: "text-blue-600" },
                    { n: r!.inscrito, t: "Ya inscritos", i: Users, c: "text-muted-foreground" },
                    { n: r!.error, t: "Con error", i: AlertCircle, c: "text-red-600" },
                  ].map((k) => (
                    <div key={k.t} className="rounded-xl border bg-card p-3">
                      <k.i className={`h-4 w-4 ${k.c}`} />
                      <p className="mt-1 text-xl font-bold tabular-nums">{k.n}</p>
                      <p className="text-xs text-muted-foreground">{k.t}</p>
                    </div>
                  ))}
                </div>

                <div className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Columnas reconocidas:</span> {analisis.columnas.map((c) => `${c.encabezado} → ${c.etiqueta}`).join(" · ")}
                  {analisis.ignoradas.length > 0 && <> · <span className="font-medium text-foreground">No se usan:</span> {analisis.ignoradas.join(", ")}</>}
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{filas.length} {soloProblemas ? "por revisar" : "filas"}</p>
                  <label className="flex cursor-pointer items-center gap-2 text-xs">
                    <input type="checkbox" className="h-4 w-4 accent-orange-500" checked={soloProblemas} onChange={(e) => setSoloProblemas(e.target.checked)} />
                    Solo errores y faltantes
                  </label>
                </div>

                <ul className="space-y-1.5">
                  {filas.map((f) => {
                    const e = ESTADO[f.estado]
                    const nombre = [f.datos.nombres, f.datos.apellido_paterno, f.datos.apellido_materno].filter(Boolean).join(" ") || "(sin nombre)"
                    return (
                      <li key={f.fila} className={`rounded-xl border p-3 ${f.estado === "error" ? "border-red-500/30 bg-red-50/50 dark:bg-red-500/5" : ""}`}>
                        <div className="flex items-center gap-3">
                          <span className="w-10 shrink-0 text-xs tabular-nums text-muted-foreground">Fila {f.fila}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{nombre}</span>
                            <span className="block truncate font-mono text-[11px] text-muted-foreground">{[f.datos.curp, f.datos.correo, f.datos.puesto].filter(Boolean).join(" · ") || "—"}</span>
                          </span>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${e.c}`}>{e.t}</span>
                        </div>
                        {(f.errores.length > 0 || f.avisos.length > 0) && (
                          <p className={`mt-1.5 pl-[3.25rem] text-xs ${f.errores.length ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400"}`}>
                            {[...f.errores, ...f.avisos].join(" · ")}
                          </p>
                        )}
                      </li>
                    )
                  })}
                  {filas.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">Todo en orden.</li>}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {analisis && !listo && (
          <SheetFooter className="flex-row items-center gap-2 border-t bg-background px-6 py-4 sm:justify-between">
            <span className="hidden text-sm text-muted-foreground sm:block">
              {r!.error > 0 ? `${r!.error} con error no se importan` : "Sin errores"}
            </span>
            <div className="flex flex-1 gap-2 sm:flex-none">
              <Button variant="outline" onClick={cerrar} className="flex-1 sm:flex-none"><X className="h-4 w-4" /> Cancelar</Button>
              <Button onClick={confirmar} disabled={cargando || r!.a_importar === 0} className="flex-1 sm:flex-none">
                {cargando ? <><Loader2 className="h-4 w-4 animate-spin" /> Inscribiendo…</> : <><UserPlus className="h-4 w-4" /> Inscribir {r!.a_importar}</>}
              </Button>
            </div>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  )
}
