'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Badge } from '@/components/ui/badge'

type CursoPublico = {
  curso_nombre: string
  codigo_curso: string
  fecha_inicio: string | null
  fecha_fin: string | null
  duracion_horas: number | null
  modalidad: string | null
  ciudad: string | null
  fecha_inicio_vigencia: string | null
  fecha_expiracion: string | null
  estado_acreditacion: boolean
  estado_vigencia: string
}

type PerfilPublico = {
  nombre: string
  organizacion: string | null
  cursos: CursoPublico[]
  total_cursos: number
  vigentes: number
  por_vencer: number
  vencidos: number
}

const ESTADO_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; dot: string }> = {
  vigente: { label: 'Vigente', variant: 'default', dot: '🟢' },
  por_vencer: { label: 'Por vencer', variant: 'secondary', dot: '🟡' },
  vencido: { label: 'Vencido', variant: 'destructive', dot: '🔴' },
  sin_vigencia: { label: 'Sin vigencia', variant: 'outline', dot: '⚪' },
}

export default function PerfilPublicoPage() {
  const params = useParams()
  const paxId = params.pax_id as string
  const [p, setP] = useState<PerfilPublico | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch(`/api/v1/public/p/${encodeURIComponent(paxId)}`)
        if (!res.ok) { setError('Perfil no encontrado'); return }
        const data = await res.json()
        setP(data)
      } catch { setError('Error al cargar perfil') }
      finally { setLoading(false) }
    })()
  }, [paxId])

  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Cargando...</div>
  if (error || !p) return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-semibold">Perfil no encontrado</h1>
        <p className="text-muted-foreground">El código PAX ingresado no existe o no está disponible.</p>
      </div>
    </div>
  )

  const stats = [
    { label: 'Cursos', value: p.total_cursos },
    { label: 'Vigentes', value: p.vigentes, color: 'text-green-600' },
    { label: 'Por vencer', value: p.por_vencer, color: 'text-yellow-600' },
    { label: 'Vencidos', value: p.vencidos, color: 'text-red-600' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 dark:from-gray-950 dark:to-gray-900">
      <div className="max-w-2xl mx-auto px-4 py-12 space-y-8">
        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-3xl font-bold">{p.nombre}</h1>
          {p.organizacion && (
            <p className="text-lg text-muted-foreground">{p.organizacion}</p>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          {stats.map(s => (
            <div key={s.label} className="bg-white dark:bg-gray-800 rounded-xl p-4 text-center shadow-sm border">
              <div className={`text-2xl font-bold ${s.color || ''}`}>{s.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Cursos */}
        <div className="space-y-3">
          <h2 className="text-xl font-semibold">Capacitaciones</h2>
          {p.cursos.map((c, i) => {
            const badge = ESTADO_BADGE[c.estado_vigencia] || ESTADO_BADGE.sin_vigencia
            return (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>{badge.dot}</span>
                    <span className="font-medium">{c.curso_nombre}</span>
                  </div>
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                  <div>Código: {c.codigo_curso}</div>
                  <div>Duración: {c.duracion_horas ? `${c.duracion_horas}h` : '-'}</div>
                  <div>Fecha: {c.fecha_inicio?.slice(0, 10) || '-'} → {c.fecha_fin?.slice(0, 10) || '-'}</div>
                  <div>Ciudad: {c.ciudad || '-'}</div>
                  <div>Modalidad: {c.modalidad || '-'}</div>
                  <div>Vigencia hasta: {c.fecha_expiracion?.slice(0, 10) || 'Sin vigencia'}</div>
                  <div className="col-span-2">Acreditado: {c.estado_acreditacion ? 'Sí' : 'No'}</div>
                </div>
              </div>
            )
          })}
          {p.cursos.length === 0 && (
            <p className="text-center text-muted-foreground py-8">Sin capacitaciones registradas.</p>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground pt-8 border-t">
          Perfil verificado en AACES — {new Date().toLocaleDateString('es-MX')}
        </div>
      </div>
    </div>
  )
}
