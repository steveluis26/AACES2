// Plantillas con el formato propio del cliente (PDF/imagen) y generación de DC-3.
// apiRequest siempre envía/recibe JSON; aquí hay subida de archivos y descargas de PDF.

export type Pagina = { w: number; h: number }

export type CampoPlantilla = {
  id?: string // solo en el editor
  clave: string
  pagina: number
  x: number // porcentajes 0-100, origen arriba-izquierda
  y: number
  w: number
  h: number
  tam: number // puntos tipográficos
  alineacion: "left" | "center" | "right"
  negrita: boolean
  espaciado: number
  mayusculas: boolean
  color: string
  texto: string
  casillas: number
}

export type Plantilla = {
  id: string
  nombre: string
  archivo_nombre: string | null
  paginas: Pagina[]
  campos: CampoPlantilla[]
  fecha_creacion: string | null
  fecha_actualizacion: string | null
}

export type CampoCatalogo = { clave: string; etiqueta: string; grupo: string }

// Texto de ejemplo que se ve en el editor (el servidor usa los mismos)
export const EJEMPLOS: Record<string, string> = {
  participante_nombre: "María Fernanda López Ruiz",
  participante_nombres: "María Fernanda",
  participante_apellidos: "López Ruiz",
  curp: "LORM900101MQTPZR05",
  ocupacion: "Supervisora de seguridad",
  puesto: "Supervisora",
  empresa: "Grupo Industrial del Bajío",
  curso_nombre: "Trabajos en alturas NOM-009-STPS-2011",
  curso_horas: "16",
  curso_duracion: "16 horas",
  fecha_inicio: "05/10/2026",
  fecha_fin: "06/10/2026",
  periodo: "05/10/2026 al 06/10/2026",
  inicio_anio: "2026",
  inicio_mes: "10",
  inicio_dia: "05",
  fin_anio: "2026",
  fin_mes: "10",
  fin_dia: "06",
  ciudad: "Querétaro",
  capacitador: "CAS Capacitación y Adiestramiento",
  registro_stps: "CAS-150312-AB7",
  fecha_emision: "06/10/2026",
  folio: "CERT-A7AD98C5",
  codigo_validacion: "5D1627E0",
  url_verificacion: "https://aaces.mx/v/5D1627E0",
  qr: "",
  texto: "Texto fijo",
}

// Casillas sugeridas al agregar el campo (formato DC-3 oficial)
export const CASILLAS_SUGERIDAS: Record<string, number> = {
  curp: 18, inicio_anio: 4, inicio_mes: 2, inicio_dia: 2, fin_anio: 4, fin_mes: 2, fin_dia: 2,
}

const API = "/api/v1/plantillas-pdf"

function token() {
  try {
    return localStorage.getItem("aaces_token") || localStorage.getItem("token") || localStorage.getItem("access_token") || ""
  } catch {
    return ""
  }
}

async function pedir(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  const t = token()
  if (t) headers.set("Authorization", `Bearer ${t}`)
  const res = await fetch(url, { ...init, headers })
  if (res.status === 401) {
    window.location.href = "/login"
    throw new Error("Tu sesión expiró")
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(typeof data.detail === "string" ? data.detail : `Error ${res.status}`)
  }
  return res
}

const json = async <T,>(url: string, init: RequestInit = {}): Promise<T> =>
  (await pedir(url, { ...init, headers: { "Content-Type": "application/json", ...(init.headers || {}) } })).json()

export const plantillasApi = {
  catalogo: () => json<CampoCatalogo[]>(`${API}/campos`),
  listar: () => json<Plantilla[]>(API),
  obtener: (id: string) => json<Plantilla>(`${API}/${id}`),
  archivo: async (id: string) => (await pedir(`${API}/${id}/archivo`)).arrayBuffer(),
  subir: async (archivo: File, nombre: string) => {
    const fd = new FormData()
    fd.append("archivo", archivo)
    fd.append("nombre", nombre)
    return (await pedir(API, { method: "POST", body: fd })).json() as Promise<Plantilla>
  },
  guardar: (id: string, datos: { nombre?: string; campos?: CampoPlantilla[] }) =>
    json<Plantilla>(`${API}/${id}`, {
      method: "PUT",
      body: JSON.stringify({ ...datos, campos: datos.campos?.map(({ id: _id, ...c }) => c) }),
    }),
  eliminar: async (id: string) => { await pedir(`${API}/${id}`, { method: "DELETE" }) },
  vistaPrevia: async (id: string, campos: CampoPlantilla[]) =>
    (await pedir(`${API}/${id}/vista-previa`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campos: campos.map(({ id: _id, ...c }) => c) }),
    })).blob(),
  generar: async (id: string, cursoId: string, cpIds?: string[]) => {
    const res = await pedir(`${API}/${id}/generar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ curso_id: cursoId, curso_participante_ids: cpIds }),
    })
    const cd = res.headers.get("Content-Disposition") || ""
    const nombre = /filename="([^"]+)"/.exec(cd)?.[1] || "DC3.pdf"
    return { blob: await res.blob(), nombre, generados: Number(res.headers.get("X-Generados") || 0) }
  },
}

export function descargarBlob(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

export function abrirBlob(blob: Blob) {
  const url = URL.createObjectURL(blob)
  window.open(url, "_blank", "noopener")
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}
