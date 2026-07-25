// API helper aislado para la gestión REAL de cursos/participantes/constancias.
// NO usa lib/auth.ts (tiene un bug de cabecera). Cabeceras Bearer correctas.
// El backend corre en :8000; en dev next.config.js reenvía /api/:path* -> :8000.

const TOKEN_KEY = 'aaces_token'

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}
function setToken(t: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem(TOKEN_KEY, t)
}
export function getUser() {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem('aaces_user')
  return raw ? JSON.parse(raw) : null
}

type ApiOptions = { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown; auth?: boolean }
export async function api<T = any>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true } = opts
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (auth) {
    const t = getToken()
    if (t) headers['Authorization'] = `Bearer ${t}`
  }
  const res = await fetch(`/api/v1${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (res.status === 401 || res.status === 403) {
    if (typeof window !== 'undefined') { localStorage.removeItem(TOKEN_KEY); window.location.href = '/login' }
    throw new Error('Sesión expirada')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `Error ${res.status}` }))
    throw new Error(err.detail || `Error ${res.status}`)
  }
  const text = await res.text()
  return (text ? JSON.parse(text) : null) as T
}

// ── Auth ───────────────────────────────────────────────
export async function login(correo: string, password: string) {
  const data = await api<{ access_token: string }>('/auth/login', { method: 'POST', body: { correo, password }, auth: false })
  setToken(data.access_token)
  try {
    const parts = data.access_token.split('.')
    const payload = JSON.parse(typeof atob === 'function' ? atob(parts[1]) : Buffer.from(parts[1], 'base64').toString('utf-8'))
    if (typeof window !== 'undefined') localStorage.setItem('aaces_user', JSON.stringify({ id: payload.sub, nombre: payload.name, org: payload.org_name, role: payload.role }))
  } catch {}
  return data
}

// ── Cursos (capa /cursos del Core) ─────────────────────
export type Curso = {
  id: string
  nombre: string
  codigo_curso: string | null
  ciudad: string | null
  fecha_inicio: string | null
  fecha_fin: string | null
  duracion_horas: number | null
  modalidad: string | null
  estado: string | null
  empresa_contratante: string | null
}
export const cursosApi = {
  // Lista filtrada por la org del usuario (multitenancy) + búsqueda server-side.
  listar: (skip = 0, limit = 10, q = '') =>
    api<{ items: Curso[]; total: number; skip: number; limit: number }>(
      `/clientes/cursos?skip=${skip}&limit=${limit}${q ? `&search=${encodeURIComponent(q)}` : ''}`
    ),
  // Para búsqueda global: el backend filtra por org + search, así que traemos el máximo.
  listarTodos: (q = '') =>
    api<{ items: Curso[]; total: number; skip: number; limit: number }>(
      `/clientes/cursos?skip=0&limit=100${q ? `&search=${encodeURIComponent(q)}` : ''}`
    ),
  crear: (p: any) => api<any>('/cursos', { method: 'POST', body: p }),
  detalle: (id: string) => api<any>(`/cursos/${id}`),
}

// ── Participantes de un curso (capa /clientes/...) ─────
export type ParticipanteCurso = {
  id: string                 // == curso_participante_id
  participante_id: string
  nombre: string
  apellido: string | null
  correo: string
  ciudad_origen: string | null
  telefono: string | null
  empresa: string | null
  cargo: string | null
  profesion: string | null
  estado_pago: string | null
  estado_acreditacion: boolean
  codigo_validacion: string | null
  folio?: string | null
}
export const participantesApi = {
  // GET /clientes/cursos/{id}/participantes
  listar: (cursoId: string) => api<ParticipanteCurso[]>(`/clientes/cursos/${cursoId}/participantes`),
  // POST /cursos/{id}/participantes  (schema: nombre, correo, telefono?, empresa?, cargo?)
  agregar: (cursoId: string, p: any) =>
    api<{ id: string; participante_id: string; curso_participante_id: string }>(
      `/cursos/${cursoId}/participantes`, { method: 'POST', body: p }
    ),
  // PUT /participantes/{id}  (solo guarda: nombre, correo, telefono, empresa, cargo, ciudad_origen)
  actualizar: (participanteId: string, p: any) =>
    api<any>(`/participantes/${participanteId}`, { method: 'PUT', body: p }),
  // POST /participantes/{id}/acreditar
  acreditar: (participanteId: string, calificacion: number) =>
    api<any>(`/participantes/${participanteId}/acreditar`, { method: 'POST', body: { calificacion } }),
  // DELETE /clientes/cursos/{cursoId}/participantes/{cpId}
  eliminar: (cursoId: string, cpId: string) =>
    api<any>(`/clientes/cursos/${cursoId}/participantes/${cpId}`, { method: 'DELETE' }),
}

// ── Constancias ────────────────────────────────────────
export type ConstanciaEmitida = {
  id: string
  codigo_validacion: string
  folio: string
  descarga_url: string
  pdf_hash: string
  participante_nombre: string
  curso_nombre: string
}
export const constanciasApi = {
  emitir: (curso_participante_id: string) =>
    api<{ success: boolean; documento: ConstanciaEmitida }>('/constancias/emitir', {
      method: 'POST', body: { curso_participante_id },
    }),
}

export function pdfUrl(constanciaId: string): string {
  return `/api/v1/constancias/${constanciaId}/pdf`
}
