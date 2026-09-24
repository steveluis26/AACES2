"use client"

import { Panel } from "./Panel"
import { FileText, UserPlus, BookOpen, Clock } from "lucide-react"

type Evento = {
  tipo: string
  fecha: string | null
  curso: string
  participante: string
}

const TIPO_CONFIG: Record<string, { icon: React.ElementType; label: string }> = {
  constancia_emitida: { icon: FileText, label: "Constancia emitida" },
  participante_registrado: { icon: UserPlus, label: "Participante registrado" },
  curso_creado: { icon: BookOpen, label: "Curso creado" },
}

function tiempoRelativo(iso: string | null): string {
  if (!iso) return ""
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "Ahora"
  if (mins < 60) return `hace ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `hace ${hrs} h`
  const dias = Math.floor(hrs / 24)
  return `hace ${dias} d`
}

export function ActivityTimeline({ actividad, delay = 0 }: { actividad: Evento[]; delay?: number }) {
  return (
    <Panel titulo="Actividad reciente" icono={Clock} delay={delay}>
      {!actividad || actividad.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aún no hay actividad registrada.</p>
      ) : (
        <ol className="relative space-y-4 before:absolute before:bottom-2 before:left-4 before:top-2 before:w-px before:bg-border">
          {actividad.slice(0, 6).map((ev, i) => {
            const cfg = TIPO_CONFIG[ev.tipo] || { icon: Clock, label: ev.tipo }
            const Icon = cfg.icon
            return (
              <li key={i} className="relative flex gap-3">
                <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-card">
                  <Icon className="h-3.5 w-3.5 text-orange-500" />
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-medium">{cfg.label}</p>
                    <time className="shrink-0 text-xs text-muted-foreground">{tiempoRelativo(ev.fecha)}</time>
                  </div>
                  {(ev.participante || ev.curso) && (
                    <p className="truncate text-xs text-muted-foreground">{[ev.participante, ev.curso].filter(Boolean).join(" · ")}</p>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </Panel>
  )
}
