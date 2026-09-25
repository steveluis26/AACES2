'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent, Button } from '@/components/ui'
import { Badge } from '@/components/ui/badge'
import { apiRequest } from '@/app/services/api'

type Notificacion = {
  id: string
  tipo: string
  titulo: string
  mensaje: string
  dias_restantes: number | null
  leida: boolean
  email_estado: string
  fecha_creacion: string | null
}

const TIPO_LABEL: Record<string, string> = {
  constancia_por_vencer: 'Constancia por vencer',
  curso_proximo: 'Curso próximo',
  suscripcion_por_vencer: 'Suscripción',
  pago_fallido: 'Pago fallido',
  curso_sin_participantes: 'Sin participantes',
  cupo_constancias: 'Límite de constancias',
}

const TIPO_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  constancia_por_vencer: 'secondary',
  curso_proximo: 'default',
  suscripcion_por_vencer: 'secondary',
  pago_fallido: 'destructive',
  curso_sin_participantes: 'outline',
  cupo_constancias: 'destructive',
}

export default function NotificacionesPage() {
  const [items, setItems] = useState<Notificacion[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiRequest<Notificacion[]>('/notificaciones')
      setItems(Array.isArray(data) ? data : [])
    } catch { setItems([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const marcarLeida = async (id: string) => {
    try {
      await apiRequest(`/notificaciones/${id}/leer`, { method: 'PATCH' })
      setItems(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n))
    } catch { /* noop */ }
  }

  const noLeidas = items.filter(n => !n.leida).length

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notificaciones</h1>
          <p className="text-sm text-muted-foreground">
            Recordatorios generados automáticamente para tu organización
            {noLeidas > 0 && ` · ${noLeidas} sin leer`}
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          {loading ? 'Cargando…' : 'Actualizar'}
        </Button>
      </div>

      {items.length === 0 && !loading && (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">
          No tienes notificaciones. Los recordatorios aparecerán aquí cada mañana.
        </CardContent></Card>
      )}

      <div className="grid-cards">
        {items.map(n => (
          <Card key={n.id} className={n.leida ? 'opacity-70' : ''}>
            <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
              <CardTitle className="min-w-0 flex-1 truncate text-base leading-snug">{n.titulo}</CardTitle>
              <Badge variant={TIPO_VARIANT[n.tipo] ?? 'outline'} className="shrink-0">
                {TIPO_LABEL[n.tipo] ?? n.tipo}
              </Badge>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">{n.mensaje}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {n.fecha_creacion ? new Date(n.fecha_creacion).toLocaleString('es-MX') : ''}
                  {n.email_estado === 'enviado' ? ' · también enviado por correo' : ''}
                </span>
                {!n.leida && (
                  <Button size="sm" variant="ghost" onClick={() => marcarLeida(n.id)}>
                    Marcar leída
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
