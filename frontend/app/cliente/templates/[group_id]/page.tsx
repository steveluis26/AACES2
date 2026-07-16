"use client"

import React, { useState, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "react-query"
import { apiRequest } from "@/app/services/api"
import {
  Card, CardHeader, CardTitle, CardContent,
  Button, Badge, Skeleton, Input, Dialog,
  DialogHeader, DialogTitle, DialogContent, DialogFooter,
} from "@/components/ui"
import { useRouter, useParams } from "next/navigation"
import {
  ArrowLeftIcon, CheckCircleIcon, EyeIcon,
  HistoryIcon, Trash2Icon, PlusIcon, UploadIcon,
  ImageIcon, FileTextIcon, RefreshCwIcon,
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
  recursos: Record<string, string | null>
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

const RESOURCE_LABELS: Record<string, string> = {
  logo_url: "Logo",
  firma1_url: "Firma 1",
  firma2_url: "Firma 2",
  fondo_url: "Fondo",
  sello_url: "Sello",
}

const RESOURCE_ICONS: Record<string, React.ReactNode> = {
  logo_url: <ImageIcon className="h-4 w-4" />,
  firma1_url: <FileTextIcon className="h-4 w-4" />,
  firma2_url: <FileTextIcon className="h-4 w-4" />,
  fondo_url: <ImageIcon className="h-4 w-4" />,
  sello_url: <ImageIcon className="h-4 w-4" />,
}

const PREVIEW_DATA = {
  nombre: "María García López",
  curso: "Curso de Seguridad Industrial",
  fecha: "15 de julio de 2026",
  duracion: "40 horas",
  folio: "AACES-AB12CD34",
}

export default function TemplateDetailPage() {
  const router = useRouter()
  const params = useParams()
  const groupId = params.group_id as string
  const queryClient = useQueryClient()
  const [showNewVersion, setShowNewVersion] = useState(false)
  const [versionForm, setVersionForm] = useState({ nombre: "", html_template: "" })
  const [editingHtml, setEditingHtml] = useState(false)
  const [htmlDraft, setHtmlDraft] = useState("")
  const [uploading, setUploading] = useState<string | null>(null)
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadTarget, setUploadTarget] = useState<string | null>(null)

  const { data: activeTemplate, isLoading: loadingActive } = useQuery(
    ["templates", "group", groupId, "active"],
    async () => {
      const all = await apiRequest<Template[]>("/templates")
      const group = all.filter((t) => t.template_group_id === groupId)
      return group.find((t) => t.activa) || group[0] || null
    },
    { retry: 1 }
  )

  const { data: versions, isLoading: loadingVersions, error: versionsError } = useQuery(
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

  const handleUpload = async (resourceKey: string, file: File) => {
    setUploading(resourceKey)
    try {
      const form = new FormData()
      form.append("file", file)
      form.append("resource_type", resourceKey)
      const result = await apiRequest<{ url: string }>("/templates/upload", {
        method: "POST",
        body: form,
        headers: {},
      })
      const recursos = { ...activeTemplate?.recursos, [resourceKey]: result.url }
      await apiRequest(`/templates/${activeTemplate!.id}`, {
        method: "PUT",
        body: JSON.stringify({ recursos }),
      })
      queryClient.invalidateQueries(["templates", "group", groupId])
      toast.success(`${RESOURCE_LABELS[resourceKey]} subido correctamente`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al subir archivo")
    } finally {
      setUploading(null)
    }
  }

  const handleFileSelect = (resourceKey: string) => {
    setUploadTarget(resourceKey)
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && uploadTarget) {
      handleUpload(uploadTarget, file)
    }
    e.target.value = ""
  }

  const loadPreview = async () => {
    if (!activeTemplate) return
    setPreviewLoading(true)
    try {
      const html = await apiRequest<string>(`/templates/preview`, {
        method: "POST",
        body: JSON.stringify({
          template_id: activeTemplate.id,
          html_template: editingHtml ? htmlDraft : activeTemplate.html_template,
          data: PREVIEW_DATA,
        }),
      })
      setPreviewHtml(html)
      setShowPreview(true)
    } catch (err) {
      toast.error("Error al generar preview")
    } finally {
      setPreviewLoading(false)
    }
  }

  const getToken = () => {
    if (typeof window !== "undefined") {
      for (const k of ["aaces_token", "token", "access_token"]) {
        const v = localStorage.getItem(k)
        if (v) return v
      }
    }
    return null
  }

  const iframeSrcDoc = previewHtml || ""

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
      {/* Header */}
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
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadPreview} disabled={previewLoading}>
            <EyeIcon className="h-4 w-4 mr-2" />
            {previewLoading ? "Cargando..." : "Vista previa"}
          </Button>
          <Button onClick={() => setShowNewVersion(true)}>
            <PlusIcon className="h-4 w-4 mr-2" />
            Nueva versión
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left column: Resources + Details */}
        <div className="lg:col-span-1 space-y-4">
          {/* Resources */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                Recursos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*"
                onChange={handleFileChange}
              />
              {Object.entries(RESOURCE_LABELS).map(([key, label]) => {
                const url = activeTemplate?.recursos?.[key]
                return (
                  <div key={key} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {RESOURCE_ICONS[key]}
                      <span className="text-sm truncate">{label}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {url && (
                        <div
                          className="h-8 w-8 rounded border bg-muted overflow-hidden cursor-pointer"
                          onClick={() => window.open(url, "_blank")}
                          title="Ver recurso"
                        >
                          <img src={url} alt={label} className="h-full w-full object-contain" />
                        </div>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                        onClick={() => handleFileSelect(key)}
                        disabled={uploading === key}
                      >
                        {uploading === key ? (
                          <RefreshCwIcon className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <UploadIcon className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          {/* Template Details */}
          {activeTemplate && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Detalles</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Versión activa</span>
                  <span className="font-medium">v{activeTemplate.version}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tipo</span>
                  <Badge className={TIPO_COLORS[activeTemplate.tipo_documento] || TIPO_COLORS.OTRO}>
                    {activeTemplate.tipo_documento}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-1">Configuración</span>
                  <pre className="text-xs bg-muted rounded p-2 overflow-x-auto">
                    {JSON.stringify(activeTemplate.config, null, 2)}
                  </pre>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column: HTML Editor + Preview */}
        <div className="lg:col-span-2 space-y-4">
          {/* HTML Editor */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <FileTextIcon className="h-4 w-4" />
                Plantilla HTML
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (editingHtml) {
                    setEditingHtml(false)
                  } else {
                    setHtmlDraft(activeTemplate?.html_template || "")
                    setEditingHtml(true)
                  }
                }}
              >
                {editingHtml ? "Cancelar edición" : "Editar"}
              </Button>
            </CardHeader>
            <CardContent>
              {editingHtml ? (
                <div className="space-y-2">
                  <textarea
                    className="w-full h-64 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm font-mono focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={htmlDraft}
                    onChange={(e) => setHtmlDraft(e.target.value)}
                    placeholder="<html><body>..."
                  />
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => setEditingHtml(false)}>
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      onClick={async () => {
                        try {
                          await apiRequest(`/templates/${groupId}/versiones`, {
                            method: "POST",
                            body: JSON.stringify({
                              nombre: `Edición ${new Date().toLocaleString("es-MX")}`,
                              html_template: htmlDraft,
                            }),
                          })
                          queryClient.invalidateQueries(["templates"])
                          queryClient.invalidateQueries(["templates", "group", groupId])
                          queryClient.invalidateQueries(["templates", "versions", groupId])
                          setEditingHtml(false)
                          toast.success("Versión guardada")
                        } catch {
                          toast.error("Error al guardar")
                        }
                      }}
                    >
                      Guardar como nueva versión
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground mb-2">
                    Usa {"{{variable}}"} para datos dinámicos: {"{{nombre}}"}, {"{{curso}}"}, {"{{fecha}}"}
                  </p>
                  <pre className="rounded-md bg-muted p-3 text-xs overflow-x-auto max-h-64 overflow-y-auto">
                    {activeTemplate?.html_template || "Sin contenido HTML"}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
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

      {/* Preview Dialog */}
      <Dialog open={showPreview} onClose={() => setShowPreview(false)} className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Vista previa</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <div className="bg-white rounded-md overflow-hidden" style={{ minHeight: 400 }}>
            {previewHtml ? (
              <iframe
                srcDoc={iframeSrcDoc}
                className="w-full border-0"
                style={{ minHeight: 500 }}
                title="Preview"
              />
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                Sin contenido para previsualizar
              </div>
            )}
          </div>
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowPreview(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </Dialog>

      {/* New Version Dialog */}
      <Dialog open={showNewVersion} onClose={() => setShowNewVersion(false)}>
        <DialogHeader>
          <DialogTitle>Nueva versión</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => {
          e.preventDefault()
          if (!versionForm.nombre.trim()) {
            toast.error("El nombre es requerido")
            return
          }
          createVersionMutation.mutate(versionForm)
        }}>
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
