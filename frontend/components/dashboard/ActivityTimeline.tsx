"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  if (hrs < 24) return `hace ${hrs}h`
  const dias = Math.floor(hrs / 24)
  return `hace ${dias}d`
}

export function ActivityTimeline({ actividad }: { actividad: Evento[] }) {
  if (!actividad || actividad.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Actividad reciente</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Aún no hay actividad registrada</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">Actividad reciente</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-0">
          {actividad.map((ev, i) => {
            const cfg = TIPO_CONFIG[ev.tipo] || { icon: Clock, label: ev.tipo }
            const Icon = cfg.icon
            return (
              <div key={i} className="flex gap-3 pb-4 last:pb-0 relative">
                <div className="flex flex-col items-center">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border bg-background">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  {i < actividad.length - 1 && (
                    <div className="w-px flex-1 bg-border mt-1" />
                  )}
                </div>
                <div className="flex-1 min-w-0 pt-1">
                  <p className="text-sm font-medium">{cfg.label}</p>
                  {ev.participante && (
                    <p className="text-xs text-muted-foreground truncate">{ev.participante}</p>
                  )}
                  {ev.curso && (
                    <p className="text-xs text-muted-foreground truncate">{ev.curso}</p>
                  )}
                </div>
                <div className="shrink-0 pt-1">
                  <span className="text-xs text-muted-foreground">{tiempoRelativo(ev.fecha)}</span>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
