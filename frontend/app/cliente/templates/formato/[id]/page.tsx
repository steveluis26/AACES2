"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { motion, useReducedMotion } from "motion/react"
import {
  AlignCenter, AlignLeft, AlignRight, ArrowLeft, Bold, Check, Copy, Eye, FileDown, GripVertical,
  Loader2, MousePointerClick, PenLine, Plus, QrCode, Save, Trash2, Type,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Segmented, SwitchCard } from "@/components/forms/form-bits"
import { PaginaPdf, abrirPdf } from "@/components/plantillas/pagina-pdf"
import { GenerarDc3 } from "@/components/plantillas/generar-dc3"
import {
  CASILLAS_SUGERIDAS, EJEMPLOS, FIRMAS, abrirBlob, plantillasApi,
  type CampoCatalogo, type CampoPlantilla, type Plantilla,
} from "@/lib/plantillas"

const uid = () => Math.random().toString(36).slice(2, 10)
const redondear = (n: number) => Math.round(n * 100) / 100
const acotar = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

// Textos habituales cuando el participante no tiene empleador (p. ej. estudiantes)
const SUGERENCIAS_VACIO: Record<string, string[]> = {
  empresa: ["PARTICULAR", "INDEPENDIENTE", "NO APLICA"],
  puesto: ["ESTUDIANTE", "NO APLICA"],
  ocupacion: ["ESTUDIANTE", "NO APLICA"],
}

function nuevoCampo(clave: string, pagina: number, x: number, y: number, pw: number): CampoPlantilla {
  const esQr = clave === "qr"
  const esFirma = FIRMAS.has(clave)
  const w = esQr ? 14 : esFirma ? 22 : CASILLAS_SUGERIDAS[clave] ? Math.min(60, CASILLAS_SUGERIDAS[clave] * 2.6) : 36
  const h = esQr ? redondear(14 * (pw ? 1 : 1)) : esFirma ? 6 : 3
  return {
    id: uid(), clave, pagina,
    x: redondear(acotar(x - w / 2, 0, 100 - w)), y: redondear(acotar(y - h / 2, 0, 100 - h)),
    w, h, tam: 10, alineacion: "left", negrita: false, espaciado: 0, mayusculas: true,
    color: "#111111", texto: clave === "texto" ? "Texto fijo" : "", casillas: CASILLAS_SUGERIDAS[clave] || 0,
  }
}

export default function EditorPlantillaPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const reduce = useReducedMotion()
  const [plantilla, setPlantilla] = useState<Plantilla | null>(null)
  const [catalogo, setCatalogo] = useState<CampoCatalogo[]>([])
  const [doc, setDoc] = useState<any>(null)
  const [error, setError] = useState("")
  const [campos, setCampos] = useState<CampoPlantilla[]>([])
  const [nombre, setNombre] = useState("")
  const [pagina, setPagina] = useState(0)
  const [sel, setSel] = useState<string | null>(null)
  const [sucio, setSucio] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [previsualizando, setPrevisualizando] = useState(false)
  const [generarAbierto, setGenerarAbierto] = useState(false)
  const [ancho, setAncho] = useState(0)
  const zona = useRef<HTMLDivElement>(null)
  const hoja = useRef<HTMLDivElement>(null)

  // Carga inicial
  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const [p, cat, arch] = await Promise.all([
          plantillasApi.obtener(params.id), plantillasApi.catalogo(), plantillasApi.archivo(params.id),
        ])
        if (!vivo) return
        setPlantilla(p)
        setNombre(p.nombre)
        setCampos((p.campos || []).map((c) => ({ ...c, id: uid() })))
        setCatalogo(cat)
        setDoc(await abrirPdf(arch))
      } catch (e) {
        if (vivo) setError((e as Error).message || "No pudimos abrir la plantilla")
      }
    })()
    return () => { vivo = false }
  }, [params.id])

  // Ancho disponible para la hoja
  useEffect(() => {
    if (!zona.current) return
    const ro = new ResizeObserver(([e]) => setAncho(Math.min(900, Math.floor(e.contentRect.width - (e.contentRect.width < 600 ? 0 : 48)))))
    ro.observe(zona.current)
    return () => ro.disconnect()
  }, [plantilla])

  const pag = plantilla?.paginas[pagina] || { w: 612, h: 792 }
  const escala = ancho / pag.w // px por punto tipográfico
  const alto = ancho * (pag.h / pag.w)
  const seleccionado = campos.find((c) => c.id === sel) || null
  const etiqueta = useCallback((clave: string) => catalogo.find((c) => c.clave === clave)?.etiqueta || clave, [catalogo])
  const grupos = useMemo(() => {
    const g: Record<string, CampoCatalogo[]> = {}
    for (const c of catalogo) (g[c.grupo] ||= []).push(c)
    return g
  }, [catalogo])

  const actualizar = (id: string, cambios: Partial<CampoPlantilla>) => {
    setCampos((cs) => cs.map((c) => (c.id === id ? { ...c, ...cambios } : c)))
    setSucio(true)
  }
  const agregar = (clave: string, x = 50, y = 50) => {
    const c = nuevoCampo(clave, pagina, x, y, pag.w)
    if (clave === "qr") c.h = redondear(c.w * (pag.w / pag.h))
    setCampos((cs) => [...cs, c])
    setSel(c.id!)
    setSucio(true)
  }
  const eliminar = (id: string) => { setCampos((cs) => cs.filter((c) => c.id !== id)); setSel(null); setSucio(true) }
  const duplicar = (c: CampoPlantilla) => {
    const d = { ...c, id: uid(), y: redondear(acotar(c.y + c.h + 1, 0, 100 - c.h)) }
    setCampos((cs) => [...cs, d]); setSel(d.id!); setSucio(true)
  }

  const guardar = useCallback(async () => {
    if (!plantilla) return
    setGuardando(true)
    try {
      const p = await plantillasApi.guardar(plantilla.id, { nombre: nombre.trim() || plantilla.nombre, campos })
      setPlantilla(p)
      setSucio(false)
      toast.success("Plantilla guardada")
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setGuardando(false)
    }
  }, [plantilla, nombre, campos])

  const vistaPrevia = async () => {
    if (!plantilla) return
    setPrevisualizando(true)
    try { abrirBlob(await plantillasApi.vistaPrevia(plantilla.id, campos)) }
    catch (e) { toast.error((e as Error).message) }
    finally { setPrevisualizando(false) }
  }

  // Teclado: flechas mueven, Supr borra, Cmd/Ctrl+S guarda
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); guardar(); return }
      const t = e.target as HTMLElement
      if (!seleccionado || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return
      const paso = e.shiftKey ? 1 : 0.2
      const mov: Record<string, [number, number]> = { ArrowLeft: [-paso, 0], ArrowRight: [paso, 0], ArrowUp: [0, -paso], ArrowDown: [0, paso] }
      if (mov[e.key]) {
        e.preventDefault()
        const [dx, dy] = mov[e.key]
        actualizar(seleccionado.id!, { x: redondear(acotar(seleccionado.x + dx, 0, 100 - seleccionado.w)), y: redondear(acotar(seleccionado.y + dy, 0, 100 - seleccionado.h)) })
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault(); eliminar(seleccionado.id!)
      } else if (e.key === "Escape") setSel(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  // Aviso al salir con cambios sin guardar
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (sucio) { e.preventDefault(); e.returnValue = "" } }
    window.addEventListener("beforeunload", h)
    return () => window.removeEventListener("beforeunload", h)
  }, [sucio])

  // Arrastrar / redimensionar con el puntero (funciona con mouse y touch)
  const iniciarArrastre = (e: React.PointerEvent, c: CampoPlantilla, modo: "mover" | "tamano") => {
    e.preventDefault(); e.stopPropagation()
    setSel(c.id!)
    const inicio = { x: e.clientX, y: e.clientY, cx: c.x, cy: c.y, cw: c.w, ch: c.h }
    const mover = (ev: PointerEvent) => {
      const dx = ((ev.clientX - inicio.x) / ancho) * 100
      const dy = ((ev.clientY - inicio.y) / alto) * 100
      if (modo === "mover") {
        actualizar(c.id!, { x: redondear(acotar(inicio.cx + dx, 0, 100 - c.w)), y: redondear(acotar(inicio.cy + dy, 0, 100 - c.h)) })
      } else if (c.clave === "qr") {
        const w = acotar(inicio.cw + dx, 4, 100 - c.x)
        actualizar(c.id!, { w: redondear(w), h: redondear(w * (pag.w / pag.h)) })
      } else {
        actualizar(c.id!, { w: redondear(acotar(inicio.cw + dx, 2, 100 - c.x)), h: redondear(acotar(inicio.ch + dy, 1, 100 - c.y)) })
      }
    }
    const soltar = () => { window.removeEventListener("pointermove", mover); window.removeEventListener("pointerup", soltar) }
    window.addEventListener("pointermove", mover)
    window.addEventListener("pointerup", soltar)
  }

  const soltarDesdePaleta = (e: React.DragEvent) => {
    e.preventDefault()
    const clave = e.dataTransfer.getData("text/campo")
    if (!clave || !hoja.current) return
    const r = hoja.current.getBoundingClientRect()
    agregar(clave, ((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100)
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 px-4 py-24 text-center">
        <p className="font-semibold">{error}</p>
        <Button variant="outline" asChild><Link href="/cliente/templates"><ArrowLeft className="h-4 w-4" /> Volver a plantillas</Link></Button>
      </div>
    )
  }
  if (!plantilla) {
    return <div className="flex items-center justify-center py-32"><Loader2 className="h-6 w-6 animate-spin text-orange-500" /></div>
  }

  const enPagina = campos.filter((c) => c.pagina === pagina)

  return (
    <div className="flex min-h-[calc(100svh-3rem)] flex-col">
      {/* Barra superior */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur lg:px-6">
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => { if (!sucio || confirm("Tienes cambios sin guardar. ¿Salir de todos modos?")) router.push("/cliente/templates") }} aria-label="Volver">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Input value={nombre} onChange={(e) => { setNombre(e.target.value); setSucio(true) }} aria-label="Nombre de la plantilla" className="h-9 w-full max-w-xs border-transparent bg-transparent px-2 text-base font-semibold shadow-none hover:border-input focus-visible:border-input sm:w-72" />
        <span className={`hidden items-center gap-1.5 text-xs sm:inline-flex ${sucio ? "text-amber-600" : "text-muted-foreground"}`}>
          {sucio ? <><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />Cambios sin guardar</> : <><Check className="h-3.5 w-3.5 text-green-600" />Guardado</>}
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={vistaPrevia} disabled={previsualizando || campos.length === 0}>
            {previsualizando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />} Vista previa
          </Button>
          <Button variant="outline" size="sm" onClick={guardar} disabled={guardando || !sucio}>
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar
          </Button>
          <Button size="sm" onClick={async () => { if (sucio) await guardar(); setGenerarAbierto(true) }} disabled={campos.length === 0}>
            <FileDown className="h-4 w-4" /> Generar DC-3
          </Button>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-[minmax(0,1fr)] lg:grid-cols-[260px_minmax(0,1fr)_280px]">
        {/* Paleta de campos */}
        <aside className="border-b p-4 lg:max-h-[calc(100svh-7rem)] lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <p className="mb-1 text-sm font-semibold">Campos</p>
          <p className="mb-3 text-xs text-muted-foreground lg:mb-4"><span className="hidden lg:inline">Arrástralos a tu formato o tócalos para agregarlos.</span><span className="lg:hidden">Toca un campo para agregarlo y luego muévelo con el dedo.</span></p>
          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:block lg:space-y-4 lg:overflow-visible lg:px-0 lg:pb-0">
            {Object.entries(grupos).map(([grupo, items]) => (
              <div key={grupo} className="contents lg:block">
                <p className="mb-1.5 hidden text-[11px] font-semibold uppercase tracking-wide text-muted-foreground lg:block">{grupo}</p>
                <div className="contents lg:flex lg:flex-col lg:gap-1.5">
                  {items.map((c) => {
                    const usado = campos.some((k) => k.clave === c.clave)
                    return (
                      <button
                        key={c.clave}
                        type="button"
                        draggable
                        onDragStart={(e) => { e.dataTransfer.setData("text/campo", c.clave); e.dataTransfer.effectAllowed = "copy" }}
                        onClick={() => agregar(c.clave)}
                        className="group flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border bg-background px-3 py-2 text-left text-xs transition-all hover:border-orange-500/50 hover:bg-orange-500/5 active:scale-[0.98] lg:w-full lg:text-sm"
                      >
                        <GripVertical className="hidden h-3.5 w-3.5 text-muted-foreground/60 lg:block" />
                        {c.clave === "qr" ? <QrCode className="h-3.5 w-3.5 text-orange-500" /> : c.clave === "texto" ? <Type className="h-3.5 w-3.5 text-orange-500" /> : FIRMAS.has(c.clave) ? <PenLine className="h-3.5 w-3.5 text-orange-500" /> : null}
                        <span className="flex-1 truncate">{c.etiqueta}</span>
                        {usado ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Plus className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Hoja */}
        <main ref={zona} className="min-w-0 bg-muted/40 p-3 sm:p-6" onPointerDown={() => setSel(null)}>
          {plantilla.paginas.length > 1 && (
            <div className="mb-4 flex justify-center">
              <Segmented
                ariaLabel="Página"
                value={String(pagina)}
                onChange={(v) => { setPagina(Number(v)); setSel(null) }}
                options={plantilla.paginas.map((_, i) => ({ value: String(i), label: `Página ${i + 1}` }))}
              />
            </div>
          )}
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto shadow-xl ring-1 ring-black/5"
            style={{ width: ancho || undefined }}
          >
            <div ref={hoja} className="relative select-none" style={{ width: ancho, height: alto }} onDragOver={(e) => e.preventDefault()} onDrop={soltarDesdePaleta}>
              <PaginaPdf doc={doc} pagina={pagina} ancho={ancho} />
              {enPagina.map((c) => {
                const activo = c.id === sel
                const muestra = c.clave === "texto" ? c.texto : EJEMPLOS[c.clave] || etiqueta(c.clave)
                const texto = c.mayusculas ? muestra.toUpperCase() : muestra
                const fontPx = c.tam * escala
                return (
                  <div
                    key={c.id}
                    role="button"
                    tabIndex={0}
                    aria-label={etiqueta(c.clave)}
                    onPointerDown={(e) => iniciarArrastre(e, c, "mover")}
                    className={`absolute cursor-move touch-none rounded-[2px] outline outline-1 transition-[outline-color,background-color] ${activo ? "z-10 bg-orange-500/10 outline-2 outline-orange-500" : "bg-orange-500/5 outline-orange-500/40 hover:outline-orange-500"}`}
                    style={{ left: `${c.x}%`, top: `${c.y}%`, width: `${c.w}%`, height: `${c.h}%` }}
                  >
                    {c.clave === "qr" ? (
                      <div className="flex h-full w-full items-center justify-center bg-white/80"><QrCode className="h-3/4 w-3/4 text-gray-800" /></div>
                    ) : FIRMAS.has(c.clave) ? (
                      <svg viewBox="0 0 120 40" preserveAspectRatio="xMidYMax meet" className="h-full w-full text-blue-900/70" aria-hidden="true">
                        <path d="M6 28 C 18 6, 26 38, 38 20 S 58 4, 66 24 S 88 36, 96 14 S 110 22, 114 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                      </svg>
                    ) : c.casillas ? (
                      <div className="grid h-full w-full" style={{ gridTemplateColumns: `repeat(${c.casillas}, 1fr)` }}>
                        {Array.from({ length: c.casillas }).map((_, i) => (
                          <span key={i} className="flex items-center justify-center overflow-hidden leading-none" style={{ fontSize: Math.min(fontPx, (ancho * c.w) / 100 / c.casillas * 1.1), fontWeight: c.negrita ? 700 : 400, color: c.color, fontFamily: "Helvetica, Arial, sans-serif" }}>
                            {texto[i] || ""}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div
                        className="flex h-full w-full items-center overflow-hidden whitespace-nowrap leading-none"
                        style={{ justifyContent: c.alineacion === "center" ? "center" : c.alineacion === "right" ? "flex-end" : "flex-start", fontSize: fontPx, fontWeight: c.negrita ? 700 : 400, letterSpacing: c.espaciado * escala, color: c.color, fontFamily: "Helvetica, Arial, sans-serif" }}
                      >
                        {texto}
                      </div>
                    )}
                    {activo && (
                      <>
                        <span className="pointer-events-none absolute -top-5 left-0 whitespace-nowrap rounded bg-orange-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">{etiqueta(c.clave)}</span>
                        <span
                          onPointerDown={(e) => iniciarArrastre(e, c, "tamano")}
                          className="absolute -bottom-1.5 -right-1.5 h-3 w-3 cursor-nwse-resize rounded-full border-2 border-white bg-orange-500 shadow"
                          aria-hidden="true"
                        />
                      </>
                    )}
                  </div>
                )
              })}
              {campos.length === 0 && doc && (
                <div className="pointer-events-none absolute inset-x-0 top-8 flex justify-center">
                  <span className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-4 py-2 text-sm font-medium text-white shadow-lg">
                    <MousePointerClick className="h-4 w-4" /> Arrastra un campo aquí para empezar
                  </span>
                </div>
              )}
            </div>
          </motion.div>
          <p className="mt-4 hidden text-center text-xs text-muted-foreground lg:block">
            Flechas para mover · Shift + flechas para mover más · Supr para borrar · ⌘/Ctrl + S para guardar
          </p>
        </main>

        {/* Propiedades */}
        <aside className="border-t p-4 lg:max-h-[calc(100svh-7rem)] lg:overflow-y-auto lg:border-l lg:border-t-0">
          {seleccionado ? (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">Campo seleccionado</p>
                  <p className="font-semibold">{etiqueta(seleccionado.clave)}</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => duplicar(seleccionado)} aria-label="Duplicar"><Copy className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-red-50 hover:text-red-600" onClick={() => eliminar(seleccionado.id!)} aria-label="Eliminar"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>

              {seleccionado.clave === "texto" && (
                <label className="grid gap-1.5 text-sm font-medium">Texto
                  <Input value={seleccionado.texto} onChange={(e) => actualizar(seleccionado.id!, { texto: e.target.value })} />
                </label>
              )}
              {seleccionado.clave !== "texto" && seleccionado.clave !== "qr" && !FIRMAS.has(seleccionado.clave) && (
                <div className="grid gap-1.5">
                  <label htmlFor="si_vacio" className="text-sm font-medium">Si viene vacío, escribir</label>
                  <Input id="si_vacio" value={seleccionado.texto} placeholder="Dejar en blanco"
                    onChange={(e) => actualizar(seleccionado.id!, { texto: e.target.value })} />
                  {SUGERENCIAS_VACIO[seleccionado.clave] && (
                    <div className="flex flex-wrap gap-1.5">
                      {SUGERENCIAS_VACIO[seleccionado.clave].map((t) => (
                        <button key={t} type="button" onClick={() => actualizar(seleccionado.id!, { texto: t })}
                          className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${seleccionado.texto === t ? "border-orange-500 bg-orange-500 text-white" : "hover:border-orange-500/50 hover:bg-orange-50 dark:hover:bg-orange-500/10"}`}>{t}</button>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">Útil para participantes sin empleador, como estudiantes. Si lo dejas vacío, el campo sale en blanco.</p>
                </div>
              )}

              {seleccionado.clave !== "qr" && !FIRMAS.has(seleccionado.clave) && (
                <>
                  <label className="grid gap-1.5 text-sm font-medium">
                    <span className="flex justify-between">Tamaño de letra <span className="font-normal text-muted-foreground">{seleccionado.tam} pt</span></span>
                    <input type="range" min={5} max={36} step={0.5} value={seleccionado.tam} onChange={(e) => actualizar(seleccionado.id!, { tam: Number(e.target.value) })} className="accent-orange-500" />
                  </label>

                  <div className="grid gap-1.5">
                    <span className="text-sm font-medium">Estilo</span>
                    <div className="flex gap-2">
                      <Button type="button" variant={seleccionado.negrita ? "default" : "outline"} size="icon" className="h-9 w-9" onClick={() => actualizar(seleccionado.id!, { negrita: !seleccionado.negrita })} aria-pressed={seleccionado.negrita} aria-label="Negrita"><Bold className="h-4 w-4" /></Button>
                      {!seleccionado.casillas && (["left", "center", "right"] as const).map((a) => {
                        const I = a === "left" ? AlignLeft : a === "center" ? AlignCenter : AlignRight
                        return <Button key={a} type="button" variant={seleccionado.alineacion === a ? "default" : "outline"} size="icon" className="h-9 w-9" onClick={() => actualizar(seleccionado.id!, { alineacion: a })} aria-pressed={seleccionado.alineacion === a} aria-label={`Alinear ${a}`}><I className="h-4 w-4" /></Button>
                      })}
                      <label className="relative flex h-9 w-9 cursor-pointer items-center justify-center overflow-hidden rounded-md border" title="Color">
                        <span className="h-5 w-5 rounded-full border" style={{ background: seleccionado.color }} />
                        <input type="color" value={seleccionado.color} onChange={(e) => actualizar(seleccionado.id!, { color: e.target.value })} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Color" />
                      </label>
                    </div>
                  </div>

                  <label className="grid gap-1.5 text-sm font-medium">
                    Casillas
                    <Input type="number" min={0} max={40} value={seleccionado.casillas} onChange={(e) => actualizar(seleccionado.id!, { casillas: Math.max(0, Math.min(40, Number(e.target.value) || 0)) })} />
                    <span className="text-xs font-normal text-muted-foreground">Para formatos con cuadritos (CURP: 18, año: 4). Pon 0 para texto normal.</span>
                  </label>

                  <SwitchCard id="mayus" checked={seleccionado.mayusculas} onChange={(v) => actualizar(seleccionado.id!, { mayusculas: v })} title="Mayúsculas" desc="Como se llenan normalmente los DC-3." />
                </>
              )}
              {FIRMAS.has(seleccionado.clave) && (
                <p className="rounded-lg bg-orange-500/5 p-3 text-xs text-muted-foreground">
                  Se imprime la firma de quien impartió el curso (se sube en Instructores). Se ajusta al recuadro sin deformarse y se apoya en la línea de abajo. AACES no imprime las firmas del patrón ni del representante de los trabajadores: muchos participantes no tienen empleador (por ejemplo, estudiantes); cuando sí aplican, se firman sobre el impreso.
                </p>
              )}
              {seleccionado.clave === "qr" && (
                <p className="rounded-lg bg-orange-500/5 p-3 text-xs text-muted-foreground">El QR lleva a la página de verificación de cada participante. Arrastra la esquina para cambiar su tamaño; mínimo recomendado: 2 cm.</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm font-semibold">Cómo usar el editor</p>
              <ol className="space-y-3 text-sm text-muted-foreground">
                {["Arrastra cada campo al lugar donde va en tu formato.", "Ajusta su tamaño desde la esquina naranja y elige el tamaño de letra.", "Usa “Vista previa” para ver el PDF con datos de ejemplo.", "Guarda y genera los DC-3 de todo un grupo en un solo archivo."].map((t, i) => (
                  <li key={i} className="flex gap-2.5"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-500 text-[11px] font-bold text-white">{i + 1}</span>{t}</li>
                ))}
              </ol>
              {campos.length > 0 && (
                <div className="border-t pt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">En esta plantilla ({campos.length})</p>
                  <ul className="space-y-1">
                    {campos.map((c) => (
                      <li key={c.id}>
                        <button type="button" onClick={() => { setPagina(c.pagina); setSel(c.id!) }} className="w-full truncate rounded-md px-2 py-1 text-left text-sm hover:bg-muted">
                          {etiqueta(c.clave)}{plantilla.paginas.length > 1 ? <span className="text-muted-foreground"> · p. {c.pagina + 1}</span> : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>

      <GenerarDc3 abierto={generarAbierto} onCerrar={() => setGenerarAbierto(false)} plantillaId={plantilla.id} plantillaNombre={nombre} />
    </div>
  )
}
