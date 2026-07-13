"use client"
import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Shield, CheckCircle, Loader2 } from "lucide-react"
import Link from "next/link"

export const dynamic = "force-dynamic"

export default function CertificadoPage() {
  const { id } = useParams<{ id: string }>()
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!id) return
    ;(async () => {
      try {
        const raw = (id as string).toUpperCase()
        const code = raw.startsWith("CERT-") ? raw.slice(5) : raw
        const res = await fetch("/api/v1/validaciones/validar-certificado", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ codigo_validacion: code, ip_address: "127.0.0.1", user_agent: navigator.userAgent })
        })
        const data = await res.json()
        const norm = data?.certificado ? { ...data, datos_certificado: data.datos_certificado ?? data.certificado } : data
        setResult(norm)
        if (!norm.valido) setError(norm.mensaje || "Certificado no encontrado")
      } catch {
        setError("Error al verificar el certificado")
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background pt-24">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pt-24">
      <div className="mx-auto max-w-lg px-6 py-16">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground mb-6 block">&larr; Volver</Link>
        
        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
            <Shield className="h-10 w-10 text-red-500 mx-auto" />
            <h1 className="mt-4 text-xl font-semibold text-red-800">Certificado no válido</h1>
            <p className="mt-2 text-red-600">{error}</p>
          </div>
        ) : result?.datos_certificado ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-8">
            <div className="flex items-center gap-3 mb-6">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div>
                <h1 className="text-xl font-semibold text-green-800">Certificado verificado</h1>
                <p className="text-green-600 text-sm">Este certificado es auténtico y está registrado en AACES.</p>
              </div>
            </div>
            <div className="grid gap-4">
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Emisión</p>
                  <p className="font-medium">{result.datos_certificado.fecha_emision ? new Date(result.datos_certificado.fecha_emision).toLocaleDateString("es-ES") : "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Vigencia</p>
                  <p className="font-medium">{result.datos_certificado.fecha_expiracion ? new Date(result.datos_certificado.fecha_expiracion).toLocaleDateString("es-ES") : "No expira"}</p>
                </div>
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
              <div>
                <p className="text-xs text-muted-foreground">ID</p>
                <p className="font-mono text-sm">{result.datos_certificado.id_certificado || "-"}</p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}