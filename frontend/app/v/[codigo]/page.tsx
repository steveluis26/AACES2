"use client"

import { useEffect, useState } from "react"
import { CheckCircle, XCircle, Shield, Loader2, QrCode } from "lucide-react"

interface ParticipanteData {
  nombre: string
}

interface CursoData {
  nombre: string
  fecha_inicio?: string | null
  fecha_fin?: string | null
  duracion_horas?: number
  calificacion?: number | null
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
  participante?: ParticipanteData | null
  curso?: CursoData | null
  verificaciones_count: number
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

  return (
    <div className="flex min-h-svh items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-lg">
        <div className={`rounded-2xl border-2 p-8 shadow-lg ${
          valida
            ? "border-green-200 bg-white"
            : "border-red-200 bg-white"
        }`}>
          <div className="text-center mb-6">
            <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
              valida ? "bg-green-100" : "bg-red-100"
            }`}>
              {valida
                ? <CheckCircle className="h-8 w-8 text-green-600" />
                : <XCircle className="h-8 w-8 text-red-600" />
              }
            </div>
            <h1 className={`text-2xl font-bold ${
              valida ? "text-green-800" : "text-red-800"
            }`}>
              Documento {valida ? "verificado" : "no válido"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {valida
                ? "Esta constancia fue emitida por una organización registrada en la plataforma AACES."
                : data.estatus === "cancelado"
                  ? "Este documento ha sido revocado por la organización emisora."
                  : "El código de verificación no corresponde a ningún documento emitido."
              }
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 mb-6 text-xs text-muted-foreground">
            <Shield className="h-3.5 w-3.5" />
            <span>Verificado mediante AACES</span>
          </div>

          {(isConstancia && data.participante && data.curso) ? (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs text-muted-foreground mb-1">Participante</p>
                <p className="text-lg font-semibold">{data.participante.nombre}</p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs text-muted-foreground mb-1">Curso</p>
                <p className="text-lg font-semibold">{data.curso.nombre}</p>
              </div>

              {data.organizacion && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-muted-foreground mb-1">Agencia capacitadora</p>
                  <p className="text-base font-semibold">{data.organizacion}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {data.fecha_emision && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-xs text-muted-foreground mb-1">Fecha de emisión</p>
                    <p className="text-sm font-semibold">
                      {new Date(data.fecha_emision).toLocaleDateString("es-ES", {
                        year: "numeric", month: "long", day: "numeric"
                      })}
                    </p>
                  </div>
                )}
                {data.curso.expiracion && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-xs text-muted-foreground mb-1">Vigencia</p>
                    <p className="text-sm font-semibold">
                      {new Date(data.curso.expiracion).toLocaleDateString("es-ES", {
                        year: "numeric", month: "long", day: "numeric"
                      })}
                    </p>
                  </div>
                )}
                {data.curso.duracion_horas ? (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-xs text-muted-foreground mb-1">Duración</p>
                    <p className="text-sm font-semibold">{data.curso.duracion_horas} horas</p>
                  </div>
                ) : null}
                {data.curso.calificacion != null ? (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-xs text-muted-foreground mb-1">Calificación</p>
                    <p className="text-sm font-semibold">{data.curso.calificacion}%</p>
                  </div>
                ) : null}
              </div>
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
