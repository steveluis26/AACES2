'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Pie,
  PieChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Badge } from '@/components/ui/badge'
import { Alert } from '@/components/ui'
import { Button } from '@/components/ui'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'

type PlatformMetrics = {
  mrr: number
  organizaciones: {
    total: number
    activas: number
    pendientes: number
    por_estatus: { estatus: string; cantidad: number }[]
    nuevas_por_mes: { mes: string; cantidad: number }[]
    pendientes_activacion: { id: string; razon_social: string; rfc: string; fecha_creacion: string | null }[]
  }
  suscripciones: {
    activas: number
    por_estatus: { estatus: string; cantidad: number }[]
    por_plan: { plan: string; cantidad: number; mrr: number }[]
    por_vencer_30d: number
  }
  constancias: {
    total: number
    ultimos_30d: number
    por_mes: { mes: string; cantidad: number }[]
  }
  verificaciones_30d: { total: number; validas: number; tasa_exito: number }
  usuarios_organizaciones: number
}

type CiudadRow = { ciudad: string; total: number; activas: number }

const COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2']
const ESTATUS_LABEL: Record<string, string> = {
  pendiente: 'Pendiente',
  activa: 'Activa',
  suspendida: 'Suspendida',
  cancelada: 'Cancelada',
  expirada: 'Expirada',
}

const fmtMoney = (v: number) =>
  `$${Number(v || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null)
  const [ciudades, setCiudades] = useState<CiudadRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const token = typeof window !== 'undefined' ? localStorage.getItem('aaces_token') : null

  useEffect(() => {
    let cancelled = false
    const fetchData = async () => {
      setLoading(true)
      setError('')
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (token) headers['Authorization'] = `Bearer ${token}`
        const m = await fetch(`/api/v1/admin/dashboard/metrics`, { headers })
        if (!m.ok) throw new Error(`No se pudieron cargar las métricas de la plataforma (${m.status})`)
        const mjson = await m.json()
        if (!cancelled) setMetrics(mjson)
        const c = await fetch(`/api/v1/admin/dashboard/ciudad`, { headers })
        if (c.ok) {
          const cjson = await c.json()
          if (!cancelled) setCiudades(cjson.data ?? [])
        }
      } catch (e) {
        if (!cancelled) {
          setMetrics(null)
          setCiudades([])
          setError((e as Error)?.message || 'No se pudieron cargar las métricas de la plataforma')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchData()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const kpis = useMemo(() => {
    if (!metrics) return []
    return [
      { label: 'MRR', value: fmtMoney(metrics.mrr), color: 'text-green-600' },
      { label: 'Organizaciones activas', value: metrics.organizaciones.activas, color: 'text-blue-600' },
      { label: 'Suscripciones activas', value: metrics.suscripciones.activas, color: 'text-indigo-600' },
      { label: 'Constancias emitidas', value: metrics.constancias.total, color: 'text-emerald-600' },
      { label: 'Verificaciones (30d)', value: metrics.verificaciones_30d.total, color: 'text-amber-600' },
      { label: 'Usuarios de orgs', value: metrics.usuarios_organizaciones, color: 'text-purple-600' },
    ]
  }, [metrics])

  const estatusChart = useMemo(
    () =>
      (metrics?.organizaciones.por_estatus ?? []).map((e) => ({
        name: ESTATUS_LABEL[e.estatus] ?? e.estatus,
        value: e.cantidad,
      })),
    [metrics]
  )

  const orgsMesChart = useMemo(
    () => (metrics?.organizaciones.nuevas_por_mes ?? []).map((r) => ({ mes: r.mes, Orgs: r.cantidad })),
    [metrics]
  )

  const constMesChart = useMemo(
    () => (metrics?.constancias.por_mes ?? []).map((r) => ({ mes: r.mes, Constancias: r.cantidad })),
    [metrics]
  )

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="mx-4 lg:mx-6">
        <h1 className="text-2xl font-bold">Panel de plataforma</h1>
        <p className="text-sm text-muted-foreground">Métricas del negocio AACES (solo superadmin)</p>
      </div>

      {!loading && error && (
        <div className="mx-4 lg:mx-6">
          <Alert className="alert-error">
            <div className="flex items-center justify-between gap-3">
              <span>{error}</span>
              <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                Reintentar
              </Button>
            </div>
          </Alert>
        </div>
      )}

      {/* KPIs */}
      <div className="mx-4 lg:mx-6 grid-kpis">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-12 w-full" />
                </CardContent>
              </Card>
            ))
          : kpis.map((s) => (
              <Card key={s.label}>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className={`text-2xl font-semibold mt-1 ${s.color}`}>{s.value}</p>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Alertas accionables */}
      <div className="mx-4 lg:mx-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>
              Pendientes de activación{' '}
              {!loading && (metrics?.organizaciones.pendientes ?? 0) > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {metrics?.organizaciones.pendientes}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>Organizaciones esperando activación manual</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[160px] w-full" />
            ) : (metrics?.organizaciones.pendientes_activacion ?? []).length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">Sin pendientes</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Razón social</TableHead>
                    <TableHead>RFC</TableHead>
                    <TableHead>Registro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics?.organizaciones.pendientes_activacion.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium">{o.razon_social}</TableCell>
                      <TableCell>{o.rfc}</TableCell>
                      <TableCell>
                        {o.fecha_creacion ? new Date(o.fecha_creacion).toLocaleDateString('es-MX') : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Suscripciones</CardTitle>
            <CardDescription>
              Por vencer en 30 días: <strong>{loading ? '…' : metrics?.suscripciones.por_vencer_30d ?? 0}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[160px] w-full" />
            ) : (metrics?.suscripciones.por_plan ?? []).length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">Sin suscripciones activas</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plan</TableHead>
                    <TableHead>Cantidad</TableHead>
                    <TableHead className="text-right">MRR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics?.suscripciones.por_plan.map((p) => (
                    <TableRow key={p.plan}>
                      <TableCell className="font-medium">{p.plan}</TableCell>
                      <TableCell>{p.cantidad}</TableCell>
                      <TableCell className="text-right">{fmtMoney(p.mrr)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gráficas */}
      <div className="mx-4 lg:mx-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Organizaciones nuevas</CardTitle>
            <CardDescription>Últimos 6 meses</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[220px] w-full" />
            ) : orgsMesChart.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">Sin datos</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={orgsMesChart} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="orgGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="mes" className="text-xs" />
                  <YAxis className="text-xs" allowDecimals={false} />
                  <Tooltip />
                  <Area type="monotone" dataKey="Orgs" stroke="#2563eb" fill="url(#orgGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Constancias emitidas</CardTitle>
            <CardDescription>
              Últimos 6 meses · últimos 30d: <strong>{metrics?.constancias.ultimos_30d ?? 0}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[220px] w-full" />
            ) : constMesChart.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">Sin datos</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={constMesChart} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="constGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#16a34a" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#16a34a" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="mes" className="text-xs" />
                  <YAxis className="text-xs" allowDecimals={false} />
                  <Tooltip />
                  <Area type="monotone" dataKey="Constancias" stroke="#16a34a" fill="url(#constGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Organizaciones por estatus</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : estatusChart.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">Sin datos</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={estatusChart} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                    {estatusChart.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Verificaciones públicas (30d)</CardTitle>
            <CardDescription>El corazón anti-fraude de AACES</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : (
              <div className="flex flex-col gap-3 py-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total verificaciones</span>
                  <span className="text-2xl font-semibold">{metrics?.verificaciones_30d.total ?? 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Válidas</span>
                  <span className="text-2xl font-semibold text-green-600">
                    {metrics?.verificaciones_30d.validas ?? 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Tasa de éxito</span>
                  <span className="text-2xl font-semibold text-blue-600">
                    {metrics?.verificaciones_30d.tasa_exito ?? 0}%
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Por ciudad */}
      <Card className="mx-4 lg:mx-6">
        <CardHeader>
          <CardTitle>Organizaciones por ciudad</CardTitle>
          <CardDescription>Ciudad normalizada (mayúsculas, acentos y espacios unificados)</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[160px] w-full" />
          ) : ciudades.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">Sin datos</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ciudad</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Activas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ciudades.slice(0, 15).map((c) => (
                  <TableRow key={c.ciudad}>
                    <TableCell className="font-medium">{c.ciudad}</TableCell>
                    <TableCell>{c.total}</TableCell>
                    <TableCell>{c.activas}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
