// Adapter de plantillas: mapea las respuestas del backend (DTO) a View Models
// y centraliza las llamadas a la API. Sigue el patrón de constancia.adapter.ts.

import { apiRequest, templatesService } from "@/app/services/api"
import {
  TemplateDTO,
  TemplateDetalleVM,
  TemplateVersionVM,
  TemplateUpsertPayload,
  mapTemplateDTO,
  mapTemplateVersiones,
} from "@/viewmodels/template"

// Obtiene la plantilla activa (o la primera) de un grupo de plantillas.
export async function fetchTemplateGroup(
  groupId: string
): Promise<TemplateDetalleVM | null> {
  const all = (await templatesService.listar()) as TemplateDTO[]
  const group = (all ?? []).filter((t) => t.template_group_id === groupId)
  if (group.length === 0) return null
  const active = group.find((t) => t.activa) || group[0]
  return mapTemplateDTO(active)
}

// Lista las versiones de un grupo de plantillas.
export async function fetchTemplateVersiones(
  groupId: string
): Promise<TemplateVersionVM[]> {
  const dtos = (await templatesService.listarVersiones(groupId)) as TemplateDTO[]
  return mapTemplateVersiones(dtos)
}

// Obtiene una plantilla por su id.
export async function fetchTemplateById(
  id: string
): Promise<TemplateDetalleVM> {
  const dto = (await templatesService.obtener(id)) as TemplateDTO
  return mapTemplateDTO(dto)
}

// Actualiza nombre, html_template y recursos de una plantilla (PUT /templates/{id}).
export async function updateTemplate(
  id: string,
  payload: TemplateUpsertPayload
): Promise<TemplateDetalleVM> {
  const dto = await apiRequest<TemplateDTO>(`/templates/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  })
  return mapTemplateDTO(dto)
}

// Activa una versión de plantilla (PUT /templates/{id}/activar).
export async function activateTemplate(id: string): Promise<void> {
  await templatesService.activar(id)
}

// Crea una nueva versión dentro de un grupo (POST /templates/{group_id}/versiones).
export async function createTemplateVersion(
  groupId: string,
  payload: { nombre: string; html_template?: string }
): Promise<TemplateDetalleVM> {
  const dto = (await templatesService.crearVersion(groupId, payload)) as TemplateDTO
  return mapTemplateDTO(dto)
}

// Elimina una versión de plantilla (DELETE /templates/{id}).
export async function deleteTemplate(id: string): Promise<void> {
  await templatesService.eliminar(id)
}

export interface UploadRecursoResult {
  url: string
}

// Sube un recurso (logo, firma, etc.) vía multipart/form-data.
// El backend espera los campos: archivo, organizacion_id, tipo_recurso, nombre.
// Se usa fetch directo porque apiRequest fuerza Content-Type: application/json,
// lo cual es incompatible con FormData.
export async function uploadTemplateRecurso(params: {
  organizacionId: string
  archivo: File
  tipoRecurso: string
  nombre: string
}): Promise<UploadRecursoResult> {
  const token = getToken()
  const form = new FormData()
  form.append("archivo", params.archivo)
  form.append("organizacion_id", params.organizacionId)
  form.append("tipo_recurso", params.tipoRecurso)
  form.append("nombre", params.nombre)

  const res = await fetch("/api/v1/templates/upload", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err && (err as any).detail) || `Error ${res.status}`)
  }
  return (await res.json()) as UploadRecursoResult
}

function getToken(): string | null {
  if (typeof window === "undefined") return null
  for (const k of ["aaces_token", "token", "access_token"]) {
    const v = window.localStorage.getItem(k)
    if (v) return v
  }
  return null
}
