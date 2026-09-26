// Congruencia del DC-3: agente – curso registrado – instructor (Fase 1: declarado por la agencia)
export type Aviso = { clave: string; texto: string }

export type Congruencia = {
  congruente: boolean
  avisos: Aviso[]
  catalogo_curso_id: string | null
  instructor_id: string | null
  curso?: { nombre: string | null; registrado: boolean; stps_nombre: string | null }
  instructor?: { id: string; nombre: string; autorizado: boolean } | null
}

/** Si la API respondió 409 por avisos de congruencia, los devuelve; si no, null. */
export function avisosDeError(e: unknown): Aviso[] | null {
  const err = e as { status?: number; detalle?: { codigo?: string; avisos?: Aviso[] } }
  return err?.status === 409 && err.detalle?.codigo === "congruencia" ? err.detalle.avisos || [] : null
}
