'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChartAreaInteractive } from '@/components/chart-area-interactive'
import { SectionCards } from '@/components/section-cards'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from '@/components/ui/table'

type MetricResponse = {
  total_clientes: number
  clientes_por_categoria: { categoria: string; count: number }[]
  total_cursos: number
  total_capacitadores: number
  total_participantes: number
  total_certificados: number
  ingresos_por_mes: { mes: string; total: number; cantidad: number }[]
  validaciones_mes: { total: number; exitosas: number; fallidas: number; tasa_exito: number }
  certificados_proximos_vencer: number
  ingresos_totales?: number
  ingresos_pendientes?: number
  precios?: { promedio_base: number; promedio_promocional: number; porcentaje_con_promocion: number }
  cursos_por_estado?: { estado: string; cantidad: number }[]
  pagos_por_estado?: { estado: string; cantidad: number; total: number }[]
  pagos_conversion_30d?: { completados: number; fallidos: number; tasa_conversion: number }
  ingresos_estimados_proximos?: number
  participantes_promedio_por_curso?: number
  tasa_acreditacion_global?: number
  ingresos_por_modalidad?: { modalidad: string | null; total: number; cantidad: number }[]
}

type CiudadData = { ciudad: string; periodo: string; total_monto: number; total_pagado: number; cantidad: number }

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<MetricResponse | null>(null)
  const [ciudadData, setCiudadData] = useState<CiudadData[]>([])
  const [clientesNuevos, setClientesNuevos] = useState<number>(0)
  const [periodo, setPeriodo] = useState<'semana' | 'mes' | 'anio'>('mes')
  const token = typeof window !== 'undefined' ? localStorage.getItem('aaces_token') : null

  useEffect(() => {
    let cancelled = false
    const fetchData = async () => {
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (token) headers['Authorization'] = `Bearer ${token}`
        const m = await fetch(`/api/v1/admin/dashboard/metrics`, { headers })
        const mjson = await m.json()
        if (!cancelled) setMetrics(mjson)
        const now = new Date()
        const mes = now.getMonth() + 1
        const anio = now.getFullYear()
        const rep = await fetch(`/api/v1/admin/reports/monthly?mes=${mes}&anio=${anio}`, { headers })
        const repjson = await rep.json()
        if (!cancelled) setClientesNuevos(Number(repjson?.clientes_nuevos ?? 0))
        const c = await fetch(`/api/v1/admin/dashboard/ciudad?periodo=${periodo}`, { headers })
        const cjson = await c.json()
        if (!cancelled) setCiudadData(cjson.data ?? [])
      } catch {
        if (!cancelled) {
          setMetrics(null)
          setCiudadData([])
        }
      }
    }
    fetchData()
    return () => {
      cancelled = true
    }
  }, [periodo, token])

  const ingresosTotales = useMemo(() => {
    return (metrics?.ingresos_por_mes ?? []).reduce((sum, r) => sum + r.total, 0)
  }, [metrics])

  const cursosActivos = useMemo(() => {
    return (metrics?.cursos_por_estado ?? []).find((e) => e.estado === 'activo')?.cantidad ?? 0
  }, [metrics])

  const cardsData = {
    pagos_recibidos: (metrics?.ingresos_totales ?? ingresosTotales),
    participantes_total: clientesNuevos,
    cursos_activos: cursosActivos,
    cursos_total: metrics?.total_cursos,
  }

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <SectionCards data={cardsData} labels={{ ingresos: 'Ingresos totales', clientes: 'Nuevos clientes', cuentas: 'Cursos activos', crecimiento: 'Tasa de crecimiento' }} />
      <div className="px-4 lg:px-6">
        <ChartAreaInteractive />
      </div>
      <Card className="mx-4 lg:mx-6">
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Estadísticas por ciudad</CardTitle>
          <div className="space-x-2">
            <Button variant={periodo === 'semana' ? 'default' : 'secondary'} onClick={() => setPeriodo('semana')}>Semana</Button>
            <Button variant={periodo === 'mes' ? 'default' : 'secondary'} onClick={() => setPeriodo('mes')}>Mes</Button>
            <Button variant={periodo === 'anio' ? 'default' : 'secondary'} onClick={() => setPeriodo('anio')}>Año</Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ciudad</TableHead>
                <TableHead>Pagos</TableHead>
                <TableHead className="text-right">Monto pagado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ciudadData.map((r) => (
                <TableRow key={`${r.ciudad}-${r.periodo}`}>
                  <TableCell><Badge>{r.ciudad}</Badge></TableCell>
                  <TableCell>{r.cantidad}</TableCell>
                  <TableCell className="text-right">${r.total_pagado.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mx-4 lg:mx-6">
        <CardHeader>
          <CardTitle>Métricas de precios</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableBody>
              <TableRow>
                <TableCell>Precio promedio (base)</TableCell>
                <TableCell className="text-right">${(metrics?.precios?.promedio_base ?? 0).toFixed(2)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Precio promedio (promocional)</TableCell>
                <TableCell className="text-right">${(metrics?.precios?.promedio_promocional ?? 0).toFixed(2)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>% cursos con promoción</TableCell>
                <TableCell className="text-right">{(metrics?.precios?.porcentaje_con_promocion ?? 0).toFixed(2)}%</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mx-4 lg:mx-6">
        <CardHeader>
          <CardTitle>Pagos por estado</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Estado</TableHead>
                <TableHead>Cantidad</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(metrics?.pagos_por_estado ?? []).map((r) => (
                <TableRow key={r.estado}>
                  <TableCell><Badge>{r.estado}</Badge></TableCell>
                  <TableCell>{r.cantidad}</TableCell>
                  <TableCell className="text-right">${r.total.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mx-4 lg:mx-6">
        <CardHeader>
          <CardTitle>Conversión y proyecciones</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableBody>
              <TableRow>
                <TableCell>Tasa conversión pagos (30d)</TableCell>
                <TableCell className="text-right">{(metrics?.pagos_conversion_30d?.tasa_conversion ?? 0).toFixed(2)}%</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Ingresos pendientes</TableCell>
                <TableCell className="text-right">${(metrics?.ingresos_pendientes ?? 0).toFixed(2)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Ingresos estimados próximos</TableCell>
                <TableCell className="text-right">${(metrics?.ingresos_estimados_proximos ?? 0).toFixed(2)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Participantes promedio por curso</TableCell>
                <TableCell className="text-right">{(metrics?.participantes_promedio_por_curso ?? 0).toFixed(2)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Tasa acreditación global</TableCell>
                <TableCell className="text-right">{(metrics?.tasa_acreditacion_global ?? 0).toFixed(2)}%</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
