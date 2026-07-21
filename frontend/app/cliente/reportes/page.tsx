"use client"

import React from "react"
import { useQuery } from "react-query"
import {
  Card, CardHeader, CardTitle, CardContent,
  Badge, Skeleton,
} from "@/components/ui"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { reporteService } from "@/adapters/reporte.adapter"
import { toast } from "sonner"
import {
  FileTextIcon, ShieldAlertIcon, CalendarClockIcon, ClockIcon,
} from "lucide-react"
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
  Line, LineChart,
} from "recharts"

type AnyRow = Record<string, any>

function useSafeQuery(key: string[], fn: () => Promise<any>) {
  return useQuery(key, fn, {
    retry: 1,
    onError: () => toast.error(`No se pudieron cargar los ${key[0]}`),
  })
}

export default function ReportesPage() {
  const constancias = useSafeQuery(
    ["reportes-constancias"],
    () => reporteService.constanciasPorPeriodo()
  )
  const cursosTop = useSafeQuery(
    ["reportes-cursos-top"],
    () => reporteService.cursosTop()
  )
  const noVerif = useSafeQuery(
    ["reportes-no-verif"],
    () => reporteService.documentosNoVerificados()
  )
  const empresas = useSafeQuery(
    ["reportes-empresas"],
    () => reporteService.empresasTop()
  )
  const proximos = useSafeQuery(
    ["reportes-proximos"],
    () => reporteService.proximosAVencer()
  )
  const tiempo = useSafeQuery(
    ["reportes-tiempo"],
    () => reporteService.tiempoPromedioEmision()
  )

  const asArray = (v: any): AnyRow[] => {
    if (Array.isArray(v)) return v
    if (v && Array.isArray(v.data)) return v.data
    if (v && Array.isArray(v.items)) return v.items
    if (v && Array.isArray(v.resultados)) return v.resultados
    return []
  }

  const toChart = (rows: AnyRow[], labelKey: string, valueKey: string) =>
    rows.map((r) => ({
      name: String(r[labelKey] ?? r.nombre ?? r.label ?? "—"),
      value: Number(r[valueKey] ?? r.total ?? r.valor ?? 0),
    }))

  const constanciasRows = asArray(constancias.data)
  const cursosRows = asArray(cursosTop.data)
  const empresasRows = asArray(empresas.data)
  const proximosRows = asArray(proximos.data)
  const tiempoPromedio =
    (tiempo.data && (tiempo.data.promedio_horas ?? tiempo.data.promedio_minutos ?? tiempo.data.tiempo_promedio)) || null
  const noVerifTotal =
    (noVerif.data && (noVerif.data.total ?? noVerif.data.cantidad ?? (Array.isArray(noVerif.data.data) ? noVerif.data.data.length : 0))) || 0

  const StatCard = ({
    title, value, icon: Icon, hint, loading,
  }: {
    title: string; value: string | number; icon: any; hint?: string; loading?: boolean
  }) => (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">
              {loading ? <Skeleton className="h-7 w-16" /> : value}
            </p>
            {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
          </div>
          <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div>
        <h1 className="text-2xl font-semibold">Reportes y Estadísticas</h1>
        <p className="text-sm text-muted-foreground">
          Indicadores de emisión de constancias, cursos y vigencia
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Constancias (período)"
          value={constanciasRows.reduce((a, r) => a + Number(r.total ?? r.value ?? 0), 0) || "—"}
          icon={FileTextIcon}
          loading={constancias.isLoading}
          hint="Emitidas en el rango"
        />
        <StatCard
          title="Doc. no verificados"
          value={noVerifTotal}
          icon={ShieldAlertIcon}
          loading={noVerif.isLoading}
          hint="Pendientes de validación"
        />
        <StatCard
          title="Tiempo promedio emisión"
          value={tiempoPromedio != null ? `${tiempoPromedio} ${typeof tiempoPromedio === "number" && tiempoPromedio < 100 ? "min" : "h"}` : "—"}
          icon={ClockIcon}
          loading={tiempo.isLoading}
        />
        <StatCard
          title="Por vencer"
          value={proximosRows.length || "—"}
          icon={CalendarClockIcon}
          loading={proximos.isLoading}
          hint="Próximos a expirar"
        />
      </div>

      <Tabs defaultValue="constancias" className="w-full">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="constancias">Constancias por período</TabsTrigger>
          <TabsTrigger value="cursos">Cursos top</TabsTrigger>
          <TabsTrigger value="empresas">Empresas top</TabsTrigger>
          <TabsTrigger value="proximos">Próximos a vencer</TabsTrigger>
        </TabsList>

        <TabsContent value="constancias">
          <Card>
            <CardHeader>
              <CardTitle>Emisión de constancias</CardTitle>
              <p className="text-sm text-muted-foreground">Distribución por período</p>
            </CardHeader>
            <CardContent>
              {constancias.isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : constanciasRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin datos.</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={toChart(constanciasRows, "periodo", "total")}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cursos">
          <Card>
            <CardHeader>
              <CardTitle>Cursos con más constancias</CardTitle>
            </CardHeader>
            <CardContent>
              {cursosTop.isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={toChart(cursosRows, "curso", "total")} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="name" width={140} />
                    <Tooltip />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="empresas">
          <Card>
            <CardHeader>
              <CardTitle>Empresas con más emisión</CardTitle>
            </CardHeader>
            <CardContent>
              {empresas.isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={toChart(empresasRows, "empresa", "total")}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="proximos">
          <Card>
            <CardHeader>
              <CardTitle>Constancias por vencer</CardTitle>
              <p className="text-sm text-muted-foreground">Vigencia próxima a expirar</p>
            </CardHeader>
            <CardContent>
              {proximos.isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : proximosRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin constancias por vencer.</p>
              ) : (
                <div className="divide-y">
                  {proximosRows.slice(0, 20).map((r, i) => (
                    <div key={i} className="flex items-center justify-between py-2">
                      <span className="text-sm font-medium">{r.participante ?? r.curso ?? r.nombre ?? "—"}</span>
                      <Badge variant="outline">{r.fecha_expiracion ?? r.expiracion ?? "—"}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
