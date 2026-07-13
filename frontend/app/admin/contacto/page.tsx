'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card, CardHeader, CardTitle, CardContent
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

type Contacto = {
  id: string
  nombre: string
  email: string
  empresa?: string
  asunto: string
  mensaje: string
  leido: boolean
  respondido: boolean
  fecha_creacion: string
  fecha_leido?: string
  notas_admin?: string
}

const asuntoColors: Record<string, string> = {
  soporte: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  ventas: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  integraciones: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  otros: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
}

export default function AdminContactoPage() {
  const [mensajes, setMensajes] = useState<Contacto[]>([])
  const [search, setSearch] = useState('')
  const [filtroAsunto, setFiltroAsunto] = useState('')
  const [selected, setSelected] = useState<Contacto | null>(null)
  const [open, setOpen] = useState(false)

  const token = typeof window !== 'undefined' ? localStorage.getItem('aaces_token') : null
  const headers = useMemo(() => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) h['Authorization'] = `Bearer ${token}`
    return h
  }, [token])

  const load = useCallback(async () => {
    try {
      let url = '/api/v1/admin/contacto?per_page=100'
      if (filtroAsunto) url += `&asunto=${filtroAsunto}`
      const r = await fetch(url, { headers })
      const data = await r.json()
      setMensajes(data.data ?? [])
    } catch {
      setMensajes([])
    }
  }, [headers, filtroAsunto])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return mensajes
    return mensajes.filter(m =>
      m.nombre.toLowerCase().includes(term) ||
      m.email.toLowerCase().includes(term) ||
      m.mensaje.toLowerCase().includes(term) ||
      (m.empresa && m.empresa.toLowerCase().includes(term))
    )
  }, [mensajes, search])

  const noLeidos = mensajes.filter(m => !m.leido).length

  const abrirMensaje = async (m: Contacto) => {
    setSelected(m)
    setOpen(true)
    if (!m.leido) {
      await fetch(`/api/v1/admin/contacto/${m.id}/status`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ leido: true }),
      })
      await load()
    }
  }

  const toggleRespondido = async (id: string, respondido: boolean) => {
    await fetch(`/api/v1/admin/contacto/${id}/status`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ respondido }),
    })
    await load()
    if (selected?.id === id) {
      setSelected(prev => prev ? { ...prev, respondido } : null)
    }
  }

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <Card className="mx-4 lg:mx-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Mensajes de contacto</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {noLeidos > 0 ? `${noLeidos} no leídos` : 'Todos leídos'}
            </p>
          </div>
          <div className="flex gap-2">
            <select
              value={filtroAsunto}
              onChange={(e) => setFiltroAsunto(e.target.value)}
              className="flex h-9 w-36 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Todos</option>
              <option value="soporte">Soporte</option>
              <option value="ventas">Ventas</option>
              <option value="integraciones">Integraciones</option>
              <option value="otros">Otros</option>
            </select>
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {filtered.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                No hay mensajes
              </p>
            ) : (
              filtered.map((m) => (
                <button
                  key={m.id}
                  onClick={() => abrirMensaje(m)}
                  className={`w-full text-left p-4 rounded-lg border transition-colors hover:bg-accent ${
                    !m.leido ? 'border-l-4 border-l-primary bg-accent/30' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{m.nombre}</span>
                        {!m.leido && (
                          <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                        )}
                        {m.respondido && (
                          <Badge variant="outline" className="text-xs">Respondido</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{m.email}</p>
                      <p className="text-sm mt-1 line-clamp-1">{m.mensaje}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${asuntoColors[m.asunto] || ''}`}>
                        {m.asunto}
                      </span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(m.fecha_creacion).toLocaleDateString('es-MX', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  Mensaje de {selected.nombre}
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${asuntoColors[selected.asunto] || ''}`}>
                    {selected.asunto}
                  </span>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Nombre</Label>
                    <p className="font-medium">{selected.nombre}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Email</Label>
                    <p className="font-medium">{selected.email}</p>
                  </div>
                  {selected.empresa && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Empresa</Label>
                      <p className="font-medium">{selected.empresa}</p>
                    </div>
                  )}
                  <div>
                    <Label className="text-xs text-muted-foreground">Asunto</Label>
                    <p className="font-medium capitalize">{selected.asunto}</p>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Mensaje</Label>
                  <div className="mt-1 p-3 rounded-lg bg-muted whitespace-pre-wrap text-sm">
                    {selected.mensaje}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Recibido: {new Date(selected.fecha_creacion).toLocaleString('es-MX')}
                  {selected.fecha_leido && ` · Leído: ${new Date(selected.fecha_leido).toLocaleString('es-MX')}`}
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button
                  variant={selected.respondido ? 'outline' : 'default'}
                  onClick={() => toggleRespondido(selected.id, !selected.respondido)}
                >
                  {selected.respondido ? 'Marcar como no respondido' : 'Marcar como respondido'}
                </Button>
                <Button variant="outline" onClick={() => {
                  window.location.href = `mailto:${selected.email}?subject=Re: ${selected.asunto} - AACES`
                }}>
                  Responder por email
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
