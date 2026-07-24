'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Plus, LogOut, ChevronRight, Loader2 } from 'lucide-react'
import { cursosApi, Curso, getUser, clearToken } from '../lib/api'

export default function DemoCursosPage() {
  const router = useRouter()
  const [cursos, setCursos] = useState<Curso[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const user = typeof window !== 'undefined' ? getUser() : null

  const [form, setForm] = useState({
    nombre: '',
    ciudad: '',
    codigo_curso: '',
    fecha_inicio: '',
    fecha_fin: '',
    duracion_horas: '20',
    duracion_validacion: '12',
    modalidad: 'presencial',
    estado: 'activo',
    empresa_contratante: '',
  })

  const load = useCallback(async () => {
    try {
      const data = await cursosApi.listar()
      setCursos(Array.isArray(data) ? data : [])
    } catch {
      setCursos([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const crear = async () => {
    if (!form.nombre.trim()) return
    setSaving(true)
    try {
      await cursosApi.crear({
        nombre: form.nombre.trim(),
        ciudad: form.ciudad.trim() || 'CDMX',
        codigo_curso: form.codigo_curso.trim() || `DEMO-${Date.now().toString().slice(-6)}`,
        fecha_inicio: form.fecha_inicio || null,
        fecha_fin: form.fecha_fin || null,
        duracion_horas: Number(form.duracion_horas) || 1,
        duracion_validacion: Number(form.duracion_validacion) || 1,
        modalidad: form.modalidad,
        estado: form.estado,
        empresa_contratante: form.empresa_contratante.trim() || null,
      })
      setOpen(false)
      setForm({ ...form, nombre: '', ciudad: '', codigo_curso: '', fecha_inicio: '', fecha_fin: '', empresa_contratante: '' })
      await load()
    } catch (e: any) {
      alert(e?.message || 'No se pudo crear el curso')
    } finally {
      setSaving(false)
    }
  }

  const logout = () => {
    clearToken()
    router.push('/demo')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-slate-800">
            AACES · Demo
            {user?.org && <Badge variant="secondary">{user.org}</Badge>}
          </div>
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="h-4 w-4 mr-1" /> Salir
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Cursos</h1>
            <p className="text-sm text-muted-foreground">Registra un curso y agrega participantes para emitir constancias.</p>
          </div>
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Nuevo curso
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando…
              </div>
            ) : cursos.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Aún no hay cursos. Crea el primero con “Nuevo curso”.
              </div>
            ) : (
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
                  {cursos.map((c) => (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer hover:bg-slate-50"
                      onClick={() => router.push(`/demo/cursos/${c.id}`)}
                    >
                      <TableCell className="font-mono text-xs">{c.codigo_curso || '-'}</TableCell>
                      <TableCell className="font-medium">{c.nombre}</TableCell>
                      <TableCell>{c.ciudad || '-'}</TableCell>
                      <TableCell>{c.duracion_horas ?? '-'}</TableCell>
                      <TableCell><Badge variant="outline">{c.modalidad || '-'}</Badge></TableCell>
                      <TableCell>
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogHeader>
          <DialogTitle>Nuevo curso</DialogTitle>
        </DialogHeader>
        <DialogContent className="space-y-3">
          <div className="grid gap-2">
            <Label>Nombre del curso *</Label>
            <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej. Seguridad Industrial" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-2">
              <Label>Ciudad</Label>
              <Input value={form.ciudad} onChange={(e) => setForm({ ...form, ciudad: e.target.value })} placeholder="CDMX" />
            </div>
            <div className="grid gap-2">
              <Label>Código</Label>
              <Input value={form.codigo_curso} onChange={(e) => setForm({ ...form, codigo_curso: e.target.value })} placeholder="SEG-01" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-2">
              <Label>Fecha inicio</Label>
              <Input type="date" value={form.fecha_inicio} onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Fecha fin</Label>
              <Input type="date" value={form.fecha_fin} onChange={(e) => setForm({ ...form, fecha_fin: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="grid gap-2">
              <Label>Horas</Label>
              <Input type="number" value={form.duracion_horas} onChange={(e) => setForm({ ...form, duracion_horas: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Vigencia (meses)</Label>
              <Input type="number" value={form.duracion_validacion} onChange={(e) => setForm({ ...form, duracion_validacion: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Modalidad</Label>
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={form.modalidad}
                onChange={(e) => setForm({ ...form, modalidad: e.target.value })}
              >
                <option value="presencial">Presencial</option>
                <option value="virtual">Virtual</option>
                <option value="mixta">Mixta</option>
              </select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Empresa contratante</Label>
            <Input value={form.empresa_contratante} onChange={(e) => setForm({ ...form, empresa_contratante: e.target.value })} placeholder="Constructora Ejemplo S.A." />
          </div>
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={crear} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Crear curso
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
