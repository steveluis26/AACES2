import { TimelineEventVM } from "@/viewmodels/document"
import { cn } from "@/lib/utils"

interface TimelineProps {
  eventos: TimelineEventVM[]
}

const DOT_COLORS: Record<string, string> = {
  info: "bg-blue-500",
  success: "bg-green-500",
  warning: "bg-amber-500",
  error: "bg-red-500",
}

const BORDER_COLORS: Record<string, string> = {
  info: "border-blue-200 dark:border-blue-800",
  success: "border-green-200 dark:border-green-800",
  warning: "border-amber-200 dark:border-amber-800",
  error: "border-red-200 dark:border-red-800",
}

export function Timeline({ eventos }: TimelineProps) {
  if (eventos.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        No hay eventos registrados
      </div>
    )
  }

  return (
    <div className="relative space-y-0">
      {eventos.map((evento, i) => {
        const severity = evento.severity ?? "info"
        const isLast = i === eventos.length - 1
        const date = new Date(evento.fecha)
        const formatted = date.toLocaleDateString("es-ES", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })

        return (
          <div key={evento.id} className="relative flex gap-4 pb-6 last:pb-0">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "h-3 w-3 rounded-full ring-4 ring-background z-10",
                  DOT_COLORS[severity] ?? "bg-gray-400"
                )}
              />
              {!isLast && (
                <div
                  className={cn(
                    "w-px flex-1 -mt-1",
                    BORDER_COLORS[severity] ?? "border-gray-200"
                  )}
                />
              )}
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{evento.titulo}</p>
                <time className="text-xs text-muted-foreground shrink-0">
                  {formatted}
                </time>
              </div>
              {evento.descripcion && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {evento.descripcion}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
