"use client"

import { useEffect, useState } from "react"
import { XCircle, Shield, Loader2, QrCode, Hash } from "lucide-react"

interface ParticipanteData {
  nombre: string
  empresa?: string | null
}

interface CursoData {
  nombre: string
  codigo_curso?: string | null
  fecha_inicio?: string | null
  fecha_fin?: string | null
  duracion_horas?: number
  modalidad?: string | null
  empresa_contratante?: string | null
  calificacion?: number | null
  estado_acreditacion?: boolean
  inicio_vigencia?: string | null
  expiracion?: string | null
}

interface VerifyData {
  valida: boolean
  codigo_validacion: string
  tipo_documento: string
  estatus: string
  fecha_emision?: string | null
  pdf_hash?: string | null
  organizacion?: string | null
  nombre_comercial?: string | null
  rfc?: string | null
  org_estado?: string | null
  org_ciudad?: string | null
  folio?: string | null
  participante?: ParticipanteData | null
  curso?: CursoData | null
  verificaciones_count: number
}

function fmtFecha(iso?: string | null): string | null {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleDateString("es-MX", {
      year: "numeric", month: "long", day: "numeric",
    })
  } catch {
    return iso
  }
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null
  return (
    <div className="bg-gray-50 rounded-xl p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-base font-semibold break-words">{value}</p>
    </div>
  )
}

export default function VerificarCodigoPage({ params }: { params: { codigo: string } }) {
  const [data, setData] = useState<VerifyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch(`/api/v1/verificaciones/${params.codigo}`)
        if (!res.ok) {
          if (mounted) setError("No se pudo verificar el documento")
          return
        }
        const json: VerifyData = await res.json()
        if (mounted) setData(json)
      } catch {
        if (mounted) setError("Error de conexión al verificar")
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [params.codigo])

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Verificando documento...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-red-800 mb-2">Error de verificación</h1>
          <p className="text-red-600">{error || "Documento no encontrado"}</p>
        </div>
      </div>
    )
  }

  const valida = data.valida
  const isConstancia = data.tipo_documento === "CONSTANCIA"
  const curso = data.curso
  const participante = data.participante

  return (
    <div className="flex min-h-svh items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-lg">
        <div className={`rounded-2xl border-2 p-8 shadow-lg ${
          valida ? "border-green-200 bg-white" : "border-red-200 bg-white"
        }`}>
          <div className="text-center mb-6">
            <div className="flex justify-center mb-4">
              <img src="/logo.png" alt="AACES" className="h-16 w-auto object-contain" />
            </div>
            <h1 className={`text-2xl font-bold ${valida ? "text-green-800" : "text-red-800"}`}>
              {valida ? "CONSTANCIA VÁLIDA" : "Documento no válido"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {valida
                ? "Documento emitido por una organización registrada en AACES."
                : data.estatus === "cancelado"
                  ? "Este documento ha sido revocado por la organización emisora."
                  : "El código de verificación no corresponde a ningún documento emitido."}
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 mb-6 text-xs text-muted-foreground">
            <Shield className="h-3.5 w-3.5" />
            <span>Verificado mediante AACES</span>
          </div>

          {valida ? (
            <div className="space-y-5">
              {/* Participante */}
              {participante && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Participante
                  </p>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-lg font-semibold">{participante.nombre}</p>
                    {participante.empresa && (
                      <p className="text-sm text-muted-foreground">{participante.empresa}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Curso */}
              {curso && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Curso
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-xl p-4 col-span-2">
                      <p className="text-xs text-muted-foreground mb-1">Nombre</p>
                      <p className="text-base font-semibold">{curso.nombre}</p>
                    </div>
                    <Field label="Duración" value={curso.duracion_horas ? `${curso.duracion_horas} horas` : null} />
                    <Field label="Modalidad" value={curso.modalidad} />
                    <Field label="Fecha de inicio" value={fmtFecha(curso.fecha_inicio)} />
                    <Field label="Fecha de término" value={fmtFecha(curso.fecha_fin)} />
                    <Field label="Vigencia desde" value={fmtFecha(curso.inicio_vigencia)} />
                    <Field label="Vigencia hasta" value={fmtFecha(curso.expiracion)} />
                    <Field label="Empresa contratante" value={curso.empresa_contratante} />
                  </div>
                </div>
              )}

              {/* Capacitador / Organización emisora */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Capacitador
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-xl p-4 col-span-2">
                    <p className="text-xs text-muted-foreground mb-1">Organización</p>
                    <p className="text-base font-semibold">{data.organizacion || data.nombre_comercial}</p>
                  </div>
                  <Field label="RFC" value={data.rfc} />
                  <Field label="Registro STPS" value={data.org_estado} />
                  <Field label="Folio" value={data.folio} />
                  <Field label="Ciudad" value={data.org_ciudad} />
                </div>
              </div>

              {/* Hash del documento */}
              {data.pdf_hash && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Hash del documento
                  </p>
                  <div className="bg-gray-50 rounded-xl p-4 flex items-start gap-2">
                    <Hash className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <p className="text-xs font-mono break-all text-muted-foreground">{data.pdf_hash}</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    El hash SHA-256 garantiza que el documento no ha sido alterado.
                  </p>
                </div>
              )}

              {data.fecha_emision && (
                <Field label="Fecha de emisión" value={fmtFecha(data.fecha_emision)} />
              )}
            </div>
          ) : (
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-1">Código de validación</p>
              <p className="font-mono text-sm break-all">{data.codigo_validacion}</p>
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <QrCode className="h-3.5 w-3.5" />
              <span>{data.verificaciones_count} verificación{data.verificaciones_count !== 1 ? "es" : ""}</span>
            </div>
            <span>Powered by AACES</span>
          </div>
        </div>
      </div>
    </div>
  )
}
