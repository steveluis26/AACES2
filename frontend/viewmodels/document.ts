export type DocumentStatus = "emitido" | "cancelado" | "reemitido"
export type VerificationResult = "VALIDA" | "REVOCADA" | "EXPIRADA" | "NO_EXISTE"
export type TimelineEventType = "emitida" | "verificada" | "cancelada" | "reemitida"
export type ConstanciaSortField = "fecha_emision" | "participante" | "curso" | "estado"
export type OrderDirection = "asc" | "desc"

export enum DocumentTab {
  INFORMATION = "informacion",
  DOCUMENT = "documento",
  VERIFICATIONS = "verificaciones",
  TECHNICAL = "tecnico",
}

export interface DocumentCapabilities {
  cancelar: boolean
  reemitir: boolean
  descargar: boolean
  compartir: boolean
}

export interface ParticipanteVM {
  nombre: string
  correo?: string
  empresa?: string
  puesto?: string
}

export interface CursoVM {
  nombre: string
  codigo?: string
  fechaInicio?: string
  fechaFin?: string
  duracionHoras?: number
  modalidad?: string
  ciudad?: string
}

export interface OrganizacionVM {
  id: string
  nombre: string
  nombreComercial?: string
  logoUrl?: string
}

export interface ActivoDocumentalVM {
  pdfUrl: string
  hashSha256: string
  tipoDocumento: string
}

export interface TemplateVM {
  id?: string
  nombre: string
  version: number
}

export interface VerificacionVM {
  id: string
  fecha: string
  tipo: string
  resultado: VerificationResult
  ip?: string
}

export interface TimelineEventVM {
  id: string
  fecha: string
  tipo: TimelineEventType
  titulo: string
  descripcion?: string
  severity?: "info" | "success" | "warning" | "error"
  icon?: React.ReactNode
}

export interface DocumentViewModel {
  id: string
  tipoDocumento: string
  estado: DocumentStatus
  codigoValidacion: string
  folio?: string
  fechaEmision: string
  fechaExpiracion?: string
  participante: ParticipanteVM
  curso: CursoVM
  organizacion: OrganizacionVM
  activoDocumental: ActivoDocumentalVM
  template: TemplateVM
  verificaciones: {
    total: number
    ultimaFecha?: string
    ultimas: VerificacionVM[]
  }
  timeline: TimelineEventVM[]
  capabilities: DocumentCapabilities
}

const SEVERITY_MAP: Record<string, "info" | "success" | "warning" | "error"> = {
  emitida: "info",
  verificada: "success",
  cancelada: "error",
  reemitida: "warning",
}

export function buildCapabilities(estado: DocumentStatus): DocumentCapabilities {
  return {
    cancelar: estado === "emitido" || estado === "reemitido",
    reemitir: false,
    descargar: estado === "emitido" || estado === "reemitido",
    compartir: estado === "emitido" || estado === "reemitido",
  }
}

export interface ConstanciaDetalleDTO {
  id: string
  tipo_documento: string
  estado: string
  codigo_validacion: string
  folio?: string
  fecha_emision: string
  fecha_expiracion?: string
  participante: {
    nombre: string
    correo?: string
    empresa?: string
    puesto?: string
  }
  curso: {
    nombre: string
    codigo_curso?: string
    fecha_inicio?: string
    fecha_fin?: string
    duracion_horas?: number
    modalidad?: string
    ciudad?: string
  }
  organizacion: {
    id: string
    nombre: string
    nombre_comercial?: string
    logo_url?: string
  }
  activo_documental: {
    pdf_url: string
    hash_sha256: string
    tipo_documento: string
  }
  template: {
    id?: string
    nombre: string
    version: number
  }
  verificaciones: {
    total: number
    ultima_fecha?: string
    ultimas: Array<{
      id: string
      fecha: string
      tipo: string
      resultado: string
      ip?: string
    }>
  }
    timeline: Array<{
      fecha: string
      tipo: string
      titulo: string
      descripcion: string | null
    }>
    capabilities: {
      cancelar: boolean
      reemitir: boolean
      descargar: boolean
      compartir: boolean
    }
  }

export function mapConstanciaToDocumentViewModel(dto: ConstanciaDetalleDTO): DocumentViewModel {
  const estado = dto.estado as DocumentStatus
  return {
    id: dto.id,
    tipoDocumento: dto.tipo_documento,
    estado,
    codigoValidacion: dto.codigo_validacion,
    folio: dto.folio,
    fechaEmision: dto.fecha_emision,
    fechaExpiracion: dto.fecha_expiracion,
    participante: {
      nombre: dto.participante.nombre,
      correo: dto.participante.correo,
      empresa: dto.participante.empresa,
      puesto: dto.participante.puesto,
    },
    curso: {
      nombre: dto.curso.nombre,
      codigo: dto.curso.codigo_curso,
      fechaInicio: dto.curso.fecha_inicio,
      fechaFin: dto.curso.fecha_fin,
      duracionHoras: dto.curso.duracion_horas,
      modalidad: dto.curso.modalidad,
      ciudad: dto.curso.ciudad,
    },
    organizacion: {
      id: dto.organizacion.id,
      nombre: dto.organizacion.nombre,
      nombreComercial: dto.organizacion.nombre_comercial,
      logoUrl: dto.organizacion.logo_url,
    },
    activoDocumental: {
      pdfUrl: dto.activo_documental.pdf_url,
      hashSha256: dto.activo_documental.hash_sha256,
      tipoDocumento: dto.activo_documental.tipo_documento,
    },
    template: {
      id: dto.template.id,
      nombre: dto.template.nombre,
      version: dto.template.version,
    },
    verificaciones: {
      total: dto.verificaciones.total,
      ultimaFecha: dto.verificaciones.ultima_fecha,
      ultimas: dto.verificaciones.ultimas.map((v) => ({
        id: v.id,
        fecha: v.fecha,
        tipo: v.tipo,
        resultado: v.resultado as VerificationResult,
        ip: v.ip,
      })),
    },
    timeline: dto.timeline.map((e) => ({
      id: `${e.tipo}-${e.fecha}`,
      fecha: e.fecha,
      tipo: e.tipo as TimelineEventType,
      titulo: e.titulo,
      descripcion: e.descripcion,
      severity: SEVERITY_MAP[e.tipo] ?? "info",
    })),
    capabilities: dto.capabilities ?? buildCapabilities(estado),
  }
}

export interface ConstanciaResumenVM {
  id: string
  codigo_validacion: string
  estatus: DocumentStatus
  fecha_emision: string | null
  participante_nombre: string
  curso_nombre: string
  folio: string | null
  verificaciones_count: number
  capabilities: DocumentCapabilities
}

export interface PaginationInfoVM {
  page: number
  page_size: number
  total: number
  total_pages: number
}

export interface ConstanciaListParams {
  q?: string
  estado?: DocumentStatus
  curso_id?: string
  fecha_desde?: string
  fecha_hasta?: string
  verificada?: boolean
  sort?: ConstanciaSortField
  order?: OrderDirection
  page?: number
  page_size?: number
}

export interface ConstanciaListResponseVM {
  items: ConstanciaResumenVM[]
  pagination: PaginationInfoVM
  meta: { filters_applied: number; query_time_ms: number }
}

export function mapConstanciaResumen(src: any): ConstanciaResumenVM {
  return {
    id: src.id,
    codigo_validacion: src.codigo_validacion,
    estatus: src.estatus as DocumentStatus,
    fecha_emision: src.fecha_emision ?? null,
    participante_nombre: src.participante_nombre ?? "",
    curso_nombre: src.curso_nombre ?? "",
    folio: src.folio ?? null,
    verificaciones_count: src.verificaciones_count ?? 0,
    capabilities: src.capabilities ?? { cancelar: false, reemitir: false, descargar: false, compartir: false },
  }
}

export function mapConstanciaListResponse(src: any): ConstanciaListResponseVM {
  return {
    items: (src.items ?? []).map(mapConstanciaResumen),
    pagination: src.pagination ?? { page: 1, page_size: 25, total: 0, total_pages: 1 },
    meta: src.meta ?? { filters_applied: 0, query_time_ms: 0 },
  }
}
