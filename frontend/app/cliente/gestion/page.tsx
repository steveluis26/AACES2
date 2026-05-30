'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Alert } from '@/components/ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { apiRequest } from '@/app/services/api'
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from '@/components/ui/table'

type GrupoCurso = { id: string; nombre: string; descripcion?: string | null; precio_base: number; precio_promocional?: number | null; estado?: string | null; items: Array<{ id: string; nombre: string }> }
type CursoAgenda = { id: string; codigo_curso: string; nombre: string; ciudad: string; fecha_inicio?: string | null; fecha_fin?: string | null; estado: string; empresa_contratante?: string | null; precio_base?: number; precio_promocional?: number | null; subcursos?: Array<{ id: string; codigo_curso: string; nombre: string; ciudad: string; fecha_inicio?: string | null; fecha_fin?: string | null; estado: string; empresa_contratante?: string | null; precio_base?: number; precio_promocional?: number | null }> }

export default function GestionClientePage() {
  const [grupos, setGrupos] = useState<GrupoCurso[]>([])
  const [cursos, setCursos] = useState<CursoAgenda[]>([])
  const [editCurso, setEditCurso] = useState<Record<string, { precio_base?: string; precio_promocional?: string }>>({})
  const [nuevoCurso, setNuevoCurso] = useState<{ nombre: string; grupo_id?: string; estado?: 'activo' | 'pendiente'; modalidad?: 'presencial' | 'virtual'; ciudad: string; empresa_contratante: string; fecha_inicio: string; fecha_fin: string; precio_base: string; precio_promocional: string; vigencia_meses: string }>({ nombre: '', grupo_id: '', estado: 'pendiente', modalidad: 'presencial', ciudad: '', empresa_contratante: '', fecha_inicio: '', fecha_fin: '', precio_base: '', precio_promocional: '', vigencia_meses: '' })
  const [nuevoConstancias, setNuevoConstancias] = useState<Array<{ nombre: string; norma?: string }>>([])
  const [nuevoConstNombre, setNuevoConstNombre] = useState('')
  const [nuevoConstNorma, setNuevoConstNorma] = useState('')
  const [authError] = useState<string>('')


  const loadGrupos = useCallback(async () => {
    try {
      const data = await apiRequest('/clientes/grupos-curso')
      const list: GrupoCurso[] = Array.isArray(data) ? data : []
      setGrupos(list)
    } catch {
      setGrupos([])
    }
  }, [])

  const loadCursos = useCallback(async () => {
    try {
      const data = await apiRequest('/clientes/agenda/proximos')
      const list: CursoAgenda[] = Array.isArray(data) ? data : []
      setCursos(list)
      const next: Record<string, { precio_base?: string; precio_promocional?: string }> = {}
      list.forEach(c => { next[c.id] = { precio_base: String(c.precio_base ?? ''), precio_promocional: c.precio_promocional != null ? String(c.precio_promocional ?? '') : '' } })
      setEditCurso(next)
    } catch {
      setCursos([])
      setEditCurso({})
    }
  }, [])

  useEffect(() => { loadGrupos(); loadCursos() }, [loadGrupos, loadCursos])

  

  const saveCursoPrecio = async (id: string) => {
    const eb = (editCurso[id]?.precio_base || '').trim()
    const ep = (editCurso[id]?.precio_promocional || '').trim()
    const payload: Record<string, unknown> = {}
    if (eb) { const n = Number(eb); if (Number.isFinite(n) && n >= 0) payload.precio_base = n }
    if (ep) { const n = Number(ep); if (Number.isFinite(n) && n >= 0) payload.precio_promocional = n } else { payload.precio_promocional = null }
    await apiRequest(`/clientes/cursos/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
    await loadCursos()
  }

  const crearCurso = async () => {
    const nombre = (nuevoCurso.nombre || '').trim()
    const ciudad = (nuevoCurso.ciudad || '').trim()
    const norm = (s: unknown) => {
      const v = String(s ?? '').trim()
      if (!v) return ''
      const base = v.includes('T') ? v.split('T')[0] : v
      return base.length > 10 ? base.slice(0,10) : base
    }
    const fi = norm(nuevoCurso.fecha_inicio)
    const ff = norm(nuevoCurso.fecha_fin)
    if (!nombre || !ciudad) return
    if ((nuevoCurso.estado || 'pendiente') === 'activo' && !fi) { alert('Para estado Activo, debes asignar al menos la fecha de inicio'); return }
    const payload: Record<string, unknown> = { nombre, ciudad, empresa_contratante: (nuevoCurso.empresa_contratante || '').trim() }
    if ((nuevoCurso.estado || 'pendiente') === 'activo') {
      if (fi) payload.fecha_inicio = fi
      if (ff) payload.fecha_fin = ff
    }
    const precioBaseStr = (nuevoCurso.precio_base || '').trim()
    const precioPromoStr = (nuevoCurso.precio_promocional || '').trim()
    if (precioBaseStr) { const n = Number(precioBaseStr); if (Number.isFinite(n) && n >= 0) payload.precio_base = n }
    if (precioPromoStr) { const n = Number(precioPromoStr); if (Number.isFinite(n) && n >= 0) payload.precio_promocional = n }
    const vigStr = (nuevoCurso.vigencia_meses || '').trim()
    if (!vigStr) { alert('Ingresa la vigencia en meses'); return }
    { const n = Number(vigStr); if (!Number.isFinite(n) || n <= 0) { alert('La vigencia debe ser un número mayor a 0'); return } payload.vigencia_meses = n }
    const modalidad = (nuevoCurso.modalidad || 'presencial')
    payload.modalidad = modalidad
    if (nuevoCurso.grupo_id && nuevoCurso.grupo_id.trim()) payload.grupo_id = nuevoCurso.grupo_id.trim()
    if (nuevoConstancias.length > 0) payload.constancias = nuevoConstancias.map(c => ({ nombre: String(c.nombre).trim(), norma: String(c.norma || '').trim() || undefined }))
    try {
      await apiRequest('/clientes/cursos', { method: 'POST', body: JSON.stringify(payload) })
    } catch (e) {
      alert((e as Error)?.message || 'No se pudo crear el curso')
      return
    }
    setNuevoCurso({ nombre: '', grupo_id: '', estado: 'pendiente', modalidad: 'presencial', ciudad: '', empresa_contratante: '', fecha_inicio: '', fecha_fin: '', precio_base: '', precio_promocional: '', vigencia_meses: '' })
    setNuevoConstancias([]); setNuevoConstNombre(''); setNuevoConstNorma('')
    await loadCursos()
  }

  return (
    <div className="space-y-6 px-4 lg:px-6">
      {authError && (
        <Alert className="alert-warning">
          {authError}
        </Alert>
      )}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Gestión de cursos</h1>
        <Button variant="secondary" onClick={() => { window.location.href = '/cliente/cursos' }}>Ir a agenda</Button>
      </div>







      <Card>
        <CardHeader>
          <CardTitle>Registrar curso</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <Input placeholder="Nombre del curso" value={nuevoCurso.nombre} onChange={(e) => setNuevoCurso(s => ({ ...s, nombre: e.target.value }))} />
              <Select value={String(nuevoCurso.modalidad || 'presencial')} onValueChange={(val: string) => setNuevoCurso(s => ({ ...s, modalidad: (val as 'presencial' | 'virtual') }))}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Modalidad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="presencial">Presencial</SelectItem>
                  <SelectItem value="virtual">Virtual</SelectItem>
                </SelectContent>
              </Select>
              <Select value={String(nuevoCurso.grupo_id || '')} onValueChange={(val: string) => setNuevoCurso(s => ({ ...s, grupo_id: val }))}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={'Grupo (opcional)'} />
                </SelectTrigger>
                <SelectContent>
                  {grupos.map(g => (<SelectItem key={g.id} value={g.id}>{g.nombre}</SelectItem>))}
                </SelectContent>
              </Select>
              <Select value={String(nuevoCurso.estado || 'pendiente')} onValueChange={(val: string) => setNuevoCurso(s => ({ ...s, estado: (val as 'activo' | 'pendiente') }))}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <Input placeholder="Ciudad" value={nuevoCurso.ciudad} onChange={(e) => setNuevoCurso(s => ({ ...s, ciudad: e.target.value }))} />
              <Input placeholder="Empresa" value={nuevoCurso.empresa_contratante} onChange={(e) => setNuevoCurso(s => ({ ...s, empresa_contratante: e.target.value }))} />
              <Input type="date" placeholder="Inicio" value={nuevoCurso.fecha_inicio} onChange={(e) => setNuevoCurso(s => ({ ...s, fecha_inicio: e.target.value }))} disabled={(nuevoCurso.estado || 'pendiente') === 'pendiente'} />
              <Input type="date" placeholder="Fin" value={nuevoCurso.fecha_fin} onChange={(e) => setNuevoCurso(s => ({ ...s, fecha_fin: e.target.value }))} disabled={(nuevoCurso.estado || 'pendiente') === 'pendiente'} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <Input type="number" step="0.01" placeholder="Precio normal" value={nuevoCurso.precio_base || ''} onChange={(e) => setNuevoCurso(s => ({ ...s, precio_base: e.target.value }))} />
              <Input type="number" step="0.01" placeholder="Precio especial (opcional)" value={nuevoCurso.precio_promocional || ''} onChange={(e) => setNuevoCurso(s => ({ ...s, precio_promocional: e.target.value }))} />
              <Input type="number" placeholder="Vigencia (meses)" value={nuevoCurso.vigencia_meses} onChange={(e) => setNuevoCurso(s => ({ ...s, vigencia_meses: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-2 mt-3">
            <div className="text-sm font-semibold">Constancias del curso</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <Input placeholder="Nombre de constancia" value={nuevoConstNombre} onChange={(e) => setNuevoConstNombre(e.target.value)} />
              <Input placeholder="Norma/NOM (opcional)" value={nuevoConstNorma} onChange={(e) => setNuevoConstNorma(e.target.value)} />
              <Button onClick={() => { const n = nuevoConstNombre.trim(); const norma = nuevoConstNorma.trim(); if (!n) { alert('Ingresa un nombre'); return } setNuevoConstancias(arr => [...arr, { nombre: n, norma: norma || undefined }]); setNuevoConstNombre(''); setNuevoConstNorma('') }}>Agregar constancia</Button>
            </div>
            {nuevoConstancias.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {nuevoConstancias.map((c, idx) => (
                  <Badge key={`${c.nombre}-${idx}`} variant="secondary" className="flex items-center gap-2">
                    <span>{c.nombre}{c.norma ? ` (${c.norma})` : ''}</span>
                    <Button size="sm" variant="ghost" onClick={() => setNuevoConstancias(arr => arr.filter((_, i) => i !== idx))}>Eliminar</Button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <div className="mt-3 flex gap-2">
            <Button onClick={crearCurso}>Crear curso</Button>
            <Button variant="outline" onClick={() => { setNuevoCurso({ nombre: '', grupo_id: '', estado: 'pendiente', ciudad: '', empresa_contratante: '', fecha_inicio: '', fecha_fin: '', precio_base: '', precio_promocional: '', vigencia_meses: '24' }); setNuevoConstancias([]); setNuevoConstNombre(''); setNuevoConstNorma('') }}>Limpiar</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mis cursos (próximos)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Curso</TableHead>
                <TableHead>Ciudad</TableHead>
                <TableHead>Periodo</TableHead>
                <TableHead>Precio normal</TableHead>
                <TableHead>Precio especial</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cursos.map(c => (
                <TableRow key={c.id}>
                  <TableCell>{c.codigo_curso} · {c.nombre}</TableCell>
                  <TableCell>{c.ciudad || '-'}</TableCell>
                  <TableCell>{c.fecha_inicio ? String(c.fecha_inicio).slice(0,10) : '-'} → {c.fecha_fin ? String(c.fecha_fin).slice(0,10) : '-'}</TableCell>
                  <TableCell>
                    <Input type="number" step="0.01" value={editCurso[c.id]?.precio_base ?? ''} onChange={(e) => setEditCurso(s => ({ ...s, [c.id]: { ...(s[c.id] || {}), precio_base: e.target.value } }))} />
                  </TableCell>
                  <TableCell>
                    <Input type="number" step="0.01" value={editCurso[c.id]?.precio_promocional ?? ''} onChange={(e) => setEditCurso(s => ({ ...s, [c.id]: { ...(s[c.id] || {}), precio_promocional: e.target.value } }))} />
                  </TableCell>
                  <TableCell>
                    <Button size="sm" onClick={() => saveCursoPrecio(c.id)}>Actualizar</Button>
                    <Button size="sm" variant="destructive" className="ml-2" onClick={async () => { if (!confirm('¿Eliminar este curso?')) return; try { await apiRequest(`/clientes/cursos/${c.id}`, { method: 'DELETE' }); await loadCursos(); } catch (e) { alert((e as Error)?.message || 'No se pudo eliminar el curso') } }}>Eliminar</Button>
                  </TableCell>
                </TableRow>
              ))}
              {cursos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-sm">No hay cursos próximos.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      
    </div>
  )
}
