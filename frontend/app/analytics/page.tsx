"use client"

import { useEffect, useMemo, useState } from "react"
import { SectionCards } from "@/components/section-cards"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Pie,
  PieChart,
  RadialBar,
  RadialBarChart,
  XAxis,
  YAxis,
} from "recharts"

type AdminMetrics = {
  mrr?: number
  organizaciones?: {
    total: number
    activas: number
    pendientes: number
    por_estatus: { estatus: string; cantidad: number }[]
    nuevas_por_mes: { mes: string; cantidad: number }[]
  }
  suscripciones?: {
    activas: number
    por_plan: { plan: string; cantidad: number; mrr: number }[]
    por_vencer_30d: number
  }
  constancias?: {
    total: number
    ultimos_30d: number
    por_mes: { mes: string; cantidad: number }[]
  }
  verificaciones_30d?: { total: number; validas: number; tasa_exito: number }
}

type ClienteMetrics = {
  resumen?: {
    cursos_total: number
    cursos_activos: number
    cursos_finalizados: number
    participantes_total: number
    acreditados: number
    validaciones: number
    pagos_recibidos: number
    pagos_pendientes: number
  }
  ingresos_mes?: { mes: string; total: number; cantidad: number }[]
  por_ciudad?: { ciudad: string; total: number; cantidad: number }[]
  precios?: { promedio_base: number; promedio_promocional: number; porcentaje_con_promocion: number }
  cursos_por_estado?: { estado: string; cantidad: number }[]
  pagos_conversion_30d?: { completados: number; fallidos: number; tasa_conversion: number }
  ingresos_estimados_proximos?: number
  participantes_promedio_por_curso?: number
  tasa_acreditacion?: number
  ingresos_por_modalidad?: { modalidad: string | null; total: number; cantidad: number }[]
}

export default function AnalyticsPage() {
  const [role, setRole] = useState<string | undefined>(undefined)
  const [adminMetrics, setAdminMetrics] = useState<AdminMetrics | null>(null)
  const [clienteMetrics, setClienteMetrics] = useState<ClienteMetrics | null>(null)

  const token = typeof window !== "undefined" ? localStorage.getItem("aaces_token") : null

  useEffect(() => {
    const r = (() => {
      try {
        const raw = typeof window !== "undefined" ? localStorage.getItem("aaces_user") : null
        if (!raw) return undefined
        const u = JSON.parse(raw)
        return (u.rol || u.role) as string | undefined
      } catch {
        return undefined
      }
    })()
    setRole(r)
  }, [])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" }
        if (token) headers["Authorization"] = `Bearer ${token}`
        if (role === "admin") {
          const m = await fetch(`/api/v1/admin/dashboard/metrics`, { headers })
          const mjson = await m.json()
          if (!cancelled) setAdminMetrics(mjson)
        } else {
          const m = await fetch(`/api/v1/clientes/dashboard/metrics`, { headers })
          const mjson = await m.json()
          if (!cancelled) setClienteMetrics(mjson ?? null)
        }
      } catch {
        if (!cancelled) {
          setAdminMetrics(null)
          setClienteMetrics(null)
        }
      }
    }
    run()
    return () => { cancelled = true }
  }, [role, token])

  const cardsData = useMemo(() => {
    if (role === "admin") {
      return {
        pagos_recibidos: adminMetrics?.mrr,
        participantes_total: adminMetrics?.organizaciones?.activas,
        cursos_activos: adminMetrics?.suscripciones?.activas,
        cursos_total: adminMetrics?.organizaciones?.total,
      }
    }
    const r = clienteMetrics?.resumen
    return {
      pagos_recibidos: r?.pagos_recibidos,
      participantes_total: r?.participantes_total,
      cursos_activos: r?.cursos_activos,
      cursos_total: r?.cursos_total,
    }
  }, [role, adminMetrics, clienteMetrics])

  const ingresosPorMes = useMemo(() => {
    if (role === "admin") {
      return (adminMetrics?.constancias?.por_mes ?? []).map((r) => ({
        mes: r.mes,
        total: r.cantidad,
        cantidad: r.cantidad,
      }))
    }
    return (clienteMetrics?.ingresos_mes ?? []).map((r) => ({
      mes: r.mes,
      total: r.total,
      cantidad: r.cantidad,
    }))
  }, [role, adminMetrics, clienteMetrics])

  const cursosPorEstado = useMemo(() => {
    if (role === "admin") {
      return (adminMetrics?.organizaciones?.por_estatus ?? []).map((r) => ({ estado: r.estatus, cantidad: r.cantidad }))
    }
    return (clienteMetrics?.cursos_por_estado ?? []).map((r) => ({ estado: r.estado, cantidad: r.cantidad }))
  }, [role, adminMetrics, clienteMetrics])

  const ingresosPorModalidad = useMemo(() => {
    if (role === "admin") {
      return (adminMetrics?.suscripciones?.por_plan ?? []).map((r) => ({
        modalidad: r.plan,
        total: r.mrr,
        cantidad: r.cantidad,
      }))
    }
    const data = clienteMetrics?.ingresos_por_modalidad ?? []
    return data.map((r) => ({ modalidad: r.modalidad ?? "N/A", total: r.total, cantidad: r.cantidad }))
  }, [role, adminMetrics, clienteMetrics])

  const tasaConversion = useMemo(() => {
    if (role === "admin") {
      const t = adminMetrics?.verificaciones_30d?.tasa_exito
      return typeof t === "number" ? t : 0
    }
    const t = clienteMetrics?.pagos_conversion_30d?.tasa_conversion
    return typeof t === "number" ? t : 0
  }, [role, adminMetrics, clienteMetrics])

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <SectionCards
        data={cardsData}
        labels={
          role === "admin"
            ? { ingresos: 'MRR', clientes: 'Organizaciones activas', cuentas: 'Suscripciones activas', crecimiento: '% orgs activas' }
            : undefined
        }
      />

      <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-2 lg:px-6">
        <Card className="@container/card">
          <CardHeader>
            <CardTitle>{role === "admin" ? "Constancias por mes" : "Ingresos por mes"}</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
            <ChartContainer
              config={{
                total: { label: "Total", color: "var(--chart-1)" },
                cantidad: { label: "Pagos", color: "var(--chart-2)" },
              }}
              className="aspect-auto h-[260px] w-full"
            >
              <BarChart data={ingresosPorMes}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ccc" />
                <XAxis dataKey="mes" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="total" fill="var(--color-total)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="@container/card">
          <CardHeader>
            <CardTitle>{role === "admin" ? "Organizaciones por estatus" : "Distribución de cursos por estado"}</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
            <ChartContainer
              config={{
                activo: { label: "Activos", color: "var(--chart-3)" },
                finalizado: { label: "Finalizados", color: "var(--chart-4)" },
                suspendido: { label: "Suspendidos", color: "var(--chart-5)" },
              }}
              className="aspect-auto h-[260px] w-full"
            >
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent />} />
                <Pie
                  data={cursosPorEstado}
                  dataKey="cantidad"
                  nameKey="estado"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  innerRadius={50}
                  label
                />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="@container/card">
          <CardHeader>
            <CardTitle>{role === "admin" ? "MRR por plan" : "Ingresos por modalidad"}</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
            <ChartContainer
              config={{
                total: { label: "Total", color: "var(--chart-1)" },
              }}
              className="aspect-auto h-[260px] w-full"
            >
              <BarChart data={ingresosPorModalidad}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ccc" />
                <XAxis dataKey="modalidad" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="total" fill="var(--color-total)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="@container/card">
          <CardHeader>
            <CardTitle>{role === "admin" ? "Tasa de éxito de validaciones" : "Tasa de conversión de pagos"}</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
            <ChartContainer
              config={{
                tasa: { label: "Tasa", color: "var(--chart-6)" },
              }}
              className="aspect-auto h-[260px] w-full"
            >
              <RadialBarChart
                data={[{ name: "tasa", value: Math.max(0, Math.min(100, tasaConversion)) }]}
                innerRadius={60}
                outerRadius={100}
                startAngle={180}
                endAngle={0}
              >
                <RadialBar dataKey="value" cornerRadius={10} fill="var(--color-tasa)" />
                <ChartTooltip content={<ChartTooltipContent />} />
              </RadialBarChart>
            </ChartContainer>
            <div className="mt-2 text-center text-sm">{tasaConversion.toFixed(2)}%</div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
