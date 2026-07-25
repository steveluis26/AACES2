'use client'

import { useCallback, useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Badge } from '@/components/ui'
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from '@/components/ui/table'
import { Plus, ChevronRight, ChevronLeft, Loader2 } from 'lucide-react'
import { cursosApi, Curso, getUser } from '../lib/api'
import { ErrorBeacon } from '@/components/error-beacon'

export default function CursosPage() {
  const router = useRouter()
  const [todos, setTodos] = useState<Curso[]>([])      // todos los cursos (para búsqueda global)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [page, setPage] = useState(0)
  const pageSize = 10
  const [hasNext, setHasNext] = useState(false)

  const [form, setForm] = useState({
    nombre: '', ciudad: '', codigo_curso: '',
    fecha_inicio: '', fecha_fin: '',
    duracion_horas: '20', duracion_validacion: '12',
    modalidad: 'presencial', estado: 'activo', empresa_contratante: '',
  })
  const user = typeof window !== 'undefined' ? getUser() : null

  const load = useCallback(async (searchQ = '') => {
    setLoading(true)
    try {
      // El backend filtra por org del usuario y por search (server-side).
      const data = await cursosApi.listarTodos(searchQ)
      setTodos(Array.isArray(data?.items) ? data.items : [])
    } catch {
      setTodos([])
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { load(q) }, [load, q])

  // Solo pagina a 10 (el filtrado lo hace el backend vía search).
  const filtered = useMemo(() => {
    setHasNext(todos.length > (page + 1) * pageSize)
    return todos.slice(page * pageSize, page * pageSize + pageSize)
  }, [todos, q, page, pageSize])

  const crear = async () => {
    setSaving(true)
    setFormError(null)
    try {
      const hoy = new Date().toISOString().slice(0, 10)
      await cursosApi.crear({
        nombre: form.nombre.trim(),
        ciudad: form.ciudad.trim() || 'CDMX',
        codigo_curso: form.codigo_curso.trim() || `CUR-${Date.now().toString().slice(-6)}`,
        fecha_inicio: form.fecha_inicio || hoy,
        fecha_fin: form.fecha_fin || hoy,
        duracion_horas: Number(form.duracion_horas) || 1,
        duracion_validacion: Number(form.duracion_validacion) || 1,
        modalidad: form.modalidad,
        estado: form.estado,
        empresa_contratante: form.empresa_contratante.trim() || null,
      })
      setShowForm(false)
      resetForm()
      setPage(0)
      await load()
    } catch (e: any) {
      setFormError(e?.message || 'No se pudo crear el curso')
    } finally {
      setSaving(false)
    }
  }

  const resetForm = () => {
    setForm({ nombre: '', ciudad: '', codigo_curso: '', fecha_inicio: '', fecha_fin: '', duracion_horas: '20', duracion_validacion: '12', modalidad: 'presencial', estado: 'activo', empresa_contratante: '' })
    setFormError(null)
  }

  return (
    <div className="space-y-6 px-4 lg:px-6">
      <ErrorBeacon />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">Cursos</h1>
          {user?.org && <Badge variant="secondary">{user.org}</Badge>}
        </div>
        <Button onClick={() => { setShowForm(!showForm); setFormError(null) }}>
          {showForm ? 'Cancelar' : (<><Plus className="h-4 w-4 mr-1" /> Nuevo curso</>)}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle>Registrar curso</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <Input placeholder="Nombre del curso *" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
              <Input placeholder="Ciudad" value={form.ciudad} onChange={(e) => setForm({ ...form, ciudad: e.target.value })} />
              <Input placeholder="Código (ej. SEG-01)" value={form.codigo_curso} onChange={(e) => setForm({ ...form, codigo_curso: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <Input type="date" value={form.fecha_inicio} onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })} />
              <Input type="date" value={form.fecha_fin} onChange={(e) => setForm({ ...form, fecha_fin: e.target.value })} />
              <Input type="number" placeholder="Horas" value={form.duracion_horas} onChange={(e) => setForm({ ...form, duracion_horas: e.target.value })} />
              <Input type="number" placeholder="Vigencia (meses)" value={form.duracion_validacion} onChange={(e) => setForm({ ...form, duracion_validacion: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.modalidad} onChange={(e) => setForm({ ...form, modalidad: e.target.value })}>
                <option value="presencial">Presencial</option>
                <option value="virtual">Virtual</option>
                <option value="mixta">Mixta</option>
              </select>
              <Input placeholder="Empresa contratante" value={form.empresa_contratante} onChange={(e) => setForm({ ...form, empresa_contratante: e.target.value })} />
              <div className="flex gap-2">
                <Button onClick={crear} disabled={saving || !form.nombre.trim()}>
                  {saving ? (<><Loader2 className="h-4 w-4 animate-spin mr-1" /> Guardando...</>) : 'Guardar'}
                </Button>
                <Button variant="outline" onClick={resetForm}>Limpiar</Button>
              </div>
            </div>
            {formError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{formError}</p>}
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2 max-w-md">
        <Input placeholder="Buscar por nombre, código, ciudad o modalidad" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Curso</TableHead>
                <TableHead>Ciudad</TableHead>
                <TableHead>Horas</TableHead>
                <TableHead>Modalidad</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Cargando…
                  </TableCell>
                </TableRow>
              ) : filtered.map((c) => (
                <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/cliente/cursos/${c.id}`)}>
                  <TableCell className="font-mono text-xs">{c.codigo_curso || '-'}</TableCell>
                  <TableCell className="font-medium">{c.nombre}</TableCell>
                  <TableCell>{c.ciudad || '-'}</TableCell>
                  <TableCell>{c.duracion_horas ?? '-'}</TableCell>
                  <TableCell><Badge variant="outline">{c.modalidad || '-'}</Badge></TableCell>
                  <TableCell><ChevronRight className="h-4 w-4 text-slate-400" /></TableCell>
                </TableRow>
              ))}
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-sm text-muted-foreground text-center py-8">
                    No hay cursos que coincidan con la búsqueda.
                  </TableCell>
                </TableRow>
              )}
              {!loading && todos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-sm text-muted-foreground text-center py-8">
                    Aún no hay cursos. Crea el primero.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {(page > 0 || hasNext) && (
        <div className="flex items-center justify-between max-w-5xl">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0 || loading}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
          </Button>
          <span className="text-sm text-muted-foreground">Página {page + 1}</span>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={!hasNext || loading}>
            Siguiente <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  )
}
