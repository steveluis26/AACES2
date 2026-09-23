'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Alert } from '@/components/ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Field } from '@/components/ui/field'
import { parseFecha } from '@/lib/utils'
import { toast } from 'sonner'
import { CalendarDays, FileCheck2, Library, Loader2, MapPin, Plus, ShieldCheck, X } from 'lucide-react'
import { apiRequest } from '@/app/services/api'
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from '@/components/ui/table'

type GrupoCurso = { id: string; nombre: string; descripcion?: string | null; precio_base: number; precio_promocional?: number | null; estado?: string | null; items: Array<{ id: string; nombre: string }> }
type CursoAgenda = { id: string; codigo_curso: string; nombre: string; ciudad: string; fecha_inicio?: string | null; fecha_fin?: string | null; estado: string; empresa_contratante?: string | null; precio_base?: number; precio_promocional?: number | null; subcursos?: Array<{ id: string; codigo_curso: string; nombre: string; ciudad: string; fecha_inicio?: string | null; fecha_fin?: string | null; estado: string; empresa_contratante?: string | null; precio_base?: number; precio_promocional?: number | null }> }

// Sección numerada del formulario (fuera del componente para no perder el foco al escribir)
function Paso({ n, titulo, desc, children, delay = 0 }: { n: number; titulo: string; desc?: string; children: React.ReactNode; delay?: number }) {
  return (
    <section
      className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 motion-safe:fill-mode-both"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-500 text-xs font-bold text-white">{n}</span>
        <div>
          <h3 className="text-sm font-semibold leading-7">{titulo}</h3>
          {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
        </div>
      </div>
      <div className="sm:pl-10">{children}</div>
    </section>
  )
}

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
  const [guardando, setGuardando] = useState(false)
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
      return false
    }
    setCursoError('')
    setFieldErrors({})
    setNuevoCurso({ nombre: '', grupo_id: '', estado: 'pendiente', modalidad: 'presencial', ciudad: '', empresa_contratante: '', fecha_inicio: '', fecha_fin: '', precio_base: '', precio_promocional: '', vigencia_meses: '' })
    setCatalogoSel('')
    setNuevoConstancias([]); setNuevoConstNombre(''); setNuevoConstNorma('')
    await loadCursos()
    return true
  }

  const setCampo = (k: string, patch: Record<string, string>) => {
    setNuevoCurso(s => ({ ...s, ...patch }))
    if (fieldErrors[k]) setFieldErrors(e => { const n = { ...e }; delete n[k]; return n })
  }
  const err = (k: string) => fieldErrors[k]
  const inv = (k: string) => (fieldErrors[k] ? { 'aria-invalid': true as const, 'aria-describedby': `${k}-error`, className: 'border-[var(--destructive)]' } : {})

  const fmtMXN = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
  const fechaLarga = (v: string) => {
    const d = parseFecha(v)
    return d ? d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : ''
  }
  const dias = (() => {
    const a = parseFecha(nuevoCurso.fecha_inicio), b = parseFecha(nuevoCurso.fecha_fin)
    if (!a || !b || b < a) return 0
    return Math.round((b.getTime() - a.getTime()) / 86400000) + 1
  })()
  const agregarConstancia = () => {
    const n = nuevoConstNombre.trim(); const norma = nuevoConstNorma.trim()
    if (!n) { setConstanciaError('Escribe el nombre de la constancia'); return }
    setConstanciaError('')
    setNuevoConstancias(arr => [...arr, { nombre: n, norma: norma || undefined }])
    setNuevoConstNombre(''); setNuevoConstNorma('')
  }
  const limpiar = () => {
    setNuevoCurso({ nombre: '', grupo_id: '', estado: 'pendiente', modalidad: 'presencial', ciudad: '', empresa_contratante: '', fecha_inicio: '', fecha_fin: '', precio_base: '', precio_promocional: '', vigencia_meses: '' })
    setCatalogoSel(''); setNuevoConstancias([]); setNuevoConstNombre(''); setNuevoConstNorma(''); setCursoError(''); setConstanciaError(''); setFieldErrors({})
  }
  const enviar = async () => {
    if (guardando) return
    setGuardando(true)
    const ok = await crearCurso()
    setGuardando(false)
    if (ok) toast.success('Curso creado', { description: 'Ya aparece en tu agenda.' })
  }

  const conSufijo = (sufijo: string, input: React.ReactNode, prefijo?: string) => (
    <div className="relative">
      {prefijo && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{prefijo}</span>}
      {input}
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{sufijo}</span>
    </div>
  )

  const modalidadColor: Record<string, string> = {
    presencial: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    virtual: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    mixta: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  }

  const periodo = (fi?: string | null, ff?: string | null) => {
    const f = (v?: string | null) => { const d = parseFecha(v ? String(v).slice(0, 10) : null); return d ? d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : '-' }
    return fi && ff && String(fi).slice(0, 10) === String(ff).slice(0, 10) ? f(fi) : `${f(fi)} – ${f(ff)}`
  }
  const precioInput = (id: string, key: 'precio_base' | 'precio_promocional') => (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
      <Input
        type="number" inputMode="decimal" step="0.01" min="0" className="pl-6"
        aria-label={key === 'precio_base' ? 'Precio normal' : 'Precio especial'}
        value={editCurso[id]?.[key] ?? ''}
        onChange={(e) => setEditCurso(s => ({ ...s, [id]: { ...(s[id] || {}), [key]: e.target.value } }))}
      />
    </div>
  )
  const actualizarPrecio = async (id: string) => {
    try { await saveCursoPrecio(id); toast.success('Precios actualizados') }
    catch (e) { setCursosError((e as Error)?.message || 'No se pudieron actualizar los precios') }
  }
  const eliminarCurso = async (id: string) => {
    if (!confirm('¿Eliminar este curso?')) return
    try { await apiRequest(`/clientes/cursos/${id}`, { method: 'DELETE' }); setCursosError(''); await loadCursos(); toast.success('Curso eliminado') }
    catch (e) { setCursosError((e as Error)?.message || 'No se pudo eliminar el curso') }
  }

  return (
    <div className="space-y-6 px-4 py-4 lg:px-6 lg:py-6">
      {authError && (
        <Alert className="alert-warning">
          {authError}
        </Alert>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Gestión de cursos</h1>
          <p className="mt-1 text-sm text-muted-foreground">Registra un curso nuevo con sus fechas, precio y las constancias que emitirá.</p>
        </div>
        <Button variant="secondary" onClick={() => { window.location.href = '/cliente/cursos' }}>
          <CalendarDays className="h-4 w-4" /> Ir a agenda
        </Button>
      </div>

      <form
        noValidate
        onSubmit={(e) => { e.preventDefault(); enviar() }}
        className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start"
      >
        <Card className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
          <CardHeader className="pb-6">
            <CardTitle>Registrar curso</CardTitle>
          </CardHeader>
          <CardContent className="space-y-8">
            {catalogo.length > 0 && (
              <div className="flex flex-col gap-3 rounded-xl border border-dashed border-orange-300 bg-orange-50/60 p-4 dark:border-orange-500/30 dark:bg-orange-500/5 sm:flex-row sm:items-center">
                <Library className="h-5 w-5 shrink-0 text-orange-500" />
                <div className="flex-1">
                  <p className="text-sm font-medium">¿Ya lo tienes en tu catálogo?</p>
                  <p className="text-xs text-muted-foreground">Elígelo y prellenamos el formulario. Puedes ajustar los datos.</p>
                </div>
                <Select value={catalogoSel} onValueChange={usarDelCatalogo}>
                  <SelectTrigger id="catalogo" aria-label="Curso del catálogo" className="w-full bg-background sm:w-64">
                    <SelectValue placeholder="Elegir del catálogo" />
                  </SelectTrigger>
                  <SelectContent>
                    {catalogo.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.nombre}{c.ciudad ? ` — ${c.ciudad}` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Paso n={1} titulo="Datos del curso" desc="Así aparecerá en constancias y reportes." delay={50}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nombre del curso" htmlFor="nombre" required error={err('nombre')} className="sm:col-span-2">
                  <Input id="nombre" placeholder="Ej. Trabajos en alturas NOM-009" value={nuevoCurso.nombre} onChange={(e) => setCampo('nombre', { nombre: e.target.value })} {...inv('nombre')} />
                </Field>
                <Field label="Modalidad" htmlFor="modalidad">
                  <div id="modalidad" role="radiogroup" aria-label="Modalidad" className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
                    {(['presencial', 'virtual', 'mixta'] as const).map(m => (
                      <button
                        key={m}
                        type="button"
                        role="radio"
                        aria-checked={nuevoCurso.modalidad === m}
                        onClick={() => setNuevoCurso(s => ({ ...s, modalidad: m }))}
                        className={`rounded-md px-2 py-1.5 text-sm capitalize transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${nuevoCurso.modalidad === m ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Grupo (opcional)" htmlFor="grupo" hint={grupos.length === 0 ? 'Aún no tienes grupos de cursos.' : undefined}>
                  <Select value={String(nuevoCurso.grupo_id || '')} onValueChange={(val: string) => setNuevoCurso(s => ({ ...s, grupo_id: val }))} disabled={grupos.length === 0}>
                    <SelectTrigger id="grupo" className="w-full"><SelectValue placeholder="Sin grupo" /></SelectTrigger>
                    <SelectContent>
                      {grupos.map(g => (<SelectItem key={g.id} value={g.id}>{g.nombre}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </Paso>

            <Paso n={2} titulo="Lugar y fechas" desc="El estado del curso se calcula con las fechas." delay={120}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Ciudad" htmlFor="ciudad" required error={err('ciudad')}>
                  <Input id="ciudad" placeholder="Ej. Querétaro" value={nuevoCurso.ciudad} onChange={(e) => setCampo('ciudad', { ciudad: e.target.value })} {...inv('ciudad')} />
                </Field>
                <Field label="Empresa contratante (opcional)" htmlFor="empresa">
                  <Input id="empresa" placeholder="Razón social del cliente" value={nuevoCurso.empresa_contratante} onChange={(e) => setNuevoCurso(s => ({ ...s, empresa_contratante: e.target.value }))} />
                </Field>
                <Field label="Fecha de inicio" htmlFor="fecha_inicio" required error={err('fecha_inicio')}>
                  <Input id="fecha_inicio" type="date" value={nuevoCurso.fecha_inicio} onChange={(e) => setCampo('fecha_inicio', { fecha_inicio: e.target.value })} {...inv('fecha_inicio')} />
                </Field>
                <Field label="Fecha de término" htmlFor="fecha_fin" required error={err('fecha_fin')} hint={dias > 0 ? `Duración: ${dias} ${dias === 1 ? 'día' : 'días'}` : undefined}>
                  <Input id="fecha_fin" type="date" min={nuevoCurso.fecha_inicio || undefined} value={nuevoCurso.fecha_fin} onChange={(e) => setCampo('fecha_fin', { fecha_fin: e.target.value })} {...inv('fecha_fin')} />
                </Field>
              </div>
            </Paso>

            <Paso n={3} titulo="Precio y vigencia" desc="La vigencia define cuándo vence la constancia y cuándo avisamos para renovar." delay={190}>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Precio normal" htmlFor="precio_base">
                  {conSufijo('MXN', <Input id="precio_base" type="number" inputMode="decimal" step="0.01" min="0" placeholder="0.00" className="pl-7 pr-12" value={nuevoCurso.precio_base || ''} onChange={(e) => setNuevoCurso(s => ({ ...s, precio_base: e.target.value }))} />, '$')}
                </Field>
                <Field label="Precio especial (opcional)" htmlFor="precio_promocional" hint="Promoción o convenio">
                  {conSufijo('MXN', <Input id="precio_promocional" type="number" inputMode="decimal" step="0.01" min="0" placeholder="0.00" className="pl-7 pr-12" value={nuevoCurso.precio_promocional || ''} onChange={(e) => setNuevoCurso(s => ({ ...s, precio_promocional: e.target.value }))} />, '$')}
                </Field>
                <Field label="Vigencia" htmlFor="vigencia_meses" required error={err('vigencia_meses')}>
                  {conSufijo('meses', <Input id="vigencia_meses" type="number" inputMode="numeric" min="1" placeholder="12" className="pr-14" value={nuevoCurso.vigencia_meses} onChange={(e) => setCampo('vigencia_meses', { vigencia_meses: e.target.value })} {...inv('vigencia_meses')} />)}
                </Field>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {[12, 24, 36].map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setCampo('vigencia_meses', { vigencia_meses: String(m) })}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors duration-200 ${nuevoCurso.vigencia_meses === String(m) ? 'border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400' : 'hover:bg-muted'}`}
                  >
                    {m} meses
                  </button>
                ))}
              </div>
            </Paso>

            <Paso n={4} titulo="Constancias" desc="Documentos que recibirá cada participante. Puedes agregar varias." delay={260}>
              <div className="grid gap-3 sm:grid-cols-[1fr_200px_auto] sm:items-end">
                <Field label="Nombre de la constancia" htmlFor="const_nombre" error={constanciaError || undefined}>
                  <Input id="const_nombre" placeholder="Ej. DC-3 Trabajos en alturas" value={nuevoConstNombre}
                    onChange={(e) => { setNuevoConstNombre(e.target.value); if (constanciaError) setConstanciaError('') }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarConstancia() } }} />
                </Field>
                <Field label="Norma / NOM (opcional)" htmlFor="const_norma">
                  <Input id="const_norma" placeholder="NOM-009-STPS-2011" value={nuevoConstNorma}
                    onChange={(e) => setNuevoConstNorma(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarConstancia() } }} />
                </Field>
                <Button type="button" variant="outline" onClick={agregarConstancia} className={constanciaError ? 'sm:mb-5' : undefined}>
                  <Plus className="h-4 w-4" /> Agregar
                </Button>
              </div>
              {nuevoConstancias.length > 0 ? (
                <ul className="mt-4 space-y-2">
                  {nuevoConstancias.map((c, idx) => (
                    <li key={`${c.nombre}-${idx}`} className="flex items-center gap-3 rounded-lg border bg-background px-3 py-2 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-200">
                      <FileCheck2 className="h-4 w-4 shrink-0 text-orange-500" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{c.nombre}</p>
                        {c.norma && <p className="truncate text-xs text-muted-foreground">{c.norma}</p>}
                      </div>
                      <button type="button" onClick={() => setNuevoConstancias(arr => arr.filter((_, i) => i !== idx))} aria-label={`Quitar ${c.nombre}`}
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10">
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">Sin constancias todavía. También puedes agregarlas después desde la agenda.</p>
              )}
            </Paso>
          </CardContent>
        </Card>

        {/* Resumen en vivo */}
        <aside className="lg:sticky lg:top-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-2 motion-safe:duration-500">
          <Card className="overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-orange-500 to-orange-400" />
            <CardHeader className="pb-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Resumen</p>
              <CardTitle className={`text-lg leading-snug transition-colors ${nuevoCurso.nombre ? '' : 'text-muted-foreground'}`}>
                {nuevoCurso.nombre || 'Nombre del curso'}
              </CardTitle>
              <div className="pt-1">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${modalidadColor[nuevoCurso.modalidad || 'presencial']}`}>
                  {nuevoCurso.modalidad || 'presencial'}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span className={nuevoCurso.ciudad ? '' : 'text-muted-foreground'}>
                  {nuevoCurso.ciudad || 'Ciudad'}{nuevoCurso.empresa_contratante ? ` · ${nuevoCurso.empresa_contratante}` : ''}
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span className={nuevoCurso.fecha_inicio ? '' : 'text-muted-foreground'}>
                  {nuevoCurso.fecha_inicio ? `${fechaLarga(nuevoCurso.fecha_inicio)}${nuevoCurso.fecha_fin && nuevoCurso.fecha_fin !== nuevoCurso.fecha_inicio ? ` – ${fechaLarga(nuevoCurso.fecha_fin)}` : ''}` : 'Fechas'}
                  {dias > 0 && <span className="text-muted-foreground"> · {dias} {dias === 1 ? 'día' : 'días'}</span>}
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span className={nuevoCurso.vigencia_meses ? '' : 'text-muted-foreground'}>
                  {nuevoCurso.vigencia_meses ? `Vigencia de ${nuevoCurso.vigencia_meses} meses` : 'Vigencia'}
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span className={nuevoConstancias.length ? '' : 'text-muted-foreground'}>
                  {nuevoConstancias.length ? `${nuevoConstancias.length} ${nuevoConstancias.length === 1 ? 'constancia' : 'constancias'}` : 'Sin constancias'}
                </span>
              </div>
              <div className="flex items-end justify-between border-t pt-3">
                <span className="text-muted-foreground">Precio</span>
                <div className="text-right">
                  {nuevoCurso.precio_promocional ? (
                    <>
                      <div className="text-xs text-muted-foreground line-through">{fmtMXN.format(Number(nuevoCurso.precio_base || 0))}</div>
                      <div className="text-xl font-semibold text-orange-600">{fmtMXN.format(Number(nuevoCurso.precio_promocional))}</div>
                    </>
                  ) : (
                    <div className="text-xl font-semibold">{fmtMXN.format(Number(nuevoCurso.precio_base || 0))}</div>
                  )}
                </div>
              </div>

              {cursoError && !Object.keys(fieldErrors).length && (
                <Alert className="alert-error">{cursoError}</Alert>
              )}
              {Object.keys(fieldErrors).length > 0 && (
                <p role="alert" className="text-xs text-[var(--destructive)]">Revisa los campos marcados en el formulario.</p>
              )}

              <div className="flex flex-col gap-2 pt-1">
                <Button type="submit" disabled={guardando} className="w-full transition-transform active:scale-[0.98]">
                  {guardando ? <><Loader2 className="h-4 w-4 animate-spin" /> Creando…</> : 'Crear curso'}
                </Button>
                <Button type="button" variant="ghost" onClick={limpiar} className="w-full">Limpiar</Button>
              </div>
            </CardContent>
          </Card>
        </aside>
      </form>

      <Card className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Mis cursos (próximos)</CardTitle>
          {cursos.length > 0 && <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-semibold text-orange-700 dark:bg-orange-500/10 dark:text-orange-400">{cursos.length}</span>}
        </CardHeader>
        <CardContent>
          {cursosError && (
            <Alert className="alert-error mb-3">{cursosError}</Alert>
          )}
          {cursos.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-10 text-center">
              <CalendarDays className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm font-medium">No hay cursos próximos</p>
              <p className="text-xs text-muted-foreground">Los cursos que registres arriba aparecerán aquí.</p>
            </div>
          ) : (
          <>
          {/* Escritorio: tabla */}
          <div className="hidden overflow-x-auto md:block">
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
                <TableRow key={c.id} className="transition-colors">
                  <TableCell className="min-w-[200px]">
                    <div className="font-medium">{c.nombre}</div>
                    <div className="text-xs text-muted-foreground">{c.codigo_curso}</div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{c.ciudad || '-'}</TableCell>
                  <TableCell className="whitespace-nowrap">{periodo(c.fecha_inicio, c.fecha_fin)}</TableCell>
                  <TableCell className="min-w-[120px]">{precioInput(c.id, 'precio_base')}</TableCell>
                  <TableCell className="min-w-[120px]">{precioInput(c.id, 'precio_promocional')}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" className="w-24" onClick={() => actualizarPrecio(c.id)}>Actualizar</Button>
                      <Button size="sm" variant="destructive" className="w-24" onClick={() => eliminarCurso(c.id)}>Eliminar</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            </Table>
          </div>

          {/* Móvil: tarjetas */}
          <ul className="space-y-3 md:hidden">
            {cursos.map(c => (
              <li key={c.id} className="rounded-xl border p-4">
                <div className="font-medium">{c.nombre}</div>
                <div className="text-xs text-muted-foreground">{c.codigo_curso}</div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{c.ciudad || '-'}</span>
                  <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{periodo(c.fecha_inicio, c.fecha_fin)}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <label className="grid gap-1 text-xs font-medium text-muted-foreground">Precio normal{precioInput(c.id, 'precio_base')}</label>
                  <label className="grid gap-1 text-xs font-medium text-muted-foreground">Precio especial{precioInput(c.id, 'precio_promocional')}</label>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button size="sm" onClick={() => actualizarPrecio(c.id)}>Actualizar</Button>
                  <Button size="sm" variant="destructive" onClick={() => eliminarCurso(c.id)}>Eliminar</Button>
                </div>
              </li>
            ))}
          </ul>
          </>
          )}
        </CardContent>
      </Card>

      
    </div>
  )
}
