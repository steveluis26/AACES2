'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Alert } from '@/components/ui'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Field } from '@/components/ui/field'
import { Affix, FormStep, QuickChips, Segmented, SwitchCard, textareaCls } from '@/components/forms/form-bits'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { toast } from 'sonner'
import { BadgeCheck, Check, Clock, Eye, EyeOff, Library, Loader2, MapPin, Package, Pencil, Plus, Search, ShieldCheck, Trash2 } from 'lucide-react'
import { apiRequest } from '@/app/services/api'

type CursoCatalogo = {
  id: string
  nombre: string
  descripcion: string | null
  duracion_horas: number
  vigencia_meses: number
  precio: number
  moneda: string
  ciudad: string | null
  estado: string | null
  modalidad: string
  publicado: boolean
  activo: boolean
  stps_registrado?: boolean
  stps_nombre?: string | null
}

type PaqueteCurso = { id: string; nombre: string; duracion_horas: number; vigencia_meses: number; precio: number }
type Paquete = {
  id: string
  nombre: string
  descripcion: string | null
  precio: number
  moneda: string
  publicado: boolean
  activo: boolean
  cursos: PaqueteCurso[]
}

const emptyCurso = { nombre: '', descripcion: '', duracion_horas: '8', vigencia_meses: '24', precio: '0', moneda: 'MXN', ciudad: '', estado: '', modalidad: 'presencial', publicado: false, stps_registrado: false, stps_nombre: '' }
const emptyPaquete = { nombre: '', descripcion: '', precio: '0', moneda: 'MXN', publicado: false, curso_ids: [] as string[] }

export default function CatalogoPage() {
  const reduce = useReducedMotion()
  const [tab, setTab] = useState<'cursos' | 'paquetes'>('cursos')
  const [cursos, setCursos] = useState<CursoCatalogo[]>([])
  const [paquetes, setPaquetes] = useState<Paquete[]>([])
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState<'todos' | 'publicados' | 'borradores'>('todos')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Form curso
  const [showFormCurso, setShowFormCurso] = useState(false)
  const [editCursoId, setEditCursoId] = useState<string | null>(null)
  const [formCurso, setFormCurso] = useState(emptyCurso)
  const [formCursoError, setFormCursoError] = useState('')
  const [guardandoCurso, setGuardandoCurso] = useState(false)

  // Form paquete
  const [showFormPaquete, setShowFormPaquete] = useState(false)
  const [editPaqueteId, setEditPaqueteId] = useState<string | null>(null)
  const [formPaquete, setFormPaquete] = useState(emptyPaquete)
  const [formPaqueteError, setFormPaqueteError] = useState('')
  const [guardandoPaquete, setGuardandoPaquete] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [c, p] = await Promise.all([
        apiRequest<CursoCatalogo[]>('/catalogo/cursos'),
        apiRequest<Paquete[]>('/catalogo/paquetes'),
      ])
      setCursos(Array.isArray(c) ? c : [])
      setPaquetes(Array.isArray(p) ? p : [])
    } catch (e) {
      setError((e as Error)?.message || 'No se pudo cargar el catálogo')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const pasaFiltro = (publicado: boolean) => filtro === 'todos' || (filtro === 'publicados' ? publicado : !publicado)
  const cursosFiltrados = cursos.filter(c =>
    pasaFiltro(c.publicado) && (
      !q.trim() || c.nombre.toLowerCase().includes(q.toLowerCase()) ||
      (c.descripcion || '').toLowerCase().includes(q.toLowerCase()))
  )
  const paquetesFiltrados = paquetes.filter(p =>
    pasaFiltro(p.publicado) && (!q.trim() || p.nombre.toLowerCase().includes(q.toLowerCase()))
  )

  // ---------------- Cursos ----------------

  const abrirNuevoCurso = () => {
    setEditCursoId(null)
    setFormCurso(emptyCurso)
    setFormCursoError('')
    setShowFormCurso(true)
  }

  const abrirEditarCurso = (c: CursoCatalogo) => {
    setEditCursoId(c.id)
    setFormCurso({
      nombre: c.nombre,
      descripcion: c.descripcion || '',
      duracion_horas: String(c.duracion_horas),
      vigencia_meses: String(c.vigencia_meses),
      precio: String(c.precio),
      moneda: c.moneda,
      ciudad: c.ciudad || '',
      estado: c.estado || '',
      modalidad: c.modalidad,
      publicado: c.publicado,
      stps_registrado: !!c.stps_registrado,
      stps_nombre: c.stps_nombre || '',
    })
    setFormCursoError('')
    setShowFormCurso(true)
  }

  const guardarCurso = async () => {
    if (!formCurso.nombre.trim()) {
      setFormCursoError('Escribe el nombre del curso')
      return
    }
    setGuardandoCurso(true)
    setFormCursoError('')
    try {
      const body = {
        nombre: formCurso.nombre.trim(),
        descripcion: formCurso.descripcion.trim() || null,
        duracion_horas: parseInt(formCurso.duracion_horas, 10) || 8,
        vigencia_meses: parseInt(formCurso.vigencia_meses, 10) || 24,
        precio: parseFloat(formCurso.precio) || 0,
        moneda: formCurso.moneda,
        ciudad: formCurso.ciudad.trim() || null,
        estado: formCurso.estado.trim() || null,
        modalidad: formCurso.modalidad,
        publicado: formCurso.publicado,
        stps_registrado: formCurso.stps_registrado,
        stps_nombre: formCurso.stps_nombre.trim() || null,
      }
      if (editCursoId) {
        await apiRequest(`/catalogo/cursos/${editCursoId}`, { method: 'PUT', body: JSON.stringify(body) })
      } else {
        await apiRequest('/catalogo/cursos', { method: 'POST', body: JSON.stringify(body) })
      }
      setShowFormCurso(false)
      toast.success(editCursoId ? 'Curso actualizado' : 'Curso agregado al catálogo')
      load()
    } catch (e) {
      setFormCursoError((e as Error)?.message || 'No se pudo guardar el curso')
    } finally {
      setGuardandoCurso(false)
    }
  }

  const togglePublicadoCurso = async (c: CursoCatalogo) => {
    try {
      await apiRequest(`/catalogo/cursos/${c.id}/publicar`, {
        method: 'PATCH',
        body: JSON.stringify({ publicado: !c.publicado }),
      })
      toast.success(c.publicado ? 'Curso oculto del directorio' : 'Curso publicado en el directorio')
      load()
    } catch (e) {
      setError((e as Error)?.message || 'No se pudo actualizar')
    }
  }

  const eliminarCurso = async (c: CursoCatalogo) => {
    if (!window.confirm(`¿Dar de baja "${c.nombre}" del catálogo? Los cursos programados no se afectan.`)) return
    try {
      await apiRequest(`/catalogo/cursos/${c.id}`, { method: 'DELETE' })
      toast.success('Curso dado de baja')
      load()
    } catch (e) {
      setError((e as Error)?.message || 'No se pudo eliminar')
    }
  }

  // ---------------- Paquetes ----------------

  const abrirNuevoPaquete = () => {
    setEditPaqueteId(null)
    setFormPaquete(emptyPaquete)
    setFormPaqueteError('')
    setShowFormPaquete(true)
  }

  const abrirEditarPaquete = (p: Paquete) => {
    setEditPaqueteId(p.id)
    setFormPaquete({
      nombre: p.nombre,
      descripcion: p.descripcion || '',
      precio: String(p.precio),
      moneda: p.moneda,
      publicado: p.publicado,
      curso_ids: p.cursos.map(c => c.id),
    })
    setFormPaqueteError('')
    setShowFormPaquete(true)
  }

  const toggleCursoEnPaquete = (id: string) => {
    setFormPaquete(f => ({
      ...f,
      curso_ids: f.curso_ids.includes(id) ? f.curso_ids.filter(x => x !== id) : [...f.curso_ids, id],
    }))
  }

  const guardarPaquete = async () => {
    if (!formPaquete.nombre.trim()) {
      setFormPaqueteError('Escribe el nombre del paquete')
      return
    }
    setGuardandoPaquete(true)
    setFormPaqueteError('')
    try {
      const body = {
        nombre: formPaquete.nombre.trim(),
        descripcion: formPaquete.descripcion.trim() || null,
        precio: parseFloat(formPaquete.precio) || 0,
        moneda: formPaquete.moneda,
        publicado: formPaquete.publicado,
        curso_ids: formPaquete.curso_ids,
      }
      if (editPaqueteId) {
        await apiRequest(`/catalogo/paquetes/${editPaqueteId}`, { method: 'PUT', body: JSON.stringify(body) })
      } else {
        await apiRequest('/catalogo/paquetes', { method: 'POST', body: JSON.stringify(body) })
      }
      setShowFormPaquete(false)
      toast.success(editPaqueteId ? 'Paquete actualizado' : 'Paquete creado')
      load()
    } catch (e) {
      setFormPaqueteError((e as Error)?.message || 'No se pudo guardar el paquete')
    } finally {
      setGuardandoPaquete(false)
    }
  }

  const togglePublicadoPaquete = async (p: Paquete) => {
    try {
      await apiRequest(`/catalogo/paquetes/${p.id}/publicar`, {
        method: 'PATCH',
        body: JSON.stringify({ publicado: !p.publicado }),
      })
      toast.success(p.publicado ? 'Paquete oculto del directorio' : 'Paquete publicado en el directorio')
      load()
    } catch (e) {
      setError((e as Error)?.message || 'No se pudo actualizar')
    }
  }

  const eliminarPaquete = async (p: Paquete) => {
    if (!window.confirm(`¿Dar de baja el paquete "${p.nombre}"?`)) return
    try {
      await apiRequest(`/catalogo/paquetes/${p.id}`, { method: 'DELETE' })
      toast.success('Paquete dado de baja')
      load()
    } catch (e) {
      setError((e as Error)?.message || 'No se pudo eliminar')
    }
  }

  const setFC = (k: string, v: string | boolean) => setFormCurso(f => ({ ...f, [k]: v }))
  const setFP = (k: string, v: string | boolean) => setFormPaquete(f => ({ ...f, [k]: v }))

  const fmt = (n: number, moneda = 'MXN') => new Intl.NumberFormat('es-MX', { style: 'currency', currency: moneda || 'MXN' }).format(Number(n) || 0)
  const sumaPaquete = cursos.filter(c => formPaquete.curso_ids.includes(c.id)).reduce((a, c) => a + Number(c.precio || 0), 0)
  const precioPaquete = parseFloat(formPaquete.precio) || 0
  const ahorro = sumaPaquete > 0 && precioPaquete > 0 && precioPaquete < sumaPaquete ? Math.round((1 - precioPaquete / sumaPaquete) * 100) : 0
  const modalidadColor: Record<string, string> = {
    presencial: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    virtual: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    mixta: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  }
  const EstadoPill = ({ publicado }: { publicado: boolean }) => (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${publicado ? 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${publicado ? 'bg-green-500' : 'bg-muted-foreground/60'}`} />
      {publicado ? 'Publicado' : 'Borrador'}
    </span>
  )
  const cardMotion = (i: number) => reduce ? {} : {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, scale: 0.97 },
    transition: { duration: 0.35, delay: Math.min(i, 8) * 0.04, ease: [0.22, 1, 0.36, 1] as const },
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Catálogo de cursos</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Define una vez los cursos que impartes y reutilízalos al programar. Marca como publicado lo que quieras mostrar en el directorio.</p>
        </div>
        <Button onClick={tab === 'cursos' ? abrirNuevoCurso : abrirNuevoPaquete} className="shrink-0 transition-transform active:scale-[0.98]">
          <Plus className="h-4 w-4" /> {tab === 'cursos' ? 'Nuevo curso' : 'Nuevo paquete'}
        </Button>
      </div>

      {error && <Alert className="alert-error">{error}</Alert>}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Segmented
          ariaLabel="Tipo de elemento"
          value={tab}
          onChange={(v) => setTab(v)}
          className="w-full sm:w-72"
          options={[
            { value: 'cursos', label: <span className="inline-flex items-center gap-1.5"><Library className="h-4 w-4" />Cursos <span className="rounded-full bg-orange-500/10 px-1.5 text-xs text-orange-500">{cursos.length}</span></span> },
            { value: 'paquetes', label: <span className="inline-flex items-center gap-1.5"><Package className="h-4 w-4" />Paquetes <span className="rounded-full bg-orange-500/10 px-1.5 text-xs text-orange-500">{paquetes.length}</span></span> },
          ]}
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Buscar en el catálogo" placeholder={tab === 'cursos' ? 'Buscar cursos…' : 'Buscar paquetes…'} value={q} onChange={e => setQ(e.target.value)} className="pl-9" />
          </div>
          <Segmented
            ariaLabel="Filtrar por estado"
            value={filtro}
            onChange={(v) => setFiltro(v)}
            options={[{ value: 'todos', label: 'Todos' }, { value: 'publicados', label: 'Publicados' }, { value: 'borradores', label: 'Borradores' }]}
          />
        </div>
      </div>

      {loading ? (
        <div className="grid-cards">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-48 animate-pulse rounded-xl border bg-muted/40" />
          ))}
        </div>
      ) : tab === 'cursos' ? (
        cursosFiltrados.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed py-14 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-500"><Library className="h-6 w-6" /></span>
            <div>
              <p className="font-medium">{q || filtro !== 'todos' ? 'Sin resultados' : 'Tu catálogo está vacío'}</p>
              <p className="mt-1 text-sm text-muted-foreground">{q || filtro !== 'todos' ? 'Prueba con otra búsqueda o filtro.' : 'Agrega los cursos que impartes para reutilizarlos al programar.'}</p>
            </div>
            {!q && filtro === 'todos' && <Button onClick={abrirNuevoCurso}><Plus className="h-4 w-4" /> Agregar primer curso</Button>}
          </div>
        ) : (
          <div className="grid-cards">
            <AnimatePresence mode="popLayout">
              {cursosFiltrados.map((c, i) => (
                <motion.div key={c.id} layout={!reduce} {...cardMotion(i)}>
                  <Card className="group flex h-full flex-col transition-all duration-300 hover:-translate-y-0.5 hover:border-orange-500/30 hover:shadow-md">
                    <CardHeader className="space-y-3 pb-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${modalidadColor[c.modalidad] || 'bg-muted'}`}>{c.modalidad}</span>
                        <span className="flex items-center gap-1.5">
                          {c.stps_registrado && <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-500/15 dark:text-green-400" title="Registrado ante la STPS"><BadgeCheck className="h-3 w-3" /> STPS</span>}
                          <EstadoPill publicado={c.publicado} />
                        </span>
                      </div>
                      <CardTitle className="line-clamp-2 text-base leading-snug">{c.nombre}</CardTitle>
                      {c.descripcion && <p className="line-clamp-2 text-sm text-muted-foreground">{c.descripcion}</p>}
                    </CardHeader>
                    <CardContent className="mt-auto space-y-4 text-sm">
                      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{c.duracion_horas} h</span>
                        <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" />{c.vigencia_meses} meses</span>
                        {(c.ciudad || c.estado) && <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{[c.ciudad, c.estado].filter(Boolean).join(', ')}</span>}
                      </div>
                      <div className="flex items-center justify-between gap-2 border-t pt-4">
                        <span className="text-lg font-semibold">{fmt(c.precio, c.moneda)}</span>
                        <div className="flex items-center gap-1">
                          <Button variant="outline" size="sm" onClick={() => abrirEditarCurso(c)}><Pencil className="h-3.5 w-3.5" /> Editar</Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title={c.publicado ? 'Ocultar del directorio' : 'Publicar en el directorio'} aria-label={c.publicado ? `Ocultar ${c.nombre}` : `Publicar ${c.nombre}`} onClick={() => togglePublicadoCurso(c)}>
                            {c.publicado ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10" title="Dar de baja" aria-label={`Dar de baja ${c.nombre}`} onClick={() => eliminarCurso(c)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )
      ) : (
        paquetesFiltrados.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed py-14 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-500"><Package className="h-6 w-6" /></span>
            <div>
              <p className="font-medium">{q || filtro !== 'todos' ? 'Sin resultados' : 'Aún no tienes paquetes'}</p>
              <p className="mt-1 text-sm text-muted-foreground">{q || filtro !== 'todos' ? 'Prueba con otra búsqueda o filtro.' : 'Agrupa cursos de tu catálogo con un precio especial.'}</p>
            </div>
            {!q && filtro === 'todos' && <Button onClick={abrirNuevoPaquete} disabled={cursos.length === 0}><Plus className="h-4 w-4" /> Crear paquete</Button>}
            {!q && filtro === 'todos' && cursos.length === 0 && <p className="text-xs text-muted-foreground">Primero agrega cursos a tu catálogo.</p>}
          </div>
        ) : (
          <div className="grid-cards">
            <AnimatePresence mode="popLayout">
              {paquetesFiltrados.map((p, i) => {
                const suma = p.cursos.reduce((a, c) => a + Number(c.precio || 0), 0)
                const pct = suma > 0 && p.precio < suma ? Math.round((1 - p.precio / suma) * 100) : 0
                return (
                  <motion.div key={p.id} layout={!reduce} {...cardMotion(i)}>
                    <Card className="group flex h-full flex-col transition-all duration-300 hover:-translate-y-0.5 hover:border-orange-500/30 hover:shadow-md">
                      <CardHeader className="space-y-3 pb-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/10 px-2 py-0.5 text-xs font-medium text-orange-500"><Package className="h-3 w-3" />{p.cursos.length} {p.cursos.length === 1 ? 'curso' : 'cursos'}</span>
                          <EstadoPill publicado={p.publicado} />
                        </div>
                        <CardTitle className="line-clamp-2 text-base leading-snug">{p.nombre}</CardTitle>
                        {p.descripcion && <p className="line-clamp-2 text-sm text-muted-foreground">{p.descripcion}</p>}
                      </CardHeader>
                      <CardContent className="mt-auto space-y-4 text-sm">
                        <div className="flex flex-wrap gap-1.5">
                          {p.cursos.map(c => <Badge key={c.id} variant="outline" className="font-normal">{c.nombre}</Badge>)}
                        </div>
                        <div className="flex items-center justify-between gap-2 border-t pt-4">
                          <div>
                            <span className="text-lg font-semibold">{fmt(p.precio, p.moneda)}</span>
                            {pct > 0 && <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-500/15 dark:text-green-400">Ahorro {pct}%</span>}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="outline" size="sm" onClick={() => abrirEditarPaquete(p)}><Pencil className="h-3.5 w-3.5" /> Editar</Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" title={p.publicado ? 'Ocultar del directorio' : 'Publicar en el directorio'} aria-label={p.publicado ? `Ocultar ${p.nombre}` : `Publicar ${p.nombre}`} onClick={() => togglePublicadoPaquete(p)}>
                              {p.publicado ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10" title="Dar de baja" aria-label={`Dar de baja ${p.nombre}`} onClick={() => eliminarPaquete(p)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )
      )}

      {/* Panel lateral: curso del catálogo */}
      <Sheet open={showFormCurso} onOpenChange={setShowFormCurso}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
          <form noValidate className="flex h-full flex-col" onSubmit={(e) => { e.preventDefault(); guardarCurso() }}>
            <SheetHeader className="border-b px-6 py-5 text-left">
              <SheetTitle>{editCursoId ? 'Editar curso del catálogo' : 'Nuevo curso del catálogo'}</SheetTitle>
              <SheetDescription>Estos datos se usan para prellenar el curso cuando lo programes.</SheetDescription>
            </SheetHeader>
            <div className="flex-1 space-y-8 overflow-y-auto px-6 py-6">
              <FormStep n={1} title="Datos del curso">
                <div className="grid gap-4">
                  <Field label="Nombre del curso" htmlFor="cc_nombre" required error={formCursoError && !formCurso.nombre.trim() ? formCursoError : undefined}>
                    <Input id="cc_nombre" autoFocus value={formCurso.nombre} onChange={e => { setFC('nombre', e.target.value); if (formCursoError) setFormCursoError('') }} placeholder="Ej. Trabajo en alturas" />
                  </Field>
                  <Field label="Descripción (opcional)" htmlFor="cc_desc" hint="Temario resumido y a quién va dirigido.">
                    <textarea id="cc_desc" rows={3} className={textareaCls} value={formCurso.descripcion} onChange={e => setFC('descripcion', e.target.value)} placeholder="Temario resumido, a quién va dirigido…" />
                  </Field>
                  <Field label="Modalidad" htmlFor="cc_modalidad">
                    <Segmented id="cc_modalidad" ariaLabel="Modalidad" value={formCurso.modalidad} onChange={v => setFC('modalidad', v)}
                      options={[{ value: 'presencial', label: 'Presencial' }, { value: 'virtual', label: 'Virtual' }, { value: 'mixta', label: 'Mixta' }]} />
                  </Field>
                </div>
              </FormStep>

              <FormStep n={2} title="Duración, vigencia y precio">
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Duración" htmlFor="cc_horas">
                    <Affix suffix="h"><Input id="cc_horas" type="number" inputMode="numeric" min={1} value={formCurso.duracion_horas} onChange={e => setFC('duracion_horas', e.target.value)} /></Affix>
                  </Field>
                  <Field label="Vigencia" htmlFor="cc_vig">
                    <Affix suffix="meses"><Input id="cc_vig" type="number" inputMode="numeric" min={1} value={formCurso.vigencia_meses} onChange={e => setFC('vigencia_meses', e.target.value)} /></Affix>
                  </Field>
                  <Field label="Precio" htmlFor="cc_precio">
                    <Affix prefix="$" suffix={formCurso.moneda}><Input id="cc_precio" type="number" inputMode="decimal" min={0} step="0.01" value={formCurso.precio} onChange={e => setFC('precio', e.target.value)} /></Affix>
                  </Field>
                </div>
                <QuickChips values={[12, 24, 36]} current={formCurso.vigencia_meses} onPick={v => setFC('vigencia_meses', v)} format={v => `${v} meses de vigencia`} />
              </FormStep>

              <FormStep n={3} title="Ubicación" desc="Útil para capacitación presencial y para el directorio.">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Ciudad" htmlFor="cc_ciudad">
                    <Input id="cc_ciudad" value={formCurso.ciudad} onChange={e => setFC('ciudad', e.target.value)} placeholder="Ej. Monterrey" />
                  </Field>
                  <Field label="Estado" htmlFor="cc_estado">
                    <Input id="cc_estado" value={formCurso.estado} onChange={e => setFC('estado', e.target.value)} placeholder="Ej. Nuevo León" />
                  </Field>
                </div>
              </FormStep>

              <SwitchCard id="cc_stps" checked={formCurso.stps_registrado} onChange={v => setFC('stps_registrado', v)} title="Registrado ante la STPS" desc="Este curso está en tu registro de agente capacitador. Aparece en el QR de tus DC-3 y AACES lo usa para revisar la congruencia." />
              {formCurso.stps_registrado && (
                <Field label="Nombre con el que está registrado" htmlFor="cc_stps_nombre" hint="Opcional: si en la STPS se llama distinto (p. ej. “PRIMEROS AUXILIOS NIVEL 1”).">
                  <Input id="cc_stps_nombre" value={formCurso.stps_nombre} onChange={e => setFC('stps_nombre', e.target.value)} />
                </Field>
              )}

              <SwitchCard id="cc_pub" checked={formCurso.publicado} onChange={v => setFC('publicado', v)} title="Publicar en el directorio" desc="Visible para empresas que buscan capacitación en el Marketplace." />

            </div>
            <SheetFooter className="flex-row flex-wrap items-center gap-2 border-t bg-background px-6 py-4 sm:justify-end">
              {formCursoError && formCurso.nombre.trim() && <p role="alert" className="w-full text-sm text-[var(--destructive)] sm:mr-auto sm:w-auto">{formCursoError}</p>}
              <Button type="button" variant="outline" className="flex-1 sm:flex-none" onClick={() => setShowFormCurso(false)}>Cancelar</Button>
              <Button type="submit" className="flex-1 sm:flex-none" disabled={guardandoCurso}>
                {guardandoCurso ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando…</> : editCursoId ? 'Guardar cambios' : 'Agregar al catálogo'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Panel lateral: paquete */}
      <Sheet open={showFormPaquete} onOpenChange={setShowFormPaquete}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
          <form noValidate className="flex h-full flex-col" onSubmit={(e) => { e.preventDefault(); guardarPaquete() }}>
            <SheetHeader className="border-b px-6 py-5 text-left">
              <SheetTitle>{editPaqueteId ? 'Editar paquete' : 'Nuevo paquete'}</SheetTitle>
              <SheetDescription>Agrupa cursos del catálogo y ofrécelos con un precio especial.</SheetDescription>
            </SheetHeader>
            <div className="flex-1 space-y-8 overflow-y-auto px-6 py-6">
              <FormStep n={1} title="Datos del paquete">
                <div className="grid gap-4">
                  <Field label="Nombre del paquete" htmlFor="pq_nombre" required error={formPaqueteError && !formPaquete.nombre.trim() ? formPaqueteError : undefined}>
                    <Input id="pq_nombre" autoFocus value={formPaquete.nombre} onChange={e => { setFP('nombre', e.target.value); if (formPaqueteError) setFormPaqueteError('') }} placeholder="Ej. Paquete alturas + espacios confinados" />
                  </Field>
                  <Field label="Descripción (opcional)" htmlFor="pq_desc">
                    <textarea id="pq_desc" rows={2} className={textareaCls} value={formPaquete.descripcion} onChange={e => setFP('descripcion', e.target.value)} />
                  </Field>
                </div>
              </FormStep>

              <FormStep n={2} title="Cursos incluidos" desc={`${formPaquete.curso_ids.length} seleccionados`}>
                {cursos.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Primero agrega cursos a tu catálogo.</p>
                ) : (
                  <div className="grid gap-2">
                    {cursos.map(c => {
                      const sel = formPaquete.curso_ids.includes(c.id)
                      return (
                        <button
                          key={c.id}
                          type="button"
                          role="checkbox"
                          aria-checked={sel}
                          onClick={() => toggleCursoEnPaquete(c.id)}
                          className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${sel ? 'border-orange-500/50 bg-orange-50/70 shadow-sm dark:bg-orange-500/5' : 'hover:bg-muted/50'}`}
                        >
                          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${sel ? 'border-orange-500 bg-orange-500 text-white' : 'border-input'}`}>
                            {sel && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{c.nombre}</span>
                            <span className="block text-xs text-muted-foreground">{c.duracion_horas} h · {c.vigencia_meses} meses</span>
                          </span>
                          <span className="text-sm text-muted-foreground">{fmt(c.precio, c.moneda)}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </FormStep>

              <FormStep n={3} title="Precio del paquete">
                <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
                  <Field label="Precio" htmlFor="pq_precio">
                    <Affix prefix="$" suffix={formPaquete.moneda}><Input id="pq_precio" type="number" inputMode="decimal" min={0} step="0.01" value={formPaquete.precio} onChange={e => setFP('precio', e.target.value)} /></Affix>
                  </Field>
                  <div className="rounded-xl border bg-muted/40 p-3 text-sm">
                    <div className="flex justify-between text-muted-foreground"><span>Por separado</span><span>{fmt(sumaPaquete, formPaquete.moneda)}</span></div>
                    <div className="mt-1 flex justify-between font-medium"><span>Precio paquete</span><span>{fmt(precioPaquete, formPaquete.moneda)}</span></div>
                    <AnimatePresence>
                      {ahorro > 0 && (
                        <motion.div initial={reduce ? false : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                          <div className="mt-2 rounded-md bg-green-100 px-2 py-1 text-center text-xs font-semibold text-green-700 dark:bg-green-500/15 dark:text-green-400">Tus clientes ahorran {ahorro}%</div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </FormStep>

              <SwitchCard id="pq_pub" checked={formPaquete.publicado} onChange={v => setFP('publicado', v)} title="Publicar en el directorio" desc="Visible para empresas en el Marketplace." />

            </div>
            <SheetFooter className="flex-row flex-wrap items-center gap-2 border-t bg-background px-6 py-4 sm:justify-end">
              {formPaqueteError && formPaquete.nombre.trim() && <p role="alert" className="w-full text-sm text-[var(--destructive)] sm:mr-auto sm:w-auto">{formPaqueteError}</p>}
              <Button type="button" variant="outline" className="flex-1 sm:flex-none" onClick={() => setShowFormPaquete(false)}>Cancelar</Button>
              <Button type="submit" className="flex-1 sm:flex-none" disabled={guardandoPaquete}>
                {guardandoPaquete ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando…</> : editPaqueteId ? 'Guardar cambios' : 'Crear paquete'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  )
}
