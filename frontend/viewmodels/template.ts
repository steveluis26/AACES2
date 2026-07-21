// Tipos y mapeos (DTO -> VM) para la gestión de plantillas de constancias.
// Sigue el mismo estilo que viewmodels/document.ts (DTO en snake_case -> VM en camelCase).

export type TemplateTipoDocumento =
  | "CONSTANCIA"
  | "DC3"
  | "DIPLOMA"
  | "CREDENCIAL"
  | "OTRO"

export interface TemplateRecursos {
  logo_url?: string | null
  firma1_url?: string | null
  firma2_url?: string | null
  fondo_url?: string | null
  sello_url?: string | null
  [key: string]: string | null | undefined
}

// DTO tal cual lo devuelve el backend al crear/editar una plantilla.
export interface TemplateDTO {
  tipo_documento: TemplateTipoDocumento
  nombre: string
  recursos: TemplateRecursos
  config: Record<string, unknown>
  html_template: string
  id: string
  organizacion_id: string
  template_group_id: string
  version: number
  activa: boolean
  fecha_creacion: string
  creada_por: string | null
}

// View Model de una plantilla (nombres en camelCase).
export interface TemplateDetalleVM {
  id: string
  organizacionId: string
  templateGroupId: string
  tipoDocumento: TemplateTipoDocumento
  nombre: string
  version: number
  activa: boolean
  recursos: TemplateRecursos
  config: Record<string, unknown>
  htmlTemplate: string
  fechaCreacion: string
  creadaPor: string | null
}

// View Model de una versión (para la sección de historial).
export interface TemplateVersionVM {
  id: string
  version: number
  nombre: string
  tipoDocumento: string
  activa: boolean
  creadaPor: string | null
  fechaCreacion: string
}

export function mapTemplateDTO(dto: TemplateDTO): TemplateDetalleVM {
  return {
    id: dto.id,
    organizacionId: dto.organizacion_id,
    templateGroupId: dto.template_group_id,
    tipoDocumento: dto.tipo_documento,
    nombre: dto.nombre,
    version: dto.version,
    activa: dto.activa,
    recursos: dto.recursos ?? {},
    config: dto.config ?? {},
    htmlTemplate: dto.html_template,
    fechaCreacion: dto.fecha_creacion,
    creadaPor: dto.creada_por ?? null,
  }
}

export function mapTemplateVersiones(dtos: TemplateDTO[]): TemplateVersionVM[] {
  return (dtos ?? []).map((d) => ({
    id: d.id,
    version: d.version,
    nombre: d.nombre,
    tipoDocumento: d.tipo_documento,
    activa: d.activa,
    creadaPor: d.creada_por ?? null,
    fechaCreacion: d.fecha_creacion,
  }))
}

// Payload para crear o actualizar una plantilla.
export interface TemplateUpsertPayload {
  tipo_documento?: TemplateTipoDocumento
  nombre: string
  html_template?: string
  recursos?: TemplateRecursos
  config?: Record<string, unknown>
}
