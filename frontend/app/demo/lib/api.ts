// API helper aislado para el Demo Flow de AACES.
// NO usa lib/auth.ts (que tiene un bug de cabecera). Aquí las cabeceras
// Authorization son correctas: `Bearer <token>`.
//
// El backend corre en :8000. En dev, next.config.js tiene un rewrite
// /api/:path* -> http://127.0.0.1:8000/api/:path*, así que usamos rutas
// relativas /api/v1/... (el navegador habla con Next y Next reenvía a :8000).

const TOKEN_KEY = 'aaces_demo_token'

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(TOKEN_KEY)
}

export function getUser() {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem('aaces_demo_user')
  return raw ? JSON.parse(raw) : null
}

export function setUser(u: unknown) {
  if (typeof window === 'undefined') return
  localStorage.setItem('aaces_demo_user', JSON.stringify(u))
}

type ApiOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  auth?: boolean
}

export async function api<T = any>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true } = opts
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (auth) {
    const token = getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }
  const res = await fetch(`/api/v1${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (res.status === 401 || res.status === 403) {
    clearToken()
    if (typeof window !== 'undefined') window.location.href = '/demo'
    throw new Error('Sesión expirada o no autorizada')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `Error ${res.status}` }))
    throw new Error(err.detail || `Error ${res.status}`)
  }
  // 204 / vacío
  const text = await res.text()
  return (text ? JSON.parse(text) : null) as T
}

// ── Auth ───────────────────────────────────────────────
export async function login(correo: string, password: string) {
  const data = await api<{ access_token: string }>('/auth/login', {
    method: 'POST',
    body: { correo, password },
    auth: false,
  })
  setToken(data.access_token)
  try {
    const parts = data.access_token.split('.')
    const payload = JSON.parse(
      typeof atob === 'function'
        ? atob(parts[1])
        : Buffer.from(parts[1], 'base64').toString('utf-8')
    )
    setUser({
      id: payload.sub,
      nombre: payload.name,
      org: payload.org_name,
      org_id: payload.org_id,
      role: payload.role,
    })
  } catch {}
  return data
}

// ── Cursos ─────────────────────────────────────────────
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
  listar: () => api<Curso[]>('/cursos'),
  crear: (payload: any) => api<any>('/cursos', { method: 'POST', body: payload }),
  detalle: (id: string) => api<any>(`/cursos/${id}`),
}

// ── Participantes ──────────────────────────────────────
export type ParticipanteCurso = {
  id: string
  participante_id: string
  nombre: string
  correo: string
  telefono: string | null
  empresa: string | null
  cargo: string | null
  calificacion?: number | null
  estado_acreditacion?: boolean
  fecha_acreditacion?: string | null
  codigo_validacion?: string | null
  folio?: string | null
}

export const participantesApi = {
  agregar: (cursoId: string, payload: any) =>
    api<{ id: string; participante_id: string; curso_participante_id: string }>(
      `/cursos/${cursoId}/participantes`,
      { method: 'POST', body: payload }
    ),
  acreditar: (participanteId: string, calificacion: number) =>
    api<any>(`/participantes/${participanteId}/acreditar`, {
      method: 'POST',
      body: { calificacion },
    }),
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
      method: 'POST',
      body: { curso_participante_id },
    }),
}

// ── Verificación pública (NO requiere auth) ────────────
export type Verificacion = {
  valida: boolean
  codigo_validacion: string
  tipo_documento: string
  estatus: string
  folio: string | null
  fecha_emision: string | null
  participante: string | null
  pax_id: string | null
  curso: string | null
  curso_ciudad: string | null
  curso_inicio: string | null
  curso_fin: string | null
  organizacion: string | null
  organizacion_rfc: string | null
  calificacion: number | null
  fecha_acreditacion: string | null
  fecha_expiracion: string | null
  verificaciones_count?: number
}

export async function verificarPublico(codigo: string): Promise<Verificacion> {
  const res = await fetch(`/api/v1/verificar/${codigo}`)
  if (!res.ok) throw new Error('Documento no encontrado')
  return res.json()
}

// URL del PDF (vía proxy de Next en dev, detrás de /api).
// El endpoint /api/v1/constancias/{id}/pdf está protegido por auth y pasa por
// el rewrite /api/:path* -> :8000. Usamos ese, no /storage (que no está en el proxy).
export function pdfUrl(constanciaId: string): string {
  return `/api/v1/constancias/${constanciaId}/pdf`
}
