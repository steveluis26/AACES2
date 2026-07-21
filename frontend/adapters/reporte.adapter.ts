import { apiRequest } from "@/app/services/api"

export interface ReporteParams {
  fecha_inicio?: string
  fecha_fin?: string
  periodo?: "dia" | "semana" | "mes" | "anio"
}

function qs(p?: ReporteParams): string {
  const sp = new URLSearchParams()
  if (p?.fecha_inicio) sp.set("fecha_inicio", p.fecha_inicio)
  if (p?.fecha_fin) sp.set("fecha_fin", p.fecha_fin)
  if (p?.periodo) sp.set("periodo", p.periodo)
  const s = sp.toString()
  return s ? `?${s}` : ""
}

export const reporteService = {
  constanciasPorPeriodo: (p?: ReporteParams) =>
    apiRequest<any>(`/reportes/constancias-por-periodo${qs(p)}`),
  cursosTop: (p?: ReporteParams) =>
    apiRequest<any>(`/reportes/cursos-top${qs(p)}`),
  documentosNoVerificados: () =>
    apiRequest<any>(`/reportes/documentos-no-verificados`),
  empresasTop: (p?: ReporteParams) =>
    apiRequest<any>(`/reportes/empresas-top${qs(p)}`),
  proximosAVencer: (p?: ReporteParams) =>
    apiRequest<any>(`/reportes/proximos-a-vencer${qs(p)}`),
  tiempoPromedioEmision: () =>
    apiRequest<any>(`/reportes/tiempo-promedio-emision`),
}
