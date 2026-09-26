"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Loader2, PenLine, Trash2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"

const token = () => { try { return localStorage.getItem("aaces_token") || "" } catch { return "" } }

/** Subir, ver y quitar una imagen de firma. El servidor le quita el fondo y la recorta. */
export function SubirFirma({ urlImagen, urlSubir, urlQuitar, metodoQuitar = "DELETE", tieneFirma, etiqueta, onCambio }: {
  urlImagen: string
  urlSubir: string
  urlQuitar: string
  metodoQuitar?: "DELETE" | "PUT"
  tieneFirma: boolean
  etiqueta: string
  onCambio?: () => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [vista, setVista] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const cargarVista = useCallback(async () => {
    if (!tieneFirma) { setVista(null); return }
    const r = await fetch(urlImagen, { headers: { Authorization: `Bearer ${token()}` } })
    if (r.ok) setVista(URL.createObjectURL(await r.blob()))
  }, [urlImagen, tieneFirma])
  useEffect(() => { cargarVista() }, [cargarVista])
  useEffect(() => () => { if (vista) URL.revokeObjectURL(vista) }, [vista])

  const subir = async (archivo?: File | null) => {
    if (!archivo) return
    setOcupado(true)
    try {
      const fd = new FormData()
      fd.append("archivo", archivo)
      const r = await fetch(urlSubir, { method: "PUT", body: fd, headers: { Authorization: `Bearer ${token()}` } })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(typeof d.detail === "string" ? d.detail : `Error ${r.status}`)
      toast.success("Firma guardada", { description: "Le quitamos el fondo para que no tape el formato." })
      onCambio?.()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  const quitar = async () => {
    setOcupado(true)
    try {
      const r = await fetch(urlQuitar, { method: metodoQuitar, headers: { Authorization: `Bearer ${token()}` } })
      if (!r.ok) throw new Error("No se pudo quitar la firma")
      setVista(null)
      onCambio?.()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="grid gap-2">
      <span className="text-sm font-medium">{etiqueta}</span>
      <div className="flex items-center gap-3">
        <div className="flex h-16 w-40 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed bg-white">
          {ocupado ? <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
            // eslint-disable-next-line @next/next/no-img-element -- vista previa local (blob:), next/image no aplica
            : vista ? <img src={vista} alt={etiqueta} className="max-h-full max-w-full object-contain p-1" />
            : <PenLine className="h-5 w-5 text-muted-foreground/50" />}
        </div>
        <div className="flex flex-col gap-1.5">
          <input ref={input} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => { subir(e.target.files?.[0]); e.target.value = "" }} />
          <Button type="button" size="sm" variant="outline" disabled={ocupado} onClick={() => input.current?.click()}>
            <Upload className="h-4 w-4" /> {tieneFirma ? "Cambiar" : "Subir firma"}
          </Button>
          {tieneFirma && (
            <Button type="button" size="sm" variant="ghost" disabled={ocupado} onClick={quitar} className="text-muted-foreground hover:bg-red-50 hover:text-red-600">
              <Trash2 className="h-4 w-4" /> Quitar
            </Button>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Foto o escaneo en fondo claro (PNG o JPG). Quitamos el fondo automáticamente.</p>
    </div>
  )
}
