'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

interface Constancia {
  id: string
  codigo_validacion: string
  estatus: string
  fecha_emision: string
  pdf_hash: string
  descarga_url: string
  participante_nombre: string
  curso_nombre: string
}

const ESTATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  emitido: 'default',
  cancelado: 'destructive',
  reemitido: 'secondary',
}

export default function ConstanciasPage() {
  const [constancias, setConstancias] = useState<Constancia[]>([])
  const [loading, setLoading] = useState(true)

  const fetchConstancias = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('aaces_token')
      const res = await fetch('/api/v1/constancias', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Error al cargar constancias')
      const data = await res.json()
      setConstancias(Array.isArray(data) ? data : [])
    } catch {
      toast.error('Error al cargar constancias')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchConstancias()
  }, [])

  const handleDownload = async (c: Constancia) => {
    try {
      const token = localStorage.getItem('aaces_token')
      const res = await fetch(c.descarga_url, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Error al descargar')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `constancia_${c.codigo_validacion}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Error al descargar la constancia')
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Constancias emitidas</h1>
          <p className="text-sm text-muted-foreground">
            Constancias de cursos emitidas con PDF verificable
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Cargando...</p>
      ) : constancias.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Sin constancias</CardTitle>
            <CardDescription>
              Aún no has emitido constancias. Ve a la sección Cursos, selecciona un curso con
              participantes acreditados y usa el botón "Emitir constancia".
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-3">
          {constancias.map((c) => (
            <Card key={c.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{c.participante_nombre || '—'}</span>
                    <Badge variant={ESTATUS_VARIANTS[c.estatus] || 'outline'}>
                      {c.estatus}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Curso: {c.curso_nombre || '—'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Código: {c.codigo_validacion}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(c.fecha_emision).toLocaleDateString('es-MX', {
                      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleDownload(c)}>
                    Descargar PDF
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
