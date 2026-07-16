"use client"

import React, { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "react-query"
import { apiRequest } from "@/app/services/api"
import {
  Card, CardHeader, CardTitle, CardContent,
  Button, Badge, Skeleton, Input, Dialog,
  DialogHeader, DialogTitle, DialogContent, DialogFooter,
} from "@/components/ui"
import { useRouter, useParams } from "next/navigation"
import {
  ArrowLeftIcon, CheckCircleIcon,
  HistoryIcon, Trash2Icon, PlusIcon,
} from "lucide-react"
import { toast } from "sonner"

type Version = {
  id: string
  version: number
  nombre: string
  activa: boolean
  creada_por: string | null
  fecha_creacion: string
}

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

const TIPO_COLORS: Record<string, string> = {
  CONSTANCIA: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  DC3: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  DIPLOMA: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  CREDENCIAL: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  OTRO: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
}

export default function TemplateDetailPage() {
  const router = useRouter()
  const params = useParams()
  const groupId = params.group_id as string
  const queryClient = useQueryClient()

  const [showNewVersion, setShowNewVersion] = useState(false)
  const [versionForm, setVersionForm] = useState({
    nombre: "",
    html_template: "",
  })

  const { data: activeTemplate, isLoading: loadingActive } = useQuery(
    ["templates", "group", groupId, "active"],
    async () => {
      const all = await apiRequest<Template[]>("/templates", {
        method: "GET",
      }) as Template[]
      const group = all.filter((t) => t.template_group_id === groupId)
      return group.find((t) => t.activa) || group[0] || null
    },
    { retry: 1 }
  )

  const {
    data: versions,
    isLoading: loadingVersions,
    error: versionsError,
  } = useQuery(
    ["templates", "versions", groupId],
    () => apiRequest<Version[]>(`/templates/${groupId}/versiones`),
    { retry: 1 }
  )

  const activateMutation = useMutation(
    (templateId: string) => apiRequest(`/templates/${templateId}/activar`, { method: "PUT" }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(["templates"])
        queryClient.invalidateQueries(["templates", "group", groupId])
        queryClient.invalidateQueries(["templates", "versions", groupId])
        toast.success("Versión activada correctamente")
      },
      onError: (err: unknown) => { toast.error(err instanceof Error ? err.message : "Error al activar") },
    }
  )

  const deleteMutation = useMutation(
    (templateId: string) => apiRequest(`/templates/${templateId}`, { method: "DELETE" }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(["templates"])
        queryClient.invalidateQueries(["templates", "group", groupId])
        queryClient.invalidateQueries(["templates", "versions", groupId])
        toast.success("Versión eliminada")
      },
      onError: (err: unknown) => { toast.error(err instanceof Error ? err.message : "Error al eliminar") },
    }
  )

  const createVersionMutation = useMutation(
    (data: Record<string, unknown>) => apiRequest(`/templates/${groupId}/versiones`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(["templates"])
        queryClient.invalidateQueries(["templates", "group", groupId])
        queryClient.invalidateQueries(["templates", "versions", groupId])
        setShowNewVersion(false)
        setVersionForm({ nombre: "", html_template: "" })
        toast.success("Nueva versión creada")
      },
      onError: (err: unknown) => { toast.error(err instanceof Error ? err.message : "Error al crear versión") },
    }
  )

  const handleCreateVersion = (e: React.FormEvent) => {
    e.preventDefault()
    if (!versionForm.nombre.trim()) {
      toast.error("El nombre es requerido")
      return
    }
    createVersionMutation.mutate(versionForm)
  }

  if (loadingActive || loadingVersions) {
    return (
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
    )
  }

  if (versionsError) {
    return (
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-6 text-center">
          <p className="text-destructive font-medium">Error al cargar la plantilla</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/cliente/templates")}>
          <ArrowLeftIcon className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              {activeTemplate?.nombre || "Plantilla"}
            </h1>
            {activeTemplate && (
              <Badge className={TIPO_COLORS[activeTemplate.tipo_documento] || TIPO_COLORS.OTRO}>
                {activeTemplate.tipo_documento}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {versions?.length || 0} {versions?.length === 1 ? "versión" : "versiones"}
          </p>
        </div>
        <Button onClick={() => setShowNewVersion(true)}>
          <PlusIcon className="h-4 w-4 mr-2" />
          Nueva versión
        </Button>
      </div>

      {/* Version history */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <HistoryIcon className="h-4 w-4" />
            Historial de versiones
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!versions || versions.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Sin versiones disponibles
            </div>
          ) : (
            <div className="divide-y">
              {versions.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      v{v.version}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{v.nombre}</p>
                      <p className="text-xs text-muted-foreground">
                        {v.fecha_creacion
                          ? new Date(v.fecha_creacion).toLocaleDateString("es-MX", {
                              year: "numeric", month: "long", day: "numeric",
                              hour: "2-digit", minute: "2-digit",
                            })
                          : "Fecha desconocida"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {v.activa ? (
                      <Badge className="bg-green-600 flex items-center gap-1">
                        <CheckCircleIcon className="h-3 w-3" />
                        Activa
                      </Badge>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => activateMutation.mutate(v.id)}
                          disabled={activateMutation.isLoading}
                        >
                          <CheckCircleIcon className="h-3.5 w-3.5 mr-1" />
                          Activar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm("¿Eliminar esta versión?")) {
                              deleteMutation.mutate(v.id)
                            }
                          }}
                          disabled={deleteMutation.isLoading}
                        >
                          <Trash2Icon className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active template details */}
      {activeTemplate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detalles de la versión activa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Versión</span>
                <p className="font-medium">v{activeTemplate.version}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Tipo</span>
                <p className="font-medium">{activeTemplate.tipo_documento}</p>
              </div>
            </div>
            {activeTemplate.html_template && (
              <div className="space-y-1">
                <span className="text-sm text-muted-foreground">HTML de la plantilla</span>
                <pre className="rounded-md bg-muted p-3 text-xs overflow-x-auto">
                  {activeTemplate.html_template}
                </pre>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Recursos</span>
                <pre className="text-xs mt-1">
                  {JSON.stringify(activeTemplate.recursos, null, 2)}
                </pre>
              </div>
              <div>
                <span className="text-muted-foreground">Configuración</span>
                <pre className="text-xs mt-1">
                  {JSON.stringify(activeTemplate.config, null, 2)}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* New Version Dialog */}
      <Dialog open={showNewVersion} onClose={() => setShowNewVersion(false)}>
        <DialogHeader>
          <DialogTitle>Nueva versión</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleCreateVersion}>
          <DialogContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nombre</label>
                <Input
                  value={versionForm.nombre}
                  onChange={(e) => setVersionForm((s) => ({ ...s, nombre: e.target.value }))}
                  placeholder="Nombre de esta versión"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">HTML</label>
                <textarea
                  className="w-full h-32 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm font-mono"
                  value={versionForm.html_template}
                  onChange={(e) => setVersionForm((s) => ({ ...s, html_template: e.target.value }))}
                  placeholder={activeTemplate?.html_template || ""}
                />
                <p className="text-xs text-muted-foreground">
                  Si se deja vacío, se usará el HTML de la versión activa
                </p>
              </div>
            </div>
          </DialogContent>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setShowNewVersion(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createVersionMutation.isLoading}>
              {createVersionMutation.isLoading ? "Creando..." : "Crear versión"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  )
}
