'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Alert } from '@/components/ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Field } from '@/components/ui/field'
import { apiRequest } from '@/app/services/api'
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from '@/components/ui/table'

type GrupoCurso = { id: string; nombre: string; descripcion?: string | null; precio_base: number; precio_promocional?: number | null; estado?: string | null; items: Array<{ id: string; nombre: string }> }
type CursoAgenda = { id: string; codigo_curso: string; nombre: string; ciudad: string; fecha_inicio?: string | null; fecha_fin?: string | null; estado: string; empresa_contratante?: string | null; precio_base?: number; precio_promocional?: number | null; subcursos?: Array<{ id: string; codigo_curso: string; nombre: string; ciudad: string; fecha_inicio?: string | null; fecha_fin?: string | null; estado: string; empresa_contratante?: string | null; precio_base?: number; precio_promocional?: number | null }> }

export default function GestionClientePage() {
  const [grupos, setGrupos] = useState<GrupoCurso[]>([])
  const [cursos, setCursos] = useState<CursoAgenda[]>([])
  const [editCurso, setEditCurso] = useState<Record<string, { precio_base?: string; precio_promocional?: string }>>({})
  const [nuevoCurso, setNuevoCurso] = useState<{ nombre: string; grupo_id?: string; estado?: 'activo' | 'pendiente'; modalidad?: 'presencial' | 'virtual' | 'mixta'; ciudad: string; empresa_contratante: string; fecha_inicio: string; fecha_fin: string; precio_base: string; precio_promocional: string; vigencia_meses: string }>({ nombre: '', grupo_id: '', estado: 'pendiente', modalidad: 'presencial', ciudad: '', empresa_contratante: '', fecha_inicio: '', fecha_fin: '', precio_base: '', precio_promocional: '', vigencia_meses: '' })
  const [catalogo, setCatalogo] = useState<Array<{ id: string; nombre: string; ciudad: string | null; estado: string | null; modalidad: string; duracion_horas: number; vigencia_meses: number; precio: number }>>([])
  const [catalogoSel, setCatalogoSel] = useState('')
  const [nuevoConstancias, setNuevoConstancias] = useState<Array<{ nombre: string; norma?: string }>>([])
  const [nuevoConstNombre, setNuevoConstNombre] = useState('')
  const [nuevoConstNorma, setNuevoConstNorma] = useState('')
  const [cursoError, setCursoError] = useState<string>('')
  const [constanciaError, setConstanciaError] = useState<string>('')
  const [cursosError, setCursosError] = useState<string>('')
  const [authError] = useState<string>('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const fail = (field: string, msg: string) => { setFieldErrors({ [field]: msg }); setCursoError(msg) }


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

  const loadCatalogo = useCallback(async () => {
    try {
      const data = await apiRequest('/catalogo/cursos')
      setCatalogo(Array.isArray(data) ? data : [])
    } catch {
      setCatalogo([])
    }
  }, [])

  useEffect(() => { loadGrupos(); loadCursos(); loadCatalogo() }, [loadGrupos, loadCursos, loadCatalogo])

  const usarDelCatalogo = (id: string) => {
    setCatalogoSel(id)
    if (!id) return
    const c = catalogo.find(x => x.id === id)
    if (!c) return
    // Prefill editable: copia los datos, no modifica el catálogo.
    setNuevoCurso(s => ({
      ...s,
      nombre: c.nombre,
      ciudad: c.ciudad || s.ciudad,
      modalidad: (c.modalidad as 'presencial' | 'virtual' | 'mixta') || 'presencial',
      vigencia_meses: String(c.vigencia_meses || ''),
      precio_base: c.precio != null ? String(c.precio) : s.precio_base,
    }))
  }

  

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
    setCursoError('')
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
    setFieldErrors({})
    if (!nombre) { fail('nombre', 'Escribe el nombre del curso'); return }
    if (!ciudad) { fail('ciudad', 'Indica la ciudad'); return }
    if (!fi) { fail('fecha_inicio', 'Ingresa la fecha de inicio'); return }
    if (!ff) { fail('fecha_fin', 'Ingresa la fecha de término'); return }
    if (ff < fi) { fail('fecha_fin', 'Debe ser igual o posterior al inicio'); return }
    const payload: Record<string, unknown> = { nombre, ciudad, empresa_contratante: (nuevoCurso.empresa_contratante || '').trim() }
    // Las fechas se envían siempre que estén capturadas; el backend deriva
    // el estado (en_espera/activo) a partir de ellas e ignora el 'estado' del form.
    if (fi) payload.fecha_inicio = fi
    if (ff) payload.fecha_fin = ff
    const precioBaseStr = (nuevoCurso.precio_base || '').trim()
    const precioPromoStr = (nuevoCurso.precio_promocional || '').trim()
    if (precioBaseStr) { const n = Number(precioBaseStr); if (Number.isFinite(n) && n >= 0) payload.precio_base = n }
    if (precioPromoStr) { const n = Number(precioPromoStr); if (Number.isFinite(n) && n >= 0) payload.precio_promocional = n }
    const vigStr = (nuevoCurso.vigencia_meses || '').trim()
    if (!vigStr) { fail('vigencia_meses', 'Ingresa la vigencia en meses'); return }
    { const n = Number(vigStr); if (!Number.isFinite(n) || n <= 0) { fail('vigencia_meses', 'Debe ser un número mayor a 0'); return } payload.vigencia_meses = n }
    const modalidad = (nuevoCurso.modalidad || 'presencial')
    payload.modalidad = modalidad
    if (catalogoSel) payload.catalogo_curso_id = catalogoSel
    if (nuevoCurso.grupo_id && nuevoCurso.grupo_id.trim()) payload.grupo_id = nuevoCurso.grupo_id.trim()
    if (nuevoConstancias.length > 0) payload.constancias = nuevoConstancias.map(c => ({ nombre: String(c.nombre).trim(), norma: String(c.norma || '').trim() || undefined }))
    try {
      await apiRequest('/clientes/cursos', { method: 'POST', body: JSON.stringify(payload) })
    } catch (e) {
      setCursoError((e as Error)?.message || 'No se pudo crear el curso')
      return
    }
    setCursoError('')
    setFieldErrors({})
    setNuevoCurso({ nombre: '', grupo_id: '', estado: 'pendiente', modalidad: 'presencial', ciudad: '', empresa_contratante: '', fecha_inicio: '', fecha_fin: '', precio_base: '', precio_promocional: '', vigencia_meses: '' })
    setCatalogoSel('')
    setNuevoConstancias([]); setNuevoConstNombre(''); setNuevoConstNorma('')
    await loadCursos()
  }

  const setCampo = (k: string, patch: Record<string, string>) => {
    setNuevoCurso(s => ({ ...s, ...patch }))
    if (fieldErrors[k]) setFieldErrors(e => { const n = { ...e }; delete n[k]; return n })
  }
  const err = (k: string) => fieldErrors[k]
  const inv = (k: string) => (fieldErrors[k] ? { 'aria-invalid': true as const, 'aria-describedby': `${k}-error`, className: 'border-[var(--destructive)]' } : {})

  return (
    <div className="space-y-6 px-4 py-4 lg:px-6 lg:py-6">
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
            {catalogo.length > 0 && (
              <Field label="Usar curso del catálogo (opcional)" htmlFor="catalogo" hint="Prellena el formulario; puedes editar los datos.">
              <Select value={catalogoSel} onValueChange={usarDelCatalogo}>
                <SelectTrigger id="catalogo" className="w-full">
                  <SelectValue placeholder={'Usar curso del catálogo (opcional) — prellena el formulario'} />
                </SelectTrigger>
                <SelectContent>
                  {catalogo.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nombre}{c.ciudad ? ` — ${c.ciudad}` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              </Field>
            )}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Field label="Nombre del curso" htmlFor="nombre" required error={err('nombre')}>
                <Input id="nombre" placeholder="Ej. Trabajos en alturas" value={nuevoCurso.nombre} onChange={(e) => setCampo('nombre', { nombre: e.target.value })} {...inv('nombre')} />
              </Field>
              <Field label="Modalidad" htmlFor="modalidad">
              <Select value={String(nuevoCurso.modalidad || 'presencial')} onValueChange={(val: string) => setNuevoCurso(s => ({ ...s, modalidad: (val as 'presencial' | 'virtual' | 'mixta') }))}>
                <SelectTrigger id="modalidad" className="w-full">
                  <SelectValue placeholder="Modalidad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="presencial">Presencial</SelectItem>
                  <SelectItem value="virtual">Virtual</SelectItem>
                  <SelectItem value="mixta">Mixta</SelectItem>
                </SelectContent>
              </Select>
              </Field>
              <Field label="Grupo (opcional)" htmlFor="grupo">
              <Select value={String(nuevoCurso.grupo_id || '')} onValueChange={(val: string) => setNuevoCurso(s => ({ ...s, grupo_id: val }))}>
                <SelectTrigger id="grupo" className="w-full">
                  <SelectValue placeholder={'Sin grupo'} />
                </SelectTrigger>
                <SelectContent>
                  {grupos.map(g => (<SelectItem key={g.id} value={g.id}>{g.nombre}</SelectItem>))}
                </SelectContent>
              </Select>
              </Field>
              <Field label="Estado" htmlFor="estado">
              <Select value={String(nuevoCurso.estado || 'pendiente')} onValueChange={(val: string) => setNuevoCurso(s => ({ ...s, estado: (val as 'activo' | 'pendiente') }))}>
                <SelectTrigger id="estado" className="w-full">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                </SelectContent>
              </Select>
              </Field>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Field label="Ciudad" htmlFor="ciudad" required error={err('ciudad')}>
                <Input id="ciudad" placeholder="Ej. Querétaro" value={nuevoCurso.ciudad} onChange={(e) => setCampo('ciudad', { ciudad: e.target.value })} {...inv('ciudad')} />
              </Field>
              <Field label="Empresa (opcional)" htmlFor="empresa">
                <Input id="empresa" placeholder="Empresa contratante" value={nuevoCurso.empresa_contratante} onChange={(e) => setNuevoCurso(s => ({ ...s, empresa_contratante: e.target.value }))} />
              </Field>
              <Field label="Fecha de inicio" htmlFor="fecha_inicio" required error={err('fecha_inicio')}>
                <Input id="fecha_inicio" type="date" value={nuevoCurso.fecha_inicio} onChange={(e) => setCampo('fecha_inicio', { fecha_inicio: e.target.value })} {...inv('fecha_inicio')} />
              </Field>
              <Field label="Fecha de término" htmlFor="fecha_fin" required error={err('fecha_fin')}>
                <Input id="fecha_fin" type="date" min={nuevoCurso.fecha_inicio || undefined} value={nuevoCurso.fecha_fin} onChange={(e) => setCampo('fecha_fin', { fecha_fin: e.target.value })} {...inv('fecha_fin')} />
              </Field>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Precio normal" htmlFor="precio_base" hint="MXN por participante">
                <Input id="precio_base" type="number" inputMode="decimal" step="0.01" min="0" placeholder="0.00" value={nuevoCurso.precio_base || ''} onChange={(e) => setNuevoCurso(s => ({ ...s, precio_base: e.target.value }))} />
              </Field>
              <Field label="Precio especial (opcional)" htmlFor="precio_promocional" hint="Promoción o convenio">
                <Input id="precio_promocional" type="number" inputMode="decimal" step="0.01" min="0" placeholder="0.00" value={nuevoCurso.precio_promocional || ''} onChange={(e) => setNuevoCurso(s => ({ ...s, precio_promocional: e.target.value }))} />
              </Field>
              <Field label="Vigencia (meses)" htmlFor="vigencia_meses" required error={err('vigencia_meses')} hint="Ej. 12 o 24">
                <Input id="vigencia_meses" type="number" inputMode="numeric" min="1" placeholder="12" value={nuevoCurso.vigencia_meses} onChange={(e) => setCampo('vigencia_meses', { vigencia_meses: e.target.value })} {...inv('vigencia_meses')} />
              </Field>
            </div>
          </div>
          <div className="space-y-2 mt-5 border-t pt-4">
            <div className="text-sm font-semibold">Constancias del curso</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:items-end">
              <Field label="Nombre de la constancia" htmlFor="const_nombre">
                <Input id="const_nombre" placeholder="Ej. DC-3 Trabajos en alturas" value={nuevoConstNombre} onChange={(e) => setNuevoConstNombre(e.target.value)} />
              </Field>
              <Field label="Norma / NOM (opcional)" htmlFor="const_norma">
                <Input id="const_norma" placeholder="NOM-009-STPS-2011" value={nuevoConstNorma} onChange={(e) => setNuevoConstNorma(e.target.value)} />
              </Field>
              <Button onClick={() => { const n = nuevoConstNombre.trim(); const norma = nuevoConstNorma.trim(); if (!n) { setConstanciaError('Ingresa un nombre para la constancia'); return } setConstanciaError(''); setNuevoConstancias(arr => [...arr, { nombre: n, norma: norma || undefined }]); setNuevoConstNombre(''); setNuevoConstNorma('') }}>Agregar constancia</Button>
            </div>
            {constanciaError && (
              <Alert className="alert-error">{constanciaError}</Alert>
            )}
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
          <div className="mt-5 flex gap-2">
            <Button onClick={crearCurso}>Crear curso</Button>
            <Button variant="outline" onClick={() => { setNuevoCurso({ nombre: '', grupo_id: '', estado: 'pendiente', ciudad: '', empresa_contratante: '', fecha_inicio: '', fecha_fin: '', precio_base: '', precio_promocional: '', vigencia_meses: '24' }); setCatalogoSel(''); setNuevoConstancias([]); setNuevoConstNombre(''); setNuevoConstNorma(''); setCursoError(''); setConstanciaError(''); setFieldErrors({}) }}>Limpiar</Button>
          </div>
          {cursoError && !Object.keys(fieldErrors).length && (
            <Alert className="alert-error mt-3">{cursoError}</Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mis cursos (próximos)</CardTitle>
        </CardHeader>
        <CardContent>
          {cursosError && (
            <Alert className="alert-error mb-3">{cursosError}</Alert>
          )}
          <div className="overflow-x-auto">
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
                  <TableCell className="whitespace-nowrap">{c.ciudad || '-'}</TableCell>
                  <TableCell className="whitespace-nowrap">{c.fecha_inicio ? String(c.fecha_inicio).slice(0,10) : '-'} → {c.fecha_fin ? String(c.fecha_fin).slice(0,10) : '-'}</TableCell>
                  <TableCell>
                    <Input type="number" step="0.01" value={editCurso[c.id]?.precio_base ?? ''} onChange={(e) => setEditCurso(s => ({ ...s, [c.id]: { ...(s[c.id] || {}), precio_base: e.target.value } }))} />
                  </TableCell>
                  <TableCell>
                    <Input type="number" step="0.01" value={editCurso[c.id]?.precio_promocional ?? ''} onChange={(e) => setEditCurso(s => ({ ...s, [c.id]: { ...(s[c.id] || {}), precio_promocional: e.target.value } }))} />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" className="w-24" onClick={() => saveCursoPrecio(c.id)}>Actualizar</Button>
                      <Button size="sm" variant="destructive" className="w-24" onClick={async () => { if (!confirm('¿Eliminar este curso?')) return; try { await apiRequest(`/clientes/cursos/${c.id}`, { method: 'DELETE' }); setCursosError(''); await loadCursos(); } catch (e) { setCursosError((e as Error)?.message || 'No se pudo eliminar el curso') } }}>Eliminar</Button>
                    </div>
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
          </div>
        </CardContent>
      </Card>

      
    </div>
  )
}
