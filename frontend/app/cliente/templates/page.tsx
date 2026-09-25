"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import {
  ArrowRight, Code2, FileDown, FileText, FileUp, Loader2, MousePointerClick, Pencil, Plus, Trash2, UploadCloud, X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { PaginaPdf, abrirPdf } from "@/components/plantillas/pagina-pdf"
import { GenerarDc3 } from "@/components/plantillas/generar-dc3"
import { plantillasApi, type Plantilla } from "@/lib/plantillas"

const EASE = [0.22, 1, 0.36, 1] as const

function Miniatura({ id }: { id: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [doc, setDoc] = useState<any>(null)
  const [ancho, setAncho] = useState(0)
  useEffect(() => {
    let vivo = true
    plantillasApi.archivo(id).then(abrirPdf).then((d) => { if (vivo) setDoc(d) }).catch(() => {})
    return () => { vivo = false }
  }, [id])
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setAncho(Math.floor(e.contentRect.width)))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={ref} className="h-full w-full overflow-hidden">
      {ancho > 0 && <PaginaPdf doc={doc} pagina={0} ancho={ancho} />}
    </div>
  )
}

export default function PlantillasPage() {
  const router = useRouter()
  const reduce = useReducedMotion()
  const [plantillas, setPlantillas] = useState<Plantilla[] | null>(null)
  const [subirAbierto, setSubirAbierto] = useState(false)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [nombre, setNombre] = useState("")
  const [subiendo, setSubiendo] = useState(false)
  const [errorSubida, setErrorSubida] = useState("")
  const [arrastrando, setArrastrando] = useState(false)
  const [generar, setGenerar] = useState<Plantilla | null>(null)
  const input = useRef<HTMLInputElement>(null)

  const cargar = useCallback(() => {
    plantillasApi.listar().then(setPlantillas).catch((e) => { setPlantillas([]); toast.error((e as Error).message) })
  }, [])
  useEffect(() => { cargar() }, [cargar])

  const elegir = (f: File | undefined | null) => {
    if (!f) return
    setErrorSubida("")
    const ext = f.name.toLowerCase().split(".").pop()
    if (ext === "doc" || ext === "docx") {
      setErrorSubida("Es un archivo de Word. Ábrelo y usa Archivo → Guardar como → PDF, y sube ese PDF.")
      return
    }
    if (!["pdf", "png", "jpg", "jpeg"].includes(ext || "")) { setErrorSubida("Sube un PDF, PNG o JPG."); return }
    if (f.size > 10 * 1024 * 1024) { setErrorSubida("El archivo supera 10 MB."); return }
    setArchivo(f)
    if (!nombre) setNombre(f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "))
  }

  const subir = async () => {
    if (!archivo || !nombre.trim()) return
    setSubiendo(true)
    setErrorSubida("")
    try {
      const p = await plantillasApi.subir(archivo, nombre.trim())
      toast.success("Formato subido", { description: "Ahora coloca los campos." })
      router.push(`/cliente/templates/formato/${p.id}`)
    } catch (e) {
      setErrorSubida((e as Error).message)
      setSubiendo(false)
    }
  }

  const eliminar = async (p: Plantilla) => {
    if (!confirm(`¿Eliminar la plantilla “${p.nombre}”? Los DC-3 ya generados se podrán seguir descargando.`)) return
    try { await plantillasApi.eliminar(p.id); toast.success("Plantilla eliminada"); cargar() }
    catch (e) { toast.error((e as Error).message) }
  }

  const cerrarSubida = () => { setSubirAbierto(false); setArchivo(null); setNombre(""); setErrorSubida("") }
  const fecha = (v: string | null) => v ? new Date(v).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }) : ""

  return (
    <div className="space-y-6 px-4 py-4 lg:px-6 lg:py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Plantillas de DC-3</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Sube tu propio formato con tus logos y genera los DC-3 de todo un grupo en un solo PDF, listo para imprimir.</p>
        </div>
        <Button onClick={() => setSubirAbierto(true)} className="shrink-0"><Plus className="h-4 w-4" /> Subir formato</Button>
      </div>

      {plantillas === null ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-80 animate-pulse rounded-2xl border bg-muted/40" />)}
        </div>
      ) : plantillas.length === 0 ? (
        <motion.section
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="relative overflow-hidden rounded-2xl border bg-card p-6 sm:p-10"
        >
          <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-orange-500/10 blur-3xl" />
          <div className="relative mx-auto max-w-3xl text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-lg shadow-orange-500/25"><FileText className="h-7 w-7" /></span>
            <h2 className="mt-5 text-xl font-semibold sm:text-2xl">Deja de llenar los DC-3 uno por uno</h2>
            <p className="mx-auto mt-2 max-w-xl text-muted-foreground">Usa el formato que ya tienes. AACES lo llena con los datos de cada participante y agrega un QR verificable.</p>
            <ol className="mt-8 grid gap-4 text-left sm:grid-cols-3">
              {[
                { i: UploadCloud, t: "Sube tu formato", d: "PDF o imagen con tus logos. Si está en Word, guárdalo como PDF." },
                { i: MousePointerClick, t: "Coloca los campos", d: "Arrastra nombre, CURP, curso, fechas y QR a su lugar." },
                { i: FileDown, t: "Genera por grupo", d: "Elige el curso y descarga todos los DC-3 en un PDF." },
              ].map((p, n) => (
                <motion.li key={p.t} initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + n * 0.1, duration: 0.45, ease: EASE }} className="rounded-xl border bg-background p-4">
                  <span className="flex items-center gap-2 text-xs font-semibold text-orange-500"><p.i className="h-4 w-4" />Paso {n + 1}</span>
                  <p className="mt-2 font-semibold">{p.t}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{p.d}</p>
                </motion.li>
              ))}
            </ol>
            <Button size="lg" className="mt-8" onClick={() => setSubirAbierto(true)}><UploadCloud className="h-4 w-4" /> Subir mi formato</Button>
          </div>
        </motion.section>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence>
            {plantillas.map((p, i) => (
              <motion.article
                key={p.id}
                layout={!reduce}
                initial={reduce ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.4, delay: i * 0.05, ease: EASE }}
                className="group flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-orange-500/30 hover:shadow-md"
              >
                <Link href={`/cliente/templates/formato/${p.id}`} className="relative block h-52 overflow-hidden border-b bg-muted/40 p-4">
                  <div className="mx-auto h-full w-3/5 overflow-hidden rounded-sm bg-white shadow-md ring-1 ring-black/5 transition-transform duration-500 group-hover:scale-[1.03]">
                    <Miniatura id={p.id} />
                  </div>
                  <span className="absolute right-3 top-3 rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-medium shadow-sm backdrop-blur">
                    {p.campos.length} {p.campos.length === 1 ? "campo" : "campos"}
                  </span>
                </Link>
                <div className="flex flex-1 flex-col p-4">
                  <h2 className="truncate font-semibold">{p.nombre}</h2>
                  <p className="text-xs text-muted-foreground">Actualizada {fecha(p.fecha_actualizacion)}{p.paginas.length > 1 ? ` · ${p.paginas.length} páginas` : ""}</p>
                  {p.campos.length === 0 && <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">Falta colocar los campos.</p>}
                  <div className="mt-4 flex items-center gap-2">
                    <Button size="sm" className="flex-1" disabled={p.campos.length === 0} onClick={() => setGenerar(p)}><FileDown className="h-4 w-4" /> Generar DC-3</Button>
                    <Button size="sm" variant="outline" asChild><Link href={`/cliente/templates/formato/${p.id}`}><Pencil className="h-4 w-4" /> Editar</Link></Button>
                    <Button size="icon" variant="ghost" className="h-9 w-9 text-muted-foreground hover:bg-red-50 hover:text-red-600" onClick={() => eliminar(p)} aria-label={`Eliminar ${p.nombre}`}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </motion.article>
            ))}
          </AnimatePresence>
        </div>
      )}

      <Link href="/cliente/templates/html" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <Code2 className="h-3.5 w-3.5" /> Plantillas HTML (avanzado) <ArrowRight className="h-3 w-3" />
      </Link>

      {/* Subir formato */}
      <Sheet open={subirAbierto} onOpenChange={(o) => { if (!o) cerrarSubida() }}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
          <SheetHeader className="border-b px-6 py-5 text-left">
            <SheetTitle>Subir formato</SheetTitle>
            <SheetDescription>Tu DC-3, constancia o diploma con tus logos. Después colocas los campos.</SheetDescription>
          </SheetHeader>
          <form className="flex flex-1 flex-col" onSubmit={(e) => { e.preventDefault(); subir() }}>
            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
              <div
                role="button"
                tabIndex={0}
                onClick={() => input.current?.click()}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") input.current?.click() }}
                onDragOver={(e) => { e.preventDefault(); setArrastrando(true) }}
                onDragLeave={() => setArrastrando(false)}
                onDrop={(e) => { e.preventDefault(); setArrastrando(false); elegir(e.dataTransfer.files?.[0]) }}
                className={`flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-all duration-200 ${arrastrando ? "scale-[1.01] border-orange-500 bg-orange-50 dark:bg-orange-500/10" : archivo ? "border-green-500/50 bg-green-50/50 dark:bg-green-500/5" : "hover:border-orange-500/50 hover:bg-muted/50"}`}
              >
                <input ref={input} type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" className="hidden" onChange={(e) => elegir(e.target.files?.[0])} />
                {archivo ? (
                  <>
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-600 text-white"><FileText className="h-6 w-6" /></span>
                    <div>
                      <p className="font-medium">{archivo.name}</p>
                      <p className="text-xs text-muted-foreground">{(archivo.size / 1024).toFixed(0)} KB · toca para cambiarlo</p>
                    </div>
                  </>
                ) : (
                  <>
                    <motion.span animate={reduce ? undefined : { y: arrastrando ? -4 : 0 }} className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500"><FileUp className="h-6 w-6" /></motion.span>
                    <div>
                      <p className="font-medium">Arrastra tu archivo aquí</p>
                      <p className="text-sm text-muted-foreground">o toca para elegirlo · PDF, PNG o JPG · máx. 10 MB</p>
                    </div>
                  </>
                )}
              </div>

              <div className="rounded-xl bg-muted/50 p-4 text-sm">
                <p className="font-medium">¿Tu formato está en Word?</p>
                <p className="mt-1 text-muted-foreground">Ábrelo y elige <strong>Archivo → Guardar como → PDF</strong>. Así se imprime exactamente igual.</p>
              </div>

              <label className="grid gap-1.5 text-sm font-medium">
                Nombre de la plantilla
                <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. DC-3 oficial con logo" />
              </label>

              {errorSubida && (
                <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                  <X className="mt-0.5 h-4 w-4 shrink-0" />{errorSubida}
                </p>
              )}
            </div>
            <SheetFooter className="flex-row gap-2 border-t px-6 py-4 sm:justify-end">
              <Button type="button" variant="outline" className="flex-1 sm:flex-none" onClick={cerrarSubida}>Cancelar</Button>
              <Button type="submit" className="flex-1 sm:flex-none" disabled={!archivo || !nombre.trim() || subiendo}>
                {subiendo ? <><Loader2 className="h-4 w-4 animate-spin" /> Subiendo…</> : <>Continuar <ArrowRight className="h-4 w-4" /></>}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {generar && <GenerarDc3 abierto={!!generar} onCerrar={() => setGenerar(null)} plantillaId={generar.id} plantillaNombre={generar.nombre} />}
    </div>
  )
}
