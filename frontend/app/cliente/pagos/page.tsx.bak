"use client"
import { useEffect, useMemo, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent, Button } from '@/components/ui'
import { apiRequest } from '@/app/services/api'

type PlanKey = 'mes' | 'seis_meses' | 'anio'

export default function ClientePagosPage() {
  const [vigenciaDesde, setVigenciaDesde] = useState<string | null>(null)
  const [vigenciaHasta, setVigenciaHasta] = useState<string | null>(null)
  const search = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const qp = search ? search.get('status') : null
  const msg = useMemo(() => {
    if (!qp) return null
    if (qp === 'success') return 'Pago aprobado. Tu vigencia ha sido actualizada.'
    if (qp === 'pending') return 'Pago pendiente. Se actualizará al aprobarse.'
    if (qp === 'failure') return 'Pago fallido o cancelado.'
    return null
  }, [qp])

  const plans: Array<{ key: PlanKey; title: string; months: number; price: number }> = [
    { key: 'mes', title: '1 mes', months: 1, price: 0 },
    { key: 'seis_meses', title: '6 meses', months: 6, price: 0 },
    { key: 'anio', title: '1 año', months: 12, price: 0 },
  ]

  const pagar = async (plan: PlanKey) => {
    try {
      const res = await apiRequest<{ init_point?: string; sandbox_init_point?: string }>(`/clientes/servicio/mercadopago/preference`, { method: 'POST', body: JSON.stringify({ plan }) })
      const url = String((res?.init_point || res?.sandbox_init_point || ''))
      if (!url) { alert('No se pudo crear el enlace de pago'); return }
      if (typeof window !== 'undefined') window.open(url, '_blank')
    } catch (e) {
      alert((e as Error)?.message || 'No se pudo iniciar el pago')
    }
  }

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const me = await apiRequest<any>('/auth/me')
        setVigenciaDesde(me?.vigencia_desde || null)
        setVigenciaHasta(me?.vigencia_hasta || null)
      } catch {}
    }
    loadProfile()
  }, [])

  return (
    <div className="space-y-6 px-4 lg:px-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Pagos</h1>
      </div>
      {msg && <div className="text-sm">{msg}</div>}
      {(vigenciaDesde || vigenciaHasta) && (
        <div className="rounded border p-3 text-sm">
          <div className="font-semibold mb-1">Tu vigencia actual</div>
          {vigenciaDesde && <div>Desde: {new Date(vigenciaDesde).toLocaleDateString()}</div>}
          {vigenciaHasta && <div>Hasta: {new Date(vigenciaHasta).toLocaleDateString()}</div>}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map(p => (
          <Card key={p.key}>
            <CardHeader>
              <CardTitle>{p.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>Vigencia: {p.months} {p.months === 1 ? 'mes' : 'meses'}</div>
                <div>Precio: ${p.price} MXN</div>
                <Button onClick={() => pagar(p.key)}>Pagar</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
