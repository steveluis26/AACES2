'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from '@/components/ui'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from '@/components/ui/table'
import { apiRequest } from '@/app/services/api'

type ParticipanteListado = {
  id: string
  pax_id: string
  nombre: string
  correo: string | null
  telefono: string | null
  empresa: string | null
  cargo: string | null
  fecha_creacion: string | null
}

export default function ParticipantesPage() {
  const router = useRouter()
  const [participantes, setParticipantes] = useState<ParticipanteListado[]>([])
  const [q, setQ] = useState('')
  const [showForm, setShowForm] = useState(false)

  const [nombre, setNombre] = useState('')
  const [correo, setCorreo] = useState('')
  const [telefono, setTelefono] = useState('')
  const [empresa, setEmpresa] = useState('')
  const [cargo, setCargo] = useState('')
  const [ciudadOrigen, setCiudadOrigen] = useState('')

  const [duplicados, setDuplicados] = useState<{ id: string; pax_id: string; nombre: string; correo: string; score: number }[]>([])
  const [creando, setCreando] = useState(false)

  const load = useCallback(async (query = '') => {
    try {
      const data = await apiRequest<ParticipanteListado[]>(`/participantes?q=${encodeURIComponent(query)}`)
      setParticipantes(Array.isArray(data) ? data : [])
    } catch { setParticipantes([]) }
  }, [])

  useEffect(() => { load() }, [load])

  const buscarDuplicados = async () => {
    try {
      const params = new URLSearchParams()
      if (nombre) params.set('nombre', nombre)
      if (correo) params.set('correo', correo)
      if (telefono) params.set('telefono', telefono)
      const data = await apiRequest<{ posibles_duplicados: typeof duplicados }>(`/participantes/posibles-duplicados?${params}`)
      setDuplicados(data.posibles_duplicados?.filter(d => d.score >= 50) ?? [])
    } catch { setDuplicados([]) }
  }

  const crear = async () => {
    if (!nombre.trim()) return
    setCreando(true)
    try {
      const result = await apiRequest<{ id: string; pax_id: string }>('/participantes', {
        method: 'POST',
        body: JSON.stringify({ nombre, correo, telefono, empresa, cargo, ciudad_origen: ciudadOrigen }),
      })
      setShowForm(false)
      resetForm()
      setDuplicados([])
      load(q)
      router.push(`/cliente/participantes/${result.id}`)
    } catch (e) {
      alert((e as Error)?.message || 'Error al crear participante')
    } finally { setCreando(false) }
  }

  const resetForm = () => {
    setNombre(''); setCorreo(''); setTelefono(''); setEmpresa(''); setCargo(''); setCiudadOrigen('')
  }

  return (
    <div className="space-y-6 px-4 lg:px-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Participantes</h1>
        <Button onClick={() => { setShowForm(!showForm); setDuplicados([]) }}>
          {showForm ? 'Cancelar' : 'Nuevo participante'}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle>Registrar participante</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <Input placeholder="Nombre completo *" value={nombre} onChange={e => { setNombre(e.target.value); setDuplicados([]) }} />
              <Input placeholder="Correo" value={correo} onChange={e => { setCorreo(e.target.value); setDuplicados([]) }} />
              <Input placeholder="Teléfono" value={telefono} onChange={e => { setTelefono(e.target.value); setDuplicados([]) }} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <Input placeholder="Empresa" value={empresa} onChange={e => setEmpresa(e.target.value)} />
              <Input placeholder="Cargo" value={cargo} onChange={e => setCargo(e.target.value)} />
              <Input placeholder="Ciudad" value={ciudadOrigen} onChange={e => setCiudadOrigen(e.target.value)} />
            </div>

            <div className="flex gap-2">
              <Button onClick={async () => { await buscarDuplicados(); crear() }} disabled={creando || !nombre.trim()}>
                {creando ? 'Guardando...' : 'Guardar'}
              </Button>
              <Button variant="outline" onClick={resetForm}>Limpiar</Button>
            </div>

            {duplicados.length > 0 && (
              <div className="border border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20 rounded p-3 space-y-2">
                <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">
                  Posibles duplicados detectados
                </p>
                {duplicados.map(d => (
                  <div key={d.id} className="flex items-center justify-between text-sm">
                    <span>{d.nombre} — {d.correo} <Badge variant="outline">{d.score}%</Badge></span>
                    <Button size="sm" variant="outline" onClick={() => router.push(`/cliente/participantes/${d.id}`)}>
                      Ver existente
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2 max-w-md">
        <Input placeholder="Buscar por nombre, correo, teléfono o empresa" value={q} onChange={e => { setQ(e.target.value); load(e.target.value) }} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PAX</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Correo</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Cargo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {participantes.map(p => (
                <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/cliente/participantes/${p.id}`)}>
                  <TableCell className="font-mono text-xs">{p.pax_id}</TableCell>
                  <TableCell>{p.nombre}</TableCell>
                  <TableCell>{p.correo || '-'}</TableCell>
                  <TableCell>{p.telefono || '-'}</TableCell>
                  <TableCell>{p.empresa || '-'}</TableCell>
                  <TableCell>{p.cargo || '-'}</TableCell>
                </TableRow>
              ))}
              {participantes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-sm text-muted-foreground text-center py-8">
                    No hay participantes registrados. Crea el primero.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
