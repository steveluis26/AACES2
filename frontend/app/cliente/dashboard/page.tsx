"use client"

import { useEffect, useMemo, useState } from "react"
import { apiRequest } from "@/app/services/api"
import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { DataTable } from "@/components/data-table"
import { SectionCards } from "@/components/section-cards"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from "@/components/ui/table"

type Metrics = {
  cursos_total: number
  cursos_activos: number
  cursos_finalizados: number
  participantes_total: number
  acreditados: number
  validaciones: number
  pagos_recibidos: number
  pagos_pendientes: number
  precios?: { promedio_base: number; promedio_promocional: number; porcentaje_con_promocion: number }
  cursos_por_estado?: { estado: string; cantidad: number }[]
  pagos_conversion_30d?: { completados: number; fallidos: number; tasa_conversion: number }
  ingresos_estimados_proximos?: number
  participantes_promedio_por_curso?: number
  tasa_acreditacion?: number
  ingresos_por_modalidad?: { modalidad: string | null; total: number; cantidad: number }[]
}

type CursoRow = {
  id: string
  nombre: string
  ciudad: string
  estado: string
  participantes: unknown[]
}

export default function ClienteDashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [cursos, setCursos] = useState<CursoRow[]>([])
  const token = typeof window !== "undefined" ? localStorage.getItem("aaces_token") : null

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const mjson = await apiRequest<Metrics | { resumen?: Metrics }>(`/clientes/dashboard/metrics`)
        if (!cancelled) setMetrics((mjson as { resumen?: Metrics })?.resumen ?? (mjson as Metrics) ?? null)
        const cjson = await apiRequest<CursoRow[] | { data?: CursoRow[] }>(`/clientes/mis-cursos`)
        const cursosData = Array.isArray(cjson) ? (cjson as CursoRow[]) : Array.isArray((cjson as { data?: CursoRow[] })?.data) ? ((cjson as { data?: CursoRow[] }).data || []) : []
        if (!cancelled) setCursos(cursosData)
      } catch {
        if (!cancelled) {
          setMetrics(null)
          setCursos([])
        }
      }
    }
    run()
    return () => { cancelled = true }
  }, [token])

  const tableData = useMemo(() => {
    const list = Array.isArray(cursos) ? cursos : []
    return list.map((r, idx) => ({
      id: idx + 1,
      header: r.nombre,
      type: r.ciudad,
      status:
        r.estado === "finalizado" ? "Done" : r.estado === "activo" ? "In Process" : "Not Started",
      target: String(r.participantes?.length || 0),
      limit: "",
      reviewer: "Assign reviewer",
    }))
  }, [cursos])

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <SectionCards
        data={{
          pagos_recibidos: metrics?.pagos_recibidos,
          participantes_total: metrics?.participantes_total,
          cursos_activos: metrics?.cursos_activos,
          cursos_total: metrics?.cursos_total,
        }}
        labels={{ ingresos: 'Ingresos totales', clientes: 'Participantes', cuentas: 'Cursos activos', crecimiento: 'Tasa de crecimiento' }}
      />
      <div className="px-4 lg:px-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <Card className="md:col-span-2 xl:col-span-3">
          <CardHeader>
            <CardTitle>Actividad</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartAreaInteractive />
          </CardContent>
        </Card>

        <Card>
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

        <Card>
          <CardHeader>
            <CardTitle>Conversión de pagos (30 días)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell>Completados</TableCell>
                  <TableCell className="text-right">{metrics?.pagos_conversion_30d?.completados ?? 0}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Fallidos</TableCell>
                  <TableCell className="text-right">{metrics?.pagos_conversion_30d?.fallidos ?? 0}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Tasa de conversión</TableCell>
                  <TableCell className="text-right">{(metrics?.pagos_conversion_30d?.tasa_conversion ?? 0).toFixed(2)}%</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Proyecciones y acreditación</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell>Ingresos estimados próximos</TableCell>
                  <TableCell className="text-right">${(metrics?.ingresos_estimados_proximos ?? 0).toFixed(2)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Participantes promedio por curso</TableCell>
                  <TableCell className="text-right">{(metrics?.participantes_promedio_por_curso ?? 0).toFixed(2)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Tasa de acreditación</TableCell>
                  <TableCell className="text-right">{(metrics?.tasa_acreditacion ?? 0).toFixed(2)}%</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Ingresos por modalidad</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Modalidad</TableHead>
                  <TableHead>Pagos</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(metrics?.ingresos_por_modalidad ?? []).map((r, idx) => (
                  <TableRow key={`${r.modalidad}-${idx}`}>
                    <TableCell><Badge>{r.modalidad ?? "N/A"}</Badge></TableCell>
                    <TableCell>{r.cantidad}</TableCell>
                    <TableCell className="text-right">${r.total.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="xl:col-span-3 md:col-span-2">
          <CardHeader>
            <CardTitle>Mis cursos</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable data={tableData} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
