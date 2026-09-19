'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

type Participante = { id: string; nombre?: string; apellido?: string; nombres?: string; apellido_paterno?: string; apellido_materno?: string; correo: string; ciudad: string }

export default function AdminClienteParticipantesPage({ params }: { params: { id: string } }) {
  const [participantes, setParticipantes] = useState<Participante[]>([])
  const token = typeof window !== 'undefined' ? localStorage.getItem('aaces_token') : null
  const headers = useMemo(() => {
    const h: Record<string,string> = { 'Content-Type': 'application/json' }
    if (token) h['Authorization'] = `Bearer ${token}`
    return h
  }, [token])

  useEffect(() => {
    const load = async () => {
      const r = await fetch(`/api/v1/admin/clientes/${params.id}/participantes`, { headers })
      const data = await r.json()
      setParticipantes(data.data ?? [])
    }
    load()
  }, [params.id, headers])

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 lg:px-6">
        <h1 className="text-2xl font-semibold">Participantes del cliente</h1>
      </div>
      <div className="px-4 lg:px-6">
        <div className="grid-cards">
          {participantes.map(p => {
            const nombreCompleto = `${String(p.nombres ?? p.nombre ?? '').trim()} ${String(p.apellido_paterno ?? p.apellido ?? '').trim()} ${String(p.apellido_materno ?? '').trim()}`.trim()
            const initials = (() => {
              const parts = nombreCompleto.split(/\s+/).filter(Boolean)
              const a = (parts[0]?.[0] || '') + (parts[1]?.[0] || '')
              return (a || 'P').toUpperCase()
            })()
            return (
              <Card key={p.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10"><AvatarFallback>{initials}</AvatarFallback></Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{nombreCompleto || 'Sin nombre'}</div>
                      <div className="text-xs text-muted-foreground truncate">{p.correo || 'Sin correo'}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-gray-700">Ciudad</div>
                      <div className="text-gray-900">{p.ciudad || '—'}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
