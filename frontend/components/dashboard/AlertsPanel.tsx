"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle, AlertCircle, Info, TrendingUp, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

type Alerta = {
  tipo: string
  cantidad: number
  prioridad: string
}

const LABELS: Record<string, string> = {
  constancias_por_vencer: "Constancias por vencer",
  cursos_sin_instructor: "Cursos sin instructor",
  participantes_sin_constancia: "Participantes sin constancia",
  cursos_sin_empresa: "Cursos sin empresa contratante",
}

const LINKS: Record<string, string> = {
  constancias_por_vencer: "/cliente/renovaciones",
  cursos_sin_instructor: "/cliente/cursos",
  participantes_sin_constancia: "/cliente/participantes",
  cursos_sin_empresa: "/cliente/cursos",
}

const PRIORITY_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string; text: string }> = {
  alta: { icon: AlertTriangle, color: "text-red-600 dark:text-red-400", bg: "bg-red-100 dark:bg-red-950", text: "text-red-950 dark:text-red-100" },
  media: { icon: AlertCircle, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-950", text: "text-amber-950 dark:text-amber-100" },
  baja: { icon: Info, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-950", text: "text-blue-950 dark:text-blue-100" },
}

export function AlertsPanel({ alertas }: { alertas: Alerta[] }) {
  if (!alertas || alertas.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Alertas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <TrendingUp className="h-4 w-4 text-green-500" />
            Sin alertas pendientes
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">Alertas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {alertas.map((a, i) => {
          const cfg = PRIORITY_CONFIG[a.prioridad] || PRIORITY_CONFIG.baja
          const Icon = cfg.icon
          return (
            <a
              key={`${a.tipo}-${i}`}
              href={LINKS[a.tipo] || "#"}
              className={cn("flex items-center gap-3 rounded-lg p-3 text-sm transition-opacity hover:opacity-80", cfg.bg, cfg.text)}
            >
              <Icon className={cn("h-5 w-5 shrink-0", cfg.color)} />
              <div className="flex-1">
                <span className="font-medium">{LABELS[a.tipo] || a.tipo}</span>
                <span className="ml-2 text-muted-foreground">{a.cantidad}</span>
              </div>
              <ChevronRight className={cn("h-4 w-4 shrink-0", cfg.color)} />
            </a>
          )
        })}
      </CardContent>
    </Card>
  )
}
