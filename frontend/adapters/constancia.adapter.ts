import { apiRequest } from "@/app/services/api"
import {
  ConstanciaDetalleDTO,
  DocumentViewModel,
  mapConstanciaToDocumentViewModel,
  DocumentStatus,
  ConstanciaListParams,
  ConstanciaListResponseVM,
  mapConstanciaListResponse,
} from "@/viewmodels/document"

export async function fetchConstanciaDetalle(
  constanciaId: string
): Promise<DocumentViewModel> {
  const dto = await apiRequest<ConstanciaDetalleDTO>(
    `/constancias/${constanciaId}`
  )
  return mapConstanciaToDocumentViewModel(dto)
}

export async function cancelarConstancia(
  constanciaId: string
): Promise<void> {
  await apiRequest(`/documentos/${constanciaId}/cancelar`, {
    method: "PATCH",
  })
}

export function verificationUrl(codigo: string): string {
  const base =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://aaces.mx"
  return `${base}/v/${codigo}`
}

export function descargarPdf(pdfUrl: string): void {
  window.open(pdfUrl, "_blank")
}

function paramsToSearch(p: ConstanciaListParams): URLSearchParams {
  const sp = new URLSearchParams()
  if (p.q) sp.set("q", p.q)
  if (p.estado) sp.set("estado", p.estado)
  if (p.curso_id) sp.set("curso_id", p.curso_id)
  if (p.fecha_desde) sp.set("fecha_desde", p.fecha_desde)
  if (p.fecha_hasta) sp.set("fecha_hasta", p.fecha_hasta)
  if (p.verificada != null) sp.set("verificada", String(p.verificada))
  if (p.sort) sp.set("sort", p.sort)
  if (p.order) sp.set("order", p.order)
  if (p.page) sp.set("page", String(p.page))
  if (p.page_size) sp.set("page_size", String(p.page_size))
  return sp
}

export async function fetchConstanciasList(
  params: ConstanciaListParams
): Promise<ConstanciaListResponseVM> {
  const qs = paramsToSearch(params).toString()
  const data = await apiRequest<any>(`/constancias${qs ? "?" + qs : ""}`)
  return mapConstanciaListResponse(data)
}
