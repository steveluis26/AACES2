'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Alert } from '@/components/ui'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
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

const emptyCurso = { nombre: '', descripcion: '', duracion_horas: '8', vigencia_meses: '24', precio: '0', moneda: 'MXN', ciudad: '', estado: '', modalidad: 'presencial', publicado: false }
const emptyPaquete = { nombre: '', descripcion: '', precio: '0', moneda: 'MXN', publicado: false, curso_ids: [] as string[] }

export default function CatalogoPage() {
  const [tab, setTab] = useState<'cursos' | 'paquetes'>('cursos')
  const [cursos, setCursos] = useState<CursoCatalogo[]>([])
  const [paquetes, setPaquetes] = useState<Paquete[]>([])
  const [q, setQ] = useState('')
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

  const cursosFiltrados = cursos.filter(c =>
    !q.trim() || c.nombre.toLowerCase().includes(q.toLowerCase()) ||
    (c.descripcion || '').toLowerCase().includes(q.toLowerCase())
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
      }
      if (editCursoId) {
        await apiRequest(`/catalogo/cursos/${editCursoId}`, { method: 'PUT', body: JSON.stringify(body) })
      } else {
        await apiRequest('/catalogo/cursos', { method: 'POST', body: JSON.stringify(body) })
      }
      setShowFormCurso(false)
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
      load()
    } catch (e) {
      setError((e as Error)?.message || 'No se pudo actualizar')
    }
  }

  const eliminarCurso = async (c: CursoCatalogo) => {
    if (!window.confirm(`¿Dar de baja "${c.nombre}" del catálogo? Los cursos programados no se afectan.`)) return
    try {
      await apiRequest(`/catalogo/cursos/${c.id}`, { method: 'DELETE' })
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
      load()
    } catch (e) {
      setError((e as Error)?.message || 'No se pudo actualizar')
    }
  }

  const eliminarPaquete = async (p: Paquete) => {
    if (!window.confirm(`¿Dar de baja el paquete "${p.nombre}"?`)) return
    try {
      await apiRequest(`/catalogo/paquetes/${p.id}`, { method: 'DELETE' })
      load()
    } catch (e) {
      setError((e as Error)?.message || 'No se pudo eliminar')
    }
  }

  const setFC = (k: string, v: string | boolean) => setFormCurso(f => ({ ...f, [k]: v }))
  const setFP = (k: string, v: string | boolean) => setFormPaquete(f => ({ ...f, [k]: v }))

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Catálogo de cursos</h1>
          <p className="text-sm text-muted-foreground">Define una vez los cursos que impartes y reutilízalos al programar. Marca como publicado lo que quieras mostrar en el directorio.</p>
        </div>
      </div>

      {error && <Alert className="alert-error">{error}</Alert>}

      <div className="flex gap-2">
        <Button variant={tab === 'cursos' ? 'default' : 'outline'} onClick={() => setTab('cursos')}>Cursos ({cursos.length})</Button>
        <Button variant={tab === 'paquetes' ? 'default' : 'outline'} onClick={() => setTab('paquetes')}>Paquetes ({paquetes.length})</Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando catálogo…</p>
      ) : tab === 'cursos' ? (
        <>
          <div className="flex flex-wrap gap-2">
            <Input placeholder="Buscar en catálogo…" value={q} onChange={e => setQ(e.target.value)} className="max-w-xs" />
            <Button onClick={abrirNuevoCurso}>+ Nuevo curso</Button>
          </div>

          {showFormCurso && (
            <Card>
              <CardHeader><CardTitle>{editCursoId ? 'Editar curso del catálogo' : 'Nuevo curso del catálogo'}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {formCursoError && <Alert className="alert-error">{formCursoError}</Alert>}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium">Nombre del curso *</label>
                    <Input value={formCurso.nombre} onChange={e => setFC('nombre', e.target.value)} placeholder="Ej. Trabajo en alturas" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium">Descripción</label>
                    <Input value={formCurso.descripcion} onChange={e => setFC('descripcion', e.target.value)} placeholder="Temario resumido, a quién va dirigido…" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Duración (horas)</label>
                    <Input type="number" min={1} value={formCurso.duracion_horas} onChange={e => setFC('duracion_horas', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Vigencia (meses)</label>
                    <Input type="number" min={1} value={formCurso.vigencia_meses} onChange={e => setFC('vigencia_meses', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Precio</label>
                    <Input type="number" min={0} step="0.01" value={formCurso.precio} onChange={e => setFC('precio', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Modalidad</label>
                    <Select value={formCurso.modalidad} onValueChange={v => setFC('modalidad', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="presencial">Presencial</SelectItem>
                        <SelectItem value="virtual">Virtual</SelectItem>
                        <SelectItem value="mixta">Mixta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Ciudad</label>
                    <Input value={formCurso.ciudad} onChange={e => setFC('ciudad', e.target.value)} placeholder="Ej. Monterrey" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Estado</label>
                    <Input value={formCurso.estado} onChange={e => setFC('estado', e.target.value)} placeholder="Ej. Nuevo León" />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={formCurso.publicado} onCheckedChange={v => setFC('publicado', v === true)} />
                  Publicado en el directorio (visible para empresas que buscan)
                </label>
                <div className="flex gap-2">
                  <Button onClick={guardarCurso} disabled={guardandoCurso}>{guardandoCurso ? 'Guardando…' : 'Guardar'}</Button>
                  <Button variant="outline" onClick={() => setShowFormCurso(false)}>Cancelar</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {cursosFiltrados.length === 0 ? (
            <p className="text-sm text-muted-foreground">{q ? 'Sin resultados para tu búsqueda.' : 'Aún no tienes cursos en tu catálogo. Agrega el primero con “+ Nuevo curso”.'}</p>
          ) : (
            <div className="grid-cards">
              {cursosFiltrados.map(c => (
                <Card key={c.id}>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center justify-between gap-2">
                      <span className="truncate">{c.nombre}</span>
                      {c.publicado && <Badge>Publicado</Badge>}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {c.descripcion && <p className="text-muted-foreground line-clamp-2">{c.descripcion}</p>}
                    <p><span className="font-medium">{c.duracion_horas} h</span> · vigencia {c.vigencia_meses} meses · {c.modalidad}</p>
                    <p className="font-semibold">${Number(c.precio).toLocaleString('es-MX')} {c.moneda}</p>
                    {(c.ciudad || c.estado) && <p className="text-muted-foreground">{[c.ciudad, c.estado].filter(Boolean).join(', ')}</p>}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button variant="outline" size="sm" onClick={() => abrirEditarCurso(c)}>Editar</Button>
                      <Button variant="outline" size="sm" onClick={() => togglePublicadoCurso(c)}>{c.publicado ? 'Ocultar' : 'Publicar'}</Button>
                      <Button variant="outline" size="sm" onClick={() => eliminarCurso(c)}>Dar de baja</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <Button onClick={abrirNuevoPaquete}>+ Nuevo paquete</Button>
          </div>

          {showFormPaquete && (
            <Card>
              <CardHeader><CardTitle>{editPaqueteId ? 'Editar paquete' : 'Nuevo paquete'}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {formPaqueteError && <Alert className="alert-error">{formPaqueteError}</Alert>}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium">Nombre del paquete *</label>
                    <Input value={formPaquete.nombre} onChange={e => setFP('nombre', e.target.value)} placeholder="Ej. Paquete alturas + espacios confinados" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium">Descripción</label>
                    <Input value={formPaquete.descripcion} onChange={e => setFP('descripcion', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Precio del paquete</label>
                    <Input type="number" min={0} step="0.01" value={formPaquete.precio} onChange={e => setFP('precio', e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Cursos incluidos</label>
                  {cursos.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Primero agrega cursos a tu catálogo.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1 mt-1">
                      {cursos.map(c => (
                        <label key={c.id} className="flex items-center gap-2 text-sm border rounded px-2 py-1.5">
                          <Checkbox checked={formPaquete.curso_ids.includes(c.id)} onCheckedChange={() => toggleCursoEnPaquete(c.id)} />
                          <span className="truncate">{c.nombre}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={formPaquete.publicado} onCheckedChange={v => setFP('publicado', v === true)} />
                  Publicado en el directorio
                </label>
                <div className="flex gap-2">
                  <Button onClick={guardarPaquete} disabled={guardandoPaquete}>{guardandoPaquete ? 'Guardando…' : 'Guardar'}</Button>
                  <Button variant="outline" onClick={() => setShowFormPaquete(false)}>Cancelar</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {paquetes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no tienes paquetes. Agrupa cursos de tu catálogo con un precio especial.</p>
          ) : (
            <div className="grid-cards">
              {paquetes.map(p => (
                <Card key={p.id}>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center justify-between gap-2">
                      <span className="truncate">{p.nombre}</span>
                      {p.publicado && <Badge>Publicado</Badge>}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {p.descripcion && <p className="text-muted-foreground line-clamp-2">{p.descripcion}</p>}
                    <p className="font-semibold">${Number(p.precio).toLocaleString('es-MX')} {p.moneda}</p>
                    <div className="flex flex-wrap gap-1">
                      {p.cursos.map(c => <Badge key={c.id} variant="outline">{c.nombre}</Badge>)}
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button variant="outline" size="sm" onClick={() => abrirEditarPaquete(p)}>Editar</Button>
                      <Button variant="outline" size="sm" onClick={() => togglePublicadoPaquete(p)}>{p.publicado ? 'Ocultar' : 'Publicar'}</Button>
                      <Button variant="outline" size="sm" onClick={() => eliminarPaquete(p)}>Dar de baja</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
