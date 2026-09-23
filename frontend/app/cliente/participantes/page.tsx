'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Alert } from '@/components/ui'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from '@/components/ui/table'
import { ChevronRight } from 'lucide-react'
import { Field } from '@/components/ui/field'
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
  const [crearError, setCrearError] = useState('')

  const load = useCallback(async (query = '') => {
    try {
      const data = await apiRequest<ParticipanteListado[]>(`/participantes?q=${encodeURIComponent(query)}`)
      setParticipantes(Array.isArray(data) ? data : [])
    } catch { setParticipantes([]) }
  }, [])

  useEffect(() => { load() }, [load])

  const buscarDuplicados = async (): Promise<typeof duplicados> => {
    try {
      const params = new URLSearchParams()
      if (nombre) params.set('nombre', nombre)
      if (correo) params.set('correo', correo)
      if (telefono) params.set('telefono', telefono)
      const data = await apiRequest<{ posibles_duplicados: typeof duplicados }>(`/participantes/posibles-duplicados?${params}`)
      const found = data.posibles_duplicados?.filter(d => d.score >= 50) ?? []
      setDuplicados(found)
      return found
    } catch { setDuplicados([]); return [] }
  }

  // Antes se creaba aunque hubiera duplicados; ahora se detiene y deja decidir.
  const guardar = async (forzar = false) => {
    if (!nombre.trim()) return
    if (!forzar) {
      setCreando(true)
      const found = await buscarDuplicados()
      setCreando(false)
      if (found.length > 0) return
    }
    crear()
  }

  const crear = async () => {
    if (!nombre.trim()) return
    setCreando(true)
    setCrearError('')
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
      setCrearError((e as Error)?.message || 'Error al crear participante')
    } finally { setCreando(false) }
  }

  const resetForm = () => {
    setNombre(''); setCorreo(''); setTelefono(''); setEmpresa(''); setCargo(''); setCiudadOrigen('')
  }

  return (
    <div className="space-y-6 px-4 py-4 lg:px-6 lg:py-6">
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Nombre completo" htmlFor="p_nombre" required>
                <Input id="p_nombre" autoComplete="name" placeholder="Nombre(s) y apellidos" value={nombre} onChange={e => { setNombre(e.target.value); setDuplicados([]) }} />
              </Field>
              <Field label="Correo" htmlFor="p_correo">
                <Input id="p_correo" type="email" autoComplete="email" placeholder="nombre@empresa.com" value={correo} onChange={e => { setCorreo(e.target.value); setDuplicados([]) }} />
              </Field>
              <Field label="Teléfono" htmlFor="p_tel">
                <Input id="p_tel" type="tel" autoComplete="tel" placeholder="10 dígitos" value={telefono} onChange={e => { setTelefono(e.target.value); setDuplicados([]) }} />
              </Field>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Empresa" htmlFor="p_empresa">
                <Input id="p_empresa" autoComplete="organization" value={empresa} onChange={e => setEmpresa(e.target.value)} />
              </Field>
              <Field label="Cargo" htmlFor="p_cargo">
                <Input id="p_cargo" value={cargo} onChange={e => setCargo(e.target.value)} />
              </Field>
              <Field label="Ciudad" htmlFor="p_ciudad">
                <Input id="p_ciudad" value={ciudadOrigen} onChange={e => setCiudadOrigen(e.target.value)} />
              </Field>
            </div>

            <div className="flex gap-2">
              <Button onClick={() => guardar()} disabled={creando || !nombre.trim()}>
                {creando ? 'Guardando...' : 'Guardar'}
              </Button>
              <Button variant="outline" onClick={resetForm}>Limpiar</Button>
            </div>
            {crearError && (<Alert className="alert-error">{crearError}</Alert>)}

            {duplicados.length > 0 && (
              <div className="border border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20 rounded p-3 space-y-2">
                <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">
                  Este participante podría ya existir. Revisa antes de crear uno nuevo.
                </p>
                {duplicados.map(d => (
                  <div key={d.id} className="flex items-center justify-between text-sm">
                    <span>{d.nombre} — {d.correo} <Badge variant="outline">{d.score}%</Badge></span>
                    <Button size="sm" variant="outline" onClick={() => router.push(`/cliente/participantes/${d.id}`)}>
                      Ver existente
                    </Button>
                  </div>
                ))}
                <Button size="sm" variant="ghost" onClick={() => guardar(true)} disabled={creando}>
                  No es la misma persona, crear de todos modos
                </Button>
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
          {/* Tarjetas en móvil */}
          <div className="md:hidden divide-y divide-border">
            {participantes.map(p => (
              <button key={p.id} type="button" onClick={() => router.push(`/cliente/participantes/${p.id}`)}
                className="w-full text-left p-4 flex items-center justify-between gap-3 hover:bg-muted/50">
                <div className="min-w-0">
                  <div className="font-medium truncate">{p.nombre}</div>
                  <div className="text-xs text-muted-foreground truncate">{p.correo || 'Sin correo'}</div>
                  {(p.empresa || p.cargo) && (
                    <div className="text-xs text-muted-foreground truncate">{[p.empresa, p.cargo].filter(Boolean).join(' · ')}</div>
                  )}
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <span className="font-mono text-xs">{p.pax_id}</span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </div>
              </button>
            ))}
            {participantes.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-8">
                No hay participantes registrados. Crea el primero.
              </div>
            )}
          </div>
          {/* Tabla en escritorio */}
          <div className="hidden md:block">
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
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
