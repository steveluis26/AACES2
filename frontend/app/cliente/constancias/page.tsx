"use client"

import React, { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { fetchConstanciasList, fetchConstanciaDetalle } from "@/adapters/constancia.adapter"
import {
  ConstanciaResumenVM,
  ConstanciaListResponseVM,
  ConstanciaSortField,
  OrderDirection,
  mapConstanciaListResponse,
} from "@/viewmodels/document"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { SearchBar } from "@/components/documentos/SearchBar"
import { FilterBar } from "@/components/documentos/FilterBar"
import { SortSelect } from "@/components/documentos/SortSelect"
import { Pagination } from "@/components/documentos/Pagination"
import { DataTable } from "@/components/documentos/DataTable"

export default function ConstanciasPage() {
  const router = useRouter()
  const [data, setData] = useState<ConstanciaListResponseVM | null>(null)
  const [loading, setLoading] = useState(true)

  const [q, setQ] = useState("")
  const [estado, setEstado] = useState("")
  const [verificada, setVerificada] = useState("")
  const [fechaDesde, setFechaDesde] = useState("")
  const [fechaHasta, setFechaHasta] = useState("")
  const [sort, setSort] = useState<ConstanciaSortField>("fecha_emision")
  const [order, setOrder] = useState<OrderDirection>("desc")
  const [page, setPage] = useState(1)

  const buildParams = useCallback(() => ({
    q: q || undefined,
    estado: (estado as any) || undefined,
    verificada: verificada ? verificada === "true" : undefined,
    fecha_desde: fechaDesde || undefined,
    fecha_hasta: fechaHasta || undefined,
    sort,
    order,
    page,
    page_size: 25,
  }), [q, estado, verificada, fechaDesde, fechaHasta, sort, order, page])

  useEffect(() => {
    setPage(1)
  }, [q, estado, verificada, fechaDesde, fechaHasta, sort, order])

  useEffect(() => {
    setLoading(true)
    fetchConstanciasList(buildParams())
      .then(setData)
      .catch(() => toast.error("Error al cargar constancias"))
      .finally(() => setLoading(false))
  }, [buildParams])

  const handleView = useCallback(
    (id: string) => router.push(`/cliente/constancias/${id}`),
    [router]
  )

  const handleDownload = useCallback(async (id: string) => {
    try {
      const detalle = await fetchConstanciaDetalle(id)
      if (detalle.pdfUrl) {
        window.open(detalle.pdfUrl, "_blank")
      }
    } catch {
      toast.error("Error al descargar")
    }
  }, [])

  const items = data?.items ?? []
  const pagination = data?.pagination

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div>
        <h1 className="text-2xl font-semibold">Centro de Constancias</h1>
        <p className="text-sm text-muted-foreground">
          Busca, filtra y gestiona todas las constancias emitidas
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchBar value={q} onChange={setQ} />
        <SortSelect
          sort={sort}
          order={order}
          onChangeSort={setSort}
          onChangeOrder={setOrder}
        />
      </div>

      <FilterBar
        estado={estado}
        onChangeEstado={setEstado}
        verificada={verificada}
        onChangeVerificada={setVerificada}
        fechaDesde={fechaDesde}
        onChangeFechaDesde={setFechaDesde}
        fechaHasta={fechaHasta}
        onChangeFechaHasta={setFechaHasta}
      />

      {data && data.meta.filters_applied > 0 && (
        <p className="text-xs text-muted-foreground">
          Consulta completada en {data.meta.query_time_ms}ms
          {data.meta.filters_applied > 0 &&
            ` · ${data.meta.filters_applied} filtro${data.meta.filters_applied !== 1 ? "s" : ""} aplicado${data.meta.filters_applied !== 1 ? "s" : ""}`}
        </p>
      )}

      <DataTable
        items={items}
        loading={loading}
        onView={handleView}
        onDownload={handleDownload}
      />

      {pagination && (
        <Pagination
          page={pagination.page}
          totalPages={pagination.total_pages}
          total={pagination.total}
          onChange={setPage}
        />
      )}
    </div>
  )
}
