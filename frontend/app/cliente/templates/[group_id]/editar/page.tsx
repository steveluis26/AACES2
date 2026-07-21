"use client"

import React, { useState, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "react-query"
import { useRouter, useParams } from "next/navigation"
import {
  Card, CardHeader, CardTitle, CardContent, CardFooter,
  Button, Badge, Skeleton, Input, Table,
} from "@/components/ui"
import {
  TableHeader, TableBody, TableRow, TableCell, TableHead,
} from "@/components/ui/table"
import {
  ArrowLeftIcon, SaveIcon, CheckCircleIcon, UploadIcon,
  ImageIcon, RefreshCwIcon, Trash2Icon, EyeIcon,
} from "lucide-react"
import { toast } from "sonner"
import {
  fetchTemplateGroup,
  fetchTemplateVersiones,
  updateTemplate,
  activateTemplate,
  deleteTemplate,
  uploadTemplateRecurso,
} from "@/adapters/template.adapter"
import {
  TemplateDetalleVM,
  TemplateVersionVM,
} from "@/viewmodels/template"

const TIPO_COLORS: Record<string, string> = {
  CONSTANCIA: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  DC3: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  DIPLOMA: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  CREDENCIAL: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  OTRO: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
}

const PLACEHOLDERS = "{{curso_nombre}}, {{participante_nombre}}, {{curso_duracion_horas}}, {{qr}}"

export default function EditarPlantillaPage() {
  const router = useRouter()
  const params = useParams()
  const groupId = params.group_id as string
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const { data: template, isLoading, error } = useQuery(
    ["templates", "group", groupId, "active"],
    () => fetchTemplateGroup(groupId),
    { retry: 1 }
  )

  const { data: versiones, isLoading: loadingVersiones } = useQuery(
    ["templates", "versions", groupId],
    () => fetchTemplateVersiones(groupId),
    { retry: 1 }
  )

  const [nombre, setNombre] = useState<string | null>(null)
  const [htmlTemplate, setHtmlTemplate] = useState<string | null>(null)

  // Valores efectivos (borrador sobre el valor cargado).
  const currentNombre = nombre ?? template?.nombre ?? ""
  const currentHtml = htmlTemplate ?? template?.htmlTemplate ?? ""

  const updateMutation = useMutation(
    (payload: { nombre: string; html_template: string }) =>
      updateTemplate(template!.id, {
        nombre: payload.nombre,
        html_template: payload.html_template,
      }),
    {
      onSuccess: (updated) => {
        queryClient.invalidateQueries(["templates", "group", groupId])
        queryClient.invalidateQueries(["templates"])
        setNombre(updated.nombre)
        setHtmlTemplate(updated.htmlTemplate)
        toast.success("Plantilla actualizada")
      },
      onError: (err: unknown) => {
        toast.error(err instanceof Error ? err.message : "Error al actualizar")
      },
    }
  )

  const activateMutation = useMutation(
    (templateId: string) => activateTemplate(templateId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(["templates"])
        queryClient.invalidateQueries(["templates", "group", groupId])
        queryClient.invalidateQueries(["templates", "versions", groupId])
        toast.success("Versión activada")
      },
      onError: (err: unknown) => {
        toast.error(err instanceof Error ? err.message : "Error al activar")
      },
    }
  )

  const deleteMutation = useMutation(
    (templateId: string) => deleteTemplate(templateId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(["templates"])
        queryClient.invalidateQueries(["templates", "group", groupId])
        queryClient.invalidateQueries(["templates", "versions", groupId])
        toast.success("Versión eliminada")
      },
      onError: (err: unknown) => {
        toast.error(err instanceof Error ? err.message : "Error al eliminar")
      },
    }
  )

  const handleGuardar = () => {
    if (!template) return
    if (!currentNombre.trim()) {
      toast.error("El nombre es requerido")
      return
    }
    updateMutation.mutate({
      nombre: currentNombre,
      html_template: currentHtml,
    })
  }

  const handleUploadLogo = async (file: File) => {
    if (!template) return
    setUploading(true)
    try {
      const result = await uploadTemplateRecurso({
        organizacionId: template.organizacionId,
        archivo: file,
        tipoRecurso: "logo",
        nombre: file.name,
      })
      // Guarda la URL en recursos.logo_url vía PUT.
      await updateTemplate(template.id, {
        nombre: template.nombre,
        recursos: { ...template.recursos, logo_url: result.url },
      })
      queryClient.invalidateQueries(["templates", "group", groupId])
      toast.success("Logo subido correctamente")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al subir el logo")
    } finally {
      setUploading(false)
    }
  }

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleUploadLogo(file)
    e.target.value = ""
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    )
  }

  if (error || !template) {
    return (
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-6 text-center">
          <p className="text-destructive font-medium">Error al cargar la plantilla</p>
          <Button className="mt-4" onClick={() => router.push("/cliente/templates")}>
            Volver
          </Button>
        </div>
      </div>
    )
  }

  const logoUrl = template.recursos?.logo_url

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push(`/cliente/templates/${groupId}`)}>
          <ArrowLeftIcon className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Editar plantilla</h1>
            <Badge className={TIPO_COLORS[template.tipoDocumento] || TIPO_COLORS.OTRO}>
              {template.tipoDocumento}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Versión activa v{template.version}
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push(`/cliente/templates/${groupId}`)}>
          <EyeIcon className="h-4 w-4 mr-2" />
          Ver detalle
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Columna principal: edición de nombre + HTML */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Información de la plantilla</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nombre</label>
                <Input
                  value={currentNombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: Constancia estándar"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Plantilla HTML</label>
                <p className="text-xs text-muted-foreground">
                  Usa {"{{variable}}"} para datos dinámicos: {PLACEHOLDERS}
                </p>
                <textarea
                  className="w-full h-96 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
                  value={currentHtml}
                  onChange={(e) => setHtmlTemplate(e.target.value)}
                  placeholder="<html><body>...</body></html>"
                />
              </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => router.push(`/cliente/templates/${groupId}`)} disabled={updateMutation.isLoading}>
                Cancelar
              </Button>
              <Button onClick={handleGuardar} disabled={updateMutation.isLoading}>
                <SaveIcon className="h-4 w-4 mr-2" />
                {updateMutation.isLoading ? "Guardando..." : "Guardar cambios"}
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Columna lateral: logo + versiones */}
        <div className="space-y-4">
          {/* Logo */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                Logo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*"
                onChange={onFileChange}
              />
              {logoUrl ? (
                <div className="flex items-center justify-center rounded-md border bg-muted p-3">
                  <img src={logoUrl} alt="Logo" className="max-h-24 object-contain" />
                </div>
              ) : (
                <div className="flex items-center justify-center rounded-md border border-dashed p-6 text-sm text-muted-foreground">
                  Sin logo
                </div>
              )}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <RefreshCwIcon className="h-3.5 w-3.5 mr-2 animate-spin" />
                ) : (
                  <UploadIcon className="h-3.5 w-3.5 mr-2" />
                )}
                {uploading ? "Subiendo..." : "Subir logo"}
              </Button>
              {logoUrl && (
                <p className="text-xs text-muted-foreground break-all">
                  <span className="font-medium">URL:</span> {logoUrl}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Versiones */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <RefreshCwIcon className="h-4 w-4" />
                Versiones
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loadingVersiones ? (
                <div className="p-4">
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : !versiones || versiones.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Sin versiones disponibles
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Versión</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(versiones as TemplateVersionVM[]).map((v) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-medium">v{v.version}</TableCell>
                        <TableCell>
                          {v.activa ? (
                            <Badge className="bg-green-600 flex items-center gap-1 w-fit">
                              <CheckCircleIcon className="h-3 w-3" />
                              Activa
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Inactiva</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {!v.activa && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => activateMutation.mutate(v.id)}
                                disabled={activateMutation.isLoading}
                              >
                                <CheckCircleIcon className="h-3.5 w-3.5 mr-1" />
                                Activar
                              </Button>
                            )}
                            {!v.activa && (
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
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
