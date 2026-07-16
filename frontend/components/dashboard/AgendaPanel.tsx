"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CalendarDays, Building2, Users, MapPin } from "lucide-react"

type Curso = {
  curso_id: string
  nombre: string
  fecha_inicio: string | null
  fecha_fin: string | null
  empresa: string
  ciudad: string
  modalidad: string
  participantes: number
}

export function AgendaPanel({ agenda }: { agenda: Curso[] }) {
  if (!agenda || agenda.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Próximos cursos</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No hay cursos programados</p>
        </CardContent>
      </Card>
    )
  }

  const formatFecha = (iso: string | null) => {
    if (!iso) return ""
    return new Date(iso).toLocaleDateString("es-MX", {
      day: "numeric", month: "short",
    })
  }

  const modalidadColor = (m: string) => {
    if (m === "presencial") return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
    if (m === "virtual") return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
    return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">Próximos cursos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {agenda.map((curso) => (
          <div
            key={curso.curso_id}
            className="flex items-center justify-between rounded-lg border p-3"
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{curso.nombre}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" />
                  {formatFecha(curso.fecha_inicio)} - {formatFecha(curso.fecha_fin)}
                </span>
                {curso.empresa && (
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {curso.empresa}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {curso.ciudad}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {curso.participantes}
                </span>
              </div>
            </div>
            <Badge variant="outline" className={`ml-3 shrink-0 ${modalidadColor(curso.modalidad)}`}>
              {curso.modalidad || "General"}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
