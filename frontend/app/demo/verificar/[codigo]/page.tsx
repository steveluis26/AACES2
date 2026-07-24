'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle2, XCircle, ShieldCheck, Loader2, Hash, QrCode } from 'lucide-react'
import { verificarPublico, Verificacion } from '../../lib/api'

function fmt(iso?: string | null): string | null {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })
  } catch {
    return iso
  }
}

export default function DemoVerificarPage() {
  const params = useParams<{ codigo: string }>()
  const codigo = params.codigo
  const [data, setData] = useState<Verificacion | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const d = await verificarPublico(codigo)
        if (mounted) setData(d)
      } catch (e: any) {
        if (mounted) setError(e?.message || 'No se pudo verificar')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [codigo])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto" />
          <p className="text-sm text-muted-foreground">Verificando documento…</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full border-red-200">
          <CardContent className="p-8 text-center">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-red-800 mb-2">Documento no encontrado</h1>
            <p className="text-red-600 text-sm">{error || 'El código de verificación no existe.'}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const valida = data.valida

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="w-full max-w-lg">
        <div className={`rounded-2xl border-2 p-8 shadow-lg ${valida ? 'border-emerald-200 bg-white' : 'border-red-200 bg-white'}`}>
          <div className="text-center mb-6">
            <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${valida ? 'bg-emerald-100' : 'bg-red-100'}`}>
              {valida ? <CheckCircle2 className="h-8 w-8 text-emerald-600" /> : <XCircle className="h-8 w-8 text-red-600" />}
            </div>
            <h1 className={`text-2xl font-bold ${valida ? 'text-emerald-800' : 'text-red-800'}`}>
              {valida ? '✅ CONSTANCIA VÁLIDA' : 'Documento no válido'}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {valida
                ? 'Documento emitido por una organización registrada en AACES.'
                : 'El código no corresponde a ningún documento emitido.'}
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 mb-6 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Verificado mediante AACES</span>
          </div>

          {valida && (
            <div className="space-y-5">
              <Section title="Participante">
                <Field label="Nombre" value={data.participante} />
                <Field label="PAX" value={data.pax_id} />
              </Section>

              <Section title="Curso">
                <Field label="Nombre" value={data.curso} />
                <Field label="Ciudad" value={data.curso_ciudad} />
                <Field label="Inicio" value={fmt(data.curso_inicio)} />
                <Field label="Fin" value={fmt(data.curso_fin)} />
                <Field label="Calificación" value={data.calificacion != null ? `${data.calificacion}%` : null} />
                <Field label="Vigencia hasta" value={fmt(data.fecha_expiracion)} />
              </Section>

              <Section title="Capacitador">
                <Field label="Organización" value={data.organizacion} />
                <Field label="RFC" value={data.organizacion_rfc} />
                <Field label="Folio" value={data.folio} />
              </Section>

              {data.fecha_emision && <Field label="Fecha de emisión" value={fmt(data.fecha_emision)} />}
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-mono break-all">{data.codigo_validacion}</span>
            <span className="flex items-center gap-1"><QrCode className="h-3.5 w-3.5" /> Powered by AACES</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{title}</p>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div className="bg-slate-50 rounded-xl p-3">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-sm font-semibold break-words">{value}</p>
    </div>
  )
}
