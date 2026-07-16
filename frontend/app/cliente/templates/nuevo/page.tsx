"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { apiRequest } from "@/app/services/api"
import {
  Card, CardHeader, CardTitle, CardContent, CardFooter,
  Button, Input, Badge,
} from "@/components/ui"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeftIcon, SaveIcon } from "lucide-react"
import { toast } from "sonner"

const TIPOS = ["CONSTANCIA", "DC3", "DIPLOMA", "CREDENCIAL", "OTRO"] as const

export default function NuevaPlantillaPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    tipo_documento: "CONSTANCIA",
    nombre: "",
    html_template: `<html><body><h1>{{nombre}}</h1><p>Curso: {{curso}}</p><p>Fecha: {{fecha}}</p></body></html>`,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nombre.trim()) {
      toast.error("El nombre es requerido")
      return
    }
    setSaving(true)
    try {
      const result = await apiRequest("/templates", {
        method: "POST",
        body: JSON.stringify(form),
      }) as { template_group_id: string }
      toast.success("Plantilla creada correctamente")
      router.push(`/cliente/templates/${result.template_group_id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al crear la plantilla")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeftIcon className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nueva plantilla</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Crea una nueva plantilla de documento para tu organización
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Información general</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo de documento</label>
              <Select
                value={form.tipo_documento}
                onValueChange={(val) => setForm((s) => ({ ...s, tipo_documento: val }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Nombre de la plantilla</label>
              <Input
                value={form.nombre}
                onChange={(e) => setForm((s) => ({ ...s, nombre: e.target.value }))}
                placeholder="Ej: Constancia estándar"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Plantilla HTML
                <Badge variant="secondary" className="ml-2 text-xs">Opcional</Badge>
              </label>
              <p className="text-xs text-muted-foreground">
                Usa {"{{variable}}"} para datos dinámicos: {"{{nombre}}"}, {"{{curso}}"}, {"{{fecha}}"}
              </p>
              <textarea
                className="w-full h-48 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
                value={form.html_template}
                onChange={(e) => setForm((s) => ({ ...s, html_template: e.target.value }))}
                placeholder="<html><body>..."
              />
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => router.back()} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              <SaveIcon className="h-4 w-4 mr-2" />
              {saving ? "Guardando..." : "Crear plantilla"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  )
}
