"use client"

import React from "react"
import { useQuery } from "react-query"
import { apiRequest } from "@/app/services/api"
import {
  Card, CardHeader, CardTitle, CardContent,
  Button, Badge, Skeleton,
} from "@/components/ui"
import { useRouter } from "next/navigation"
import { StampIcon, PlusIcon, EyeIcon, HistoryIcon } from "lucide-react"

type Template = {
  id: string
  organizacion_id: string
  template_group_id: string
  tipo_documento: string
  version: number
  nombre: string
  activa: boolean
  recursos: Record<string, unknown>
  config: Record<string, unknown>
  html_template: string
  fecha_creacion: string
  creada_por: string | null
}

type GroupedTemplate = {
  template_group_id: string
  tipo_documento: string
  nombre: string
  activa: boolean
  versiones: number
  ultima_version: number
  fecha_creacion: string
}

const TIPO_COLORS: Record<string, string> = {
  CONSTANCIA: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  DC3: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  DIPLOMA: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  CREDENCIAL: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  OTRO: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
}

export default function TemplatesPage() {
  const router = useRouter()

  const { data, isLoading, error } = useQuery(
    ["templates"],
    () => apiRequest<Template[]>("/templates"),
    { retry: 1 }
  )

  const grouped: GroupedTemplate[] = React.useMemo(() => {
    if (!data) return []
    const map = new Map<string, Template[]>()
    for (const t of data) {
      const g = t.template_group_id
      if (!map.has(g)) map.set(g, [])
      map.get(g)!.push(t)
    }
    return Array.from(map.entries()).map(([groupId, versions]) => {
      const sorted = versions.sort((a, b) => b.version - a.version)
      const active = sorted.find((v) => v.activa) || sorted[0]
      return {
        template_group_id: groupId,
        tipo_documento: active.tipo_documento,
        nombre: active.nombre,
        activa: active.activa,
        versiones: versions.length,
        ultima_version: sorted[0].version,
        fecha_creacion: sorted[sorted.length - 1].fecha_creacion,
      }
    })
  }, [data])

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-lg" />)}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-6 text-center">
          <p className="text-destructive font-medium">Error al cargar plantillas</p>
          <p className="text-sm text-muted-foreground mt-1">Verifica tu conexión e intenta de nuevo</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
      <div className="flex items-center justify-between">
        <div>
          <a href="/cliente/templates" className="text-sm font-medium text-orange-500 hover:underline">← Plantillas de DC-3</a>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">Plantillas HTML (avanzado)</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Para usuarios técnicos: plantillas escritas en HTML. Para usar tu propio formato en PDF, regresa a Plantillas de DC-3.
          </p>
        </div>
        <Button onClick={() => router.push("/cliente/templates/nuevo")}>
          <PlusIcon className="h-4 w-4 mr-2" />
          Nueva plantilla
        </Button>
      </div>

      {grouped.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center space-y-4">
          <StampIcon className="h-12 w-12 mx-auto text-muted-foreground/50" />
          <h2 className="text-xl font-semibold">Sin plantillas</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Aún no has creado ninguna plantilla. Crea tu primera plantilla para empezar a emitir documentos.
          </p>
          <Button onClick={() => router.push("/cliente/templates/nuevo")}>
            <PlusIcon className="h-4 w-4 mr-2" />
            Crear plantilla
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {grouped.map((g) => (
            <Card key={g.template_group_id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <Badge className={TIPO_COLORS[g.tipo_documento] || TIPO_COLORS.OTRO}>
                    {g.tipo_documento}
                  </Badge>
                  {g.activa ? (
                    <Badge variant="default" className="bg-green-600">Activa</Badge>
                  ) : (
                    <Badge variant="secondary">Inactiva</Badge>
                  )}
                </div>
                <CardTitle className="text-base mt-2">{g.nombre}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                  <span className="flex items-center gap-1">
                    <HistoryIcon className="h-3.5 w-3.5" />
                    {g.versiones} {g.versiones === 1 ? "versión" : "versiones"}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => router.push(`/cliente/templates/${g.template_group_id}`)}
                  >
                    <EyeIcon className="h-3.5 w-3.5 mr-1" />
                    Ver
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
