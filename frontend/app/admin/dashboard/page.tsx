'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'

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

const COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2']

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<MetricResponse | null>(null)
  const [ciudadData, setCiudadData] = useState<CiudadData[]>([])
  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState<'semana' | 'mes' | 'anio'>('mes')
  const token = typeof window !== 'undefined' ? localStorage.getItem('aaces_token') : null

  useEffect(() => {
    let cancelled = false
    const fetchData = async () => {
      setLoading(true)
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (token) headers['Authorization'] = `Bearer ${token}`
        const m = await fetch(`/api/v1/admin/dashboard/metrics`, { headers })
        const mjson = await m.json()
        if (!cancelled) setMetrics(mjson)
        const c = await fetch(`/api/v1/admin/dashboard/ciudad?periodo=${periodo}`, { headers })
        const cjson = await c.json()
        if (!cancelled) setCiudadData(cjson.data ?? [])
      } catch {
        if (!cancelled) {
          setMetrics(null)
          setCiudadData([])
        }
      } finally {
        if (!cancelled) setLoading(false)
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

  const stats = [
    { label: 'Clientes activos', value: metrics?.total_clientes ?? 0, color: 'text-blue-600' },
    { label: 'Ingresos totales', value: `$${(metrics?.ingresos_totales ?? ingresosTotales).toFixed(2)}`, color: 'text-green-600' },
    { label: 'Cursos activos', value: cursosActivos, color: 'text-amber-600' },
    { label: 'Participantes', value: metrics?.total_participantes ?? 0, color: 'text-purple-600' },
    { label: 'Certificados', value: metrics?.total_certificados ?? 0, color: 'text-emerald-600' },
    { label: 'Capacitadores', value: metrics?.total_capacitadores ?? 0, color: 'text-cyan-600' },
  ]

  const ingresosChart = useMemo(() => {
    return (metrics?.ingresos_por_mes ?? []).map(r => ({
      mes: r.mes,
      Ingresos: r.total,
      Pagos: r.cantidad,
    }))
  }, [metrics])

  const categoriaChart = useMemo(() => {
    return (metrics?.clientes_por_categoria ?? []).map(c => ({
      name: c.categoria,
      value: c.count,
    }))
  }, [metrics])

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      {/* Resumen de métricas */}
      <div className="mx-4 lg:mx-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}><CardContent className="p-4"><Skeleton className="h-12 w-full" /></CardContent></Card>
            ))
          : stats.map((s) => (
              <Card key={s.label}>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className={`text-2xl font-semibold mt-1 ${s.color}`}>{s.value}</p>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Ingresos por mes */}
      <Card className="mx-4 lg:mx-6">
        <CardHeader>
          <CardTitle>Ingresos por mes</CardTitle>
          <CardDescription>Últimos 6 meses (pagos completados)</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[260px] w-full" />
          ) : ingresosChart.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">Sin datos de ingresos</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={ingresosChart} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="ingGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="mes" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip formatter={(v: number) => `$${Number(v).toFixed(2)}`} />
                <Area type="monotone" dataKey="Ingresos" stroke="#2563eb" fill="url(#ingGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="mx-4 lg:mx-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Clientes por categoría */}
        <Card>
          <CardHeader>
            <CardTitle>Clientes por categoría</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : categoriaChart.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">Sin datos</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={categoriaChart} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                    {categoriaChart.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Validaciones y conversión */}
        <Card>
          <CardHeader>
            <CardTitle>Validaciones (últimos 30 días)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-3 rounded-lg bg-muted">
                    <p className="text-2xl font-semibold">{metrics?.validaciones_mes?.total ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted">
                    <p className="text-2xl font-semibold text-green-600">{metrics?.validaciones_mes?.exitosas ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Exitosas</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted">
                    <p className="text-2xl font-semibold text-red-600">{metrics?.validaciones_mes?.fallidas ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Fallidas</p>
                  </div>
                </div>
                <div className="text-sm">
                  Tasa de éxito: <Badge variant="secondary">{metrics?.validaciones_mes?.tasa_exito ?? 0}%</Badge>
                </div>
                <div className="text-sm">
                  Conversión pagos (30d): <Badge variant="secondary">{metrics?.pagos_conversion_30d?.tasa_conversion ?? 0}%</Badge>
                </div>
                <div className="text-sm">
                  Tasa acreditación global: <Badge variant="secondary">{metrics?.tasa_acreditacion_global ?? 0}%</Badge>
                </div>
                <div className="text-sm">
                  Certificados a vencer (30d): <Badge variant="destructive">{metrics?.certificados_proximos_vencer ?? 0}</Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Ciudad */}
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

      {/* Métricas por modalidad (ingresos) */}
      <Card className="mx-4 lg:mx-6">
        <CardHeader>
          <CardTitle>Ingresos por modalidad</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : (metrics?.ingresos_por_modalidad ?? []).length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">Sin datos</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart
                data={(metrics?.ingresos_por_modalidad ?? []).map(m => ({
                  modalidad: m.modalidad ?? 'Sin modalidad',
                  Ingresos: m.total,
                }))}
                margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="modalidad" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip formatter={(v: number) => `$${Number(v).toFixed(2)}`} />
                <Line type="monotone" dataKey="Ingresos" stroke="#16a34a" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Precios */}
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
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagos por estado */}
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
    </div>
  )
}
