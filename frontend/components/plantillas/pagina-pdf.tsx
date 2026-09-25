"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2 } from "lucide-react"

// pdf.js se carga solo en el navegador; el worker se sirve desde /public
type PdfDoc = { numPages: number; getPage: (n: number) => Promise<any> }
let pdfjsPromise: Promise<any> | null = null
function cargarPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((m: any) => {
      const lib = m.default ?? m
      lib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js"
      return lib
    })
  }
  return pdfjsPromise
}

export async function abrirPdf(datos: ArrayBuffer): Promise<PdfDoc> {
  const lib = await cargarPdfjs()
  return lib.getDocument({ data: new Uint8Array(datos.slice(0)) }).promise
}

/** Dibuja una página del PDF al ancho indicado (en píxeles CSS). */
export function PaginaPdf({ doc, pagina, ancho, className }: { doc: PdfDoc | null; pagina: number; ancho: number; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [listo, setListo] = useState(false)

  useEffect(() => {
    let cancelado = false
    let tarea: any = null
    setListo(false)
    if (!doc || !ancho || !canvasRef.current) return
    ;(async () => {
      const page = await doc.getPage(pagina + 1)
      if (cancelado) return
      const base = page.getViewport({ scale: 1 })
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const viewport = page.getViewport({ scale: (ancho / base.width) * dpr })
      const canvas = canvasRef.current!
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)
      canvas.style.width = `${ancho}px`
      canvas.style.height = `${(ancho / base.width) * base.height}px`
      tarea = page.render({ canvasContext: canvas.getContext("2d")!, viewport })
      try {
        await tarea.promise
        if (!cancelado) setListo(true)
      } catch {
        /* render cancelado */
      }
    })()
    return () => {
      cancelado = true
      try { tarea?.cancel() } catch {}
    }
  }, [doc, pagina, ancho])

  return (
    <div className={`relative bg-white ${className || ""}`}>
      <canvas ref={canvasRef} className={`block transition-opacity duration-300 ${listo ? "opacity-100" : "opacity-0"}`} />
      {!listo && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
        </div>
      )}
    </div>
  )
}
