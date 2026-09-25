// Límite de constancias del plan (GET /api/v1/cupo)
export type Cupo = {
  plan_codigo: string | null
  plan_nombre: string | null
  activa: boolean
  es_prueba: boolean
  ilimitado: boolean
  limite: number | null
  usados: number
  restantes_plan: number | null
  extra: number
  disponibles: number | null // null = ilimitado
  porcentaje: number | null
  periodo_inicio: string | null
  periodo_fin: string | null
  historial?: { mes: string; emitidas: number }[]
  recomendacion?: Recomendacion
}

export type Recomendacion = {
  nivel: "ok" | "atencion" | "subir"
  titulo: string
  mensaje: string
  ritmo_mensual: number
  proyeccion_periodo: number | null
  agota_el: string | null
  plan_sugerido: { codigo: string; nombre: string; precio_mensual: number; limite: number | null } | null
}

export const fechaCorta = (iso: string | null) =>
  iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "long" }) : ""

/** Nivel para colorear: normal, cerca del límite (80%) o lleno. */
export function nivelCupo(c: Cupo): "ok" | "alerta" | "lleno" {
  if (!c.activa) return "lleno"
  if (c.ilimitado || c.porcentaje === null) return "ok"
  if ((c.disponibles ?? 0) <= 0) return "lleno"
  return c.porcentaje >= 80 ? "alerta" : "ok"
}
