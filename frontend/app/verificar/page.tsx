"use client"
import { useState, useCallback } from "react"
import { QrCode, SendHorizonal, Shield, CheckCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import Image from "next/image"

export const dynamic = "force-dynamic"

interface ValidationResult {
  valido: boolean
  mensaje: string
  datos_certificado?: {
    nombre_participante: string
    nombre_curso: string
    codigo_curso: string
    fecha_inicio: string
    fecha_fin: string
    duracion_horas: number
    calificacion?: number
    fecha_emision?: string
    fecha_expiracion?: string
    id_certificado?: string
    constancias?: string[]
    capacitador?: string
    estado?: string
  }
  intentos_restantes?: number
}

export default function VerificarPage() {
  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ValidationResult | null>(null)
  const [attempts, setAttempts] = useState(5)

  const verify = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) { toast.error("Ingresa un código de validación"); return }
    setLoading(true)
    // Timeout de 20s: sin esto, si el backend no responde el fetch se queda
    // colgado para siempre y el botón queda deshabilitado sin explicación.
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 20000)
    try {
      const raw = code.trim().toUpperCase()
      const c = raw.startsWith("CERT-") ? raw.slice(5) : raw
      const res = await fetch("/api/v1/validaciones/validar-certificado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo_validacion: c, ip_address: "127.0.0.1", user_agent: navigator.userAgent }),
        signal: controller.signal,
      })
      const data = await res.json()
      const norm = data?.certificado ? { ...data, datos_certificado: data.datos_certificado ?? data.certificado } : data
      setResult(norm)
      if (norm.intentos_restantes !== undefined) setAttempts(norm.intentos_restantes)
      if (norm.valido) toast.success("Certificado verificado exitosamente")
      else toast.error(norm.mensaje)
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        toast.error("La verificación tardó demasiado. Intenta de nuevo.")
      } else {
        toast.error("Error al verificar el certificado")
      }
    } finally {
      clearTimeout(timer)
      setLoading(false)
    }
  }, [code])

  return (
    <div className="min-h-screen bg-background pt-24">
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-3xl font-semibold">Verificar certificado</h1>
        <p className="mt-3 text-muted-foreground">
          Ingresa el código único de tu constancia o escanea el código QR.
        </p>

        <form onSubmit={verify} className="mx-auto mt-8 max-w-sm">
          <div className="bg-background relative grid grid-cols-[1fr_auto] items-center rounded-[1.5rem] border pr-2 shadow-[0_8px_30px_rgba(0,0,0,0.08)] focus-within:ring-2 focus-within:ring-muted">
            <QrCode className="pointer-events-none absolute inset-y-0 left-4 my-auto h-4 w-4" />
            <input
              placeholder="AACES-26-XXXXXX"
              className="h-12 w-full bg-transparent pl-12 focus:outline-none font-mono tracking-wider text-sm"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={20}
              disabled={loading || attempts <= 0}
            />
            <div className="md:pr-1.5">
              <Button type="submit" size="sm" className="rounded-[1.5rem] bg-black text-white dark:bg-white dark:text-black" disabled={loading || attempts <= 0}>
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" strokeWidth={2} />
                ) : (
                  <>
                    <span className="hidden md:block">Verificar</span>
                    <SendHorizonal className="relative mx-auto h-5 w-5 md:hidden" strokeWidth={2} />
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>

        {attempts <= 3 && attempts > 0 && (
          <p className="text-sm text-muted-foreground mt-2">Intentos restantes: {attempts}</p>
        )}
        {attempts <= 0 && (
          <p className="text-sm text-destructive mt-2">Has excedido el número de intentos.</p>
        )}

        {/* Result */}
        {result && (
          <div className={`mt-10 rounded-2xl border p-6 text-left ${
            result.valido ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20" : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20"
          }`}>
            <div className="flex items-center gap-3 mb-6">
              {result.valido ? (
                <CheckCircle className="h-6 w-6 text-green-600" />
              ) : (
                <Shield className="h-6 w-6 text-red-600" />
              )}
              <p className={`text-lg font-semibold ${result.valido ? "text-green-800" : "text-red-800"}`}>
                {result.mensaje}
              </p>
            </div>
            {result.datos_certificado && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Participante</p>
                  <p className="font-medium">{result.datos_certificado.nombre_participante}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Curso</p>
                  <p className="font-medium">{result.datos_certificado.nombre_curso}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Emitido por</p>
                  <p className="font-medium">{result.datos_certificado.capacitador || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Emisión</p>
                  <p className="font-medium">
                    {result.datos_certificado.fecha_emision
                      ? new Date(result.datos_certificado.fecha_emision).toLocaleDateString("es-ES")
                      : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Vigencia</p>
                  <p className="font-medium">
                    {result.datos_certificado.fecha_expiracion
                      ? new Date(result.datos_certificado.fecha_expiracion).toLocaleDateString("es-ES")
                      : "No expira"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Estado</p>
                  <p className={`font-semibold ${
                    result.datos_certificado.estado === "Vencido" || 
                    (result.datos_certificado.fecha_expiracion && new Date(result.datos_certificado.fecha_expiracion) < new Date())
                      ? "text-red-600" : "text-green-600"
                  }`}>
                    {result.datos_certificado.estado ||
                      (result.datos_certificado.fecha_expiracion && new Date(result.datos_certificado.fecha_expiracion) < new Date()
                        ? "Vencido" : "Vigente")}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs text-muted-foreground">ID</p>
                  <p className="font-mono text-sm">{result.datos_certificado.id_certificado || "-"}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}