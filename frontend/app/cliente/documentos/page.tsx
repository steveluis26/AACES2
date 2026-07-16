'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

interface Documento {
  id: string
  tipo_documento: string
  codigo_validacion: string
  pdf_hash: string
  estatus: string
  fecha_emision: string
  organizacion_razon_social?: string
}

const TIPO_LABELS: Record<string, string> = {
  CONSTANCIA: 'Constancia',
  DC3: 'DC3',
  DIPLOMA: 'Diploma',
  CREDENCIAL: 'Credencial',
  OTRO: 'Otro',
}

const ESTATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  emitido: 'default',
  cancelado: 'destructive',
  reemitido: 'secondary',
}

export default function DocumentosPage() {
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [loading, setLoading] = useState(true)

  const fetchDocs = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('aaces_token')
      const res = await fetch('/api/v1/documentos', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Error al cargar documentos')
      const data = await res.json()
      setDocumentos(Array.isArray(data) ? data : [])
    } catch (err) {
      toast.error('Error al cargar documentos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDocs()
  }, [])

  const handleDownload = async (doc: Documento) => {
    try {
      const token = localStorage.getItem('aaces_token')
      const res = await fetch(`/api/v1/documentos/${doc.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Error al descargar')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${doc.tipo_documento}_${doc.codigo_validacion}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Error al descargar el documento')
    }
  }

  const handleCancel = async (id: string) => {
    try {
      const token = localStorage.getItem('aaces_token')
      const res = await fetch(`/api/v1/documentos/${id}/cancelar`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Error al cancelar')
      toast.success('Documento cancelado')
      fetchDocs()
    } catch {
      toast.error('Error al cancelar el documento')
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Documentos emitidos</h1>
          <p className="text-sm text-muted-foreground">
            Constancias, DC3, diplomas y otros documentos generados
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Cargando...</p>
      ) : documentos.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Sin documentos</CardTitle>
            <CardDescription>
              Aún no has emitido ningún documento. Usa el editor de plantillas para generar tu primer documento.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-3">
          {documentos.map((doc) => (
            <Card key={doc.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{TIPO_LABELS[doc.tipo_documento] || doc.tipo_documento}</span>
                    <Badge variant={ESTATUS_VARIANTS[doc.estatus] || 'outline'}>
                      {doc.estatus}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Código: {doc.codigo_validacion}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(doc.fecha_emision).toLocaleDateString('es-MX', {
                      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleDownload(doc)}>
                    Descargar PDF
                  </Button>
                  {doc.estatus === 'emitido' && (
                    <Button size="sm" variant="destructive" onClick={() => handleCancel(doc.id)}>
                      Cancelar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
