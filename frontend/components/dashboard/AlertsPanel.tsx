"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle, AlertCircle, Info, TrendingUp } from "lucide-react"
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

const PRIORITY_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  alta: { icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50 dark:bg-red-950/20" },
  media: { icon: AlertCircle, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/20" },
  baja: { icon: Info, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/20" },
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
            <div
              key={`${a.tipo}-${i}`}
              className={cn("flex items-center gap-3 rounded-lg p-3 text-sm", cfg.bg)}
            >
              <Icon className={cn("h-5 w-5 shrink-0", cfg.color)} />
              <div className="flex-1">
                <span className="font-medium">{LABELS[a.tipo] || a.tipo}</span>
                <span className="ml-2 text-muted-foreground">{a.cantidad}</span>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
