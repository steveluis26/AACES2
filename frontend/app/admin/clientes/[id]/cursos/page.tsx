'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui'

type Curso = { id: string; codigo_curso: string; nombre: string; ciudad: string; fecha_inicio: string; fecha_fin: string; estado: string; empresa_contratante: string }

export default function AdminClienteCursosPage({ params }: { params: { id: string } }) {
  const [cursos, setCursos] = useState<Curso[]>([])
  const token = typeof window !== 'undefined' ? localStorage.getItem('aaces_token') : null
  const headers = useMemo(() => {
    const h: Record<string,string> = { 'Content-Type': 'application/json' }
    if (token) h['Authorization'] = `Bearer ${token}`
    return h
  }, [token])

  useEffect(() => {
    const load = async () => {
      const r = await fetch(`/api/v1/admin/clientes/${params.id}/cursos`, { headers })
      const data = await r.json()
      setCursos(data.data ?? [])
    }
    load()
  }, [params.id, headers])

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 lg:px-6">
        <h1 className="text-2xl font-semibold">Cursos del cliente</h1>
      </div>
      <div className="px-4 lg:px-6 space-y-4">
        {cursos.map(c => (
          <Card key={c.id}>
            <CardHeader>
              <CardTitle>{c.codigo_curso} · {c.nombre}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div><span className="text-gray-700">Ciudad</span><div className="text-gray-900">{c.ciudad}</div></div>
                <div><span className="text-gray-700">Empresa</span><div className="text-gray-900">{c.empresa_contratante}</div></div>
                <div><span className="text-gray-700">Estado</span><div className="text-gray-900">{c.estado}</div></div>
                <div><span className="text-gray-700">Inicio</span><div className="text-gray-900">{c.fecha_inicio?.toString().slice(0,10)}</div></div>
                <div><span className="text-gray-700">Fin</span><div className="text-gray-900">{c.fecha_fin?.toString().slice(0,10)}</div></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
