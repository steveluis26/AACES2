'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { ChevronLeft, Plus, FileCheck2, QrCode, Loader2, CheckCircle2, Award, Trash2 } from 'lucide-react'
import {
  cursosApi, Curso, participantesApi, ParticipanteCurso, constanciasApi, ConstanciaEmitida, pdfUrl,
} from '../../lib/api'

export default function CursoDetallePage() {
  const params = useParams<{ id: string }>()
  const cursoId = params.id
  const router = useRouter()

  const [curso, setCurso] = useState<Curso | null>(null)
  const [participantes, setParticipantes] = useState<ParticipanteCurso[]>([])
  const [loading, setLoading] = useState(true)

  const [openPart, setOpenPart] = useState(false)
  const [savingPart, setSavingPart] = useState(false)
  const [form, setForm] = useState({ nombre: '', correo: '', telefono: '', empresa: '', cargo: '', ciudad_origen: '' })

  // Edición inline
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ nombre: '', correo: '', telefono: '', empresa: '', cargo: '', ciudad_origen: '' })
  const [savingEdit, setSavingEdit] = useState(false)

  const [emitido, setEmitido] = useState<Record<string, ConstanciaEmitida>>({})
  const [emitiendo, setEmitiendo] = useState<string | null>(null)
  const [preview, setPreview] = useState<ConstanciaEmitida | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const c = await cursosApi.detalle(cursoId)
      setCurso(c)
      const lista = await participantesApi.listar(cursoId)
      setParticipantes(Array.isArray(lista) ? lista : [])
    } catch {
      setCurso(null)
      setParticipantes([])
    } finally {
      setLoading(false)
    }
  }, [cursoId])
  useEffect(() => { load() }, [load])

  // ── Alta ──────────────────────────────────────────────
  const agregar = async () => {
    if (!form.nombre.trim() || !form.correo.trim()) return
    if (!form.telefono.trim()) { alert('El teléfono es requerido.'); return }
    setSavingPart(true)
    try {
      const res = await participantesApi.agregar(cursoId, {
        nombre: form.nombre.trim(),
        correo: form.correo.trim(),
        telefono: form.telefono.trim(),
        empresa: form.empresa.trim() || null,
        cargo: form.cargo.trim() || null,
        ciudad_origen: form.ciudad_origen.trim() || null,
      })
      setParticipantes((prev) => [
        ...prev,
        {
          id: res.curso_participante_id, participante_id: res.participante_id,
          nombre: form.nombre.trim(), apellido: null, correo: form.correo.trim(),
          ciudad_origen: form.ciudad_origen.trim() || null, telefono: form.telefono.trim(),
          empresa: form.empresa.trim() || null, cargo: form.cargo.trim() || null,
          profesion: null, estado_pago: null, estado_acreditacion: false, codigo_validacion: null,
        },
      ])
      setForm({ nombre: '', correo: '', telefono: '', empresa: '', cargo: '', ciudad_origen: '' })
      setOpenPart(false)
    } catch (e: any) {
      alert(e?.message || 'No se pudo agregar')
    } finally {
      setSavingPart(false)
    }
  }

  // ── Edición (campos que el backend SÍ guarda) ────────
  const startEdit = (p: ParticipanteCurso) => {
    setEditId(p.id)
    setEditForm({
      nombre: p.nombre, correo: p.correo, telefono: p.telefono || '',
      empresa: p.empresa || '', cargo: p.cargo || '', ciudad_origen: p.ciudad_origen || '',
    })
  }
  const guardarEdit = async (p: ParticipanteCurso) => {
    setSavingEdit(true)
    try {
      await participantesApi.actualizar(p.participante_id, {
        nombre: editForm.nombre.trim(),
        correo: editForm.correo.trim(),
        telefono: editForm.telefono.trim() || null,
        empresa: editForm.empresa.trim() || null,
        cargo: editForm.cargo.trim() || null,
        ciudad_origen: editForm.ciudad_origen.trim() || null,
      })
      setParticipantes((prev) => prev.map((x) => x.id === p.id ? {
        ...x, nombre: editForm.nombre.trim(), correo: editForm.correo.trim(),
        telefono: editForm.telefono.trim() || null, empresa: editForm.empresa.trim() || null,
        cargo: editForm.cargo.trim() || null, ciudad_origen: editForm.ciudad_origen.trim() || null,
      } : x))
      setEditId(null)
    } catch (e: any) {
      alert(e?.message || 'No se pudo guardar')
    } finally {
      setSavingEdit(false)
    }
  }

  const acreditar = async (p: ParticipanteCurso) => {
    try {
      await participantesApi.acreditar(p.participante_id, 90)
      setParticipantes((prev) => prev.map((x) => x.id === p.id ? { ...x, estado_acreditacion: true } : x))
    } catch (e: any) { alert(e?.message || 'No se pudo acreditar') }
  }

  const emitir = async (p: ParticipanteCurso) => {
    setEmitiendo(p.id)
    try {
      const res = await constanciasApi.emitir(p.id)
      setEmitido((prev) => ({ ...prev, [p.id]: res.documento }))
      setParticipantes((prev) => prev.map((x) => x.id === p.id ? { ...x, codigo_validacion: res.documento.codigo_validacion } : x))
    } catch (e: any) { alert(e?.message || 'No se pudo emitir') }
    finally { setEmitiendo(null) }
  }

  const eliminar = async (p: ParticipanteCurso) => {
    if (!confirm(`¿Eliminar a ${p.nombre} de este curso?`)) return
    try {
      await participantesApi.eliminar(cursoId, p.id)
      setParticipantes((prev) => prev.filter((x) => x.id !== p.id))
    } catch (e: any) { alert(e?.message || 'No se pudo eliminar') }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="mx-auto px-4 h-14 flex items-center justify-between max-w-5xl">
          <Button variant="ghost" size="sm" onClick={() => router.push('/cliente/cursos')}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Cursos
          </Button>
          <span className="text-sm text-muted-foreground truncate max-w-[60%]">{curso?.nombre}</span>
        </div>
      </header>

      <main className="mx-auto px-4 py-8 space-y-6 max-w-5xl">
        {/* Header del curso seleccionado */}
        <Card>
          <CardContent className="p-5 flex flex-wrap items-center gap-4">
            <div className="bg-emerald-50 rounded-full p-3"><Award className="h-6 w-6 text-emerald-600" /></div>
            <div className="flex-1 min-w-[200px]">
              <h1 className="text-xl font-bold text-slate-900">{curso?.nombre || 'Curso'}</h1>
              <p className="text-sm text-muted-foreground">
                {curso?.ciudad || '-'} · {curso?.duracion_horas ?? '-'} hrs · <Badge variant="outline">{curso?.modalidad || '-'}</Badge>
                {curso?.empresa_contratante ? ` · ${curso.empresa_contratante}` : ''}
              </p>
            </div>
            <Button onClick={() => setOpenPart(true)}><Plus className="h-4 w-4 mr-1" /> Agregar participante</Button>
          </CardContent>
        </Card>

        {/* Tabla de participantes */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Participantes ({participantes.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            {participantes.length === 0 && !loading ? (
              <div className="text-center py-10 text-muted-foreground">Sin participantes. Agrega el primero.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b text-left text-muted-foreground">
                  <tr>
                    <th className="p-3 pl-5">Nombre</th>
                    <th className="p-3">Correo</th>
                    <th className="p-3">Teléfono</th>
                    <th className="p-3">Empresa</th>
                    <th className="p-3">Cargo</th>
                    <th className="p-3">Ciudad</th>
                    <th className="p-3">Acred.</th>
                    <th className="p-3">Constancia</th>
                    <th className="p-3 pr-5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {participantes.map((p) => {
                    const c = emitido[p.id]
                    const editing = editId === p.id
                    return (
                      <tr key={p.id} className="border-b last:border-0 hover:bg-slate-50 align-top">
                        <td className="p-3 pl-5 font-medium">
                          {editing ? <Input value={editForm.nombre} onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })} /> : p.nombre}
                        </td>
                        <td className="p-3">{editing ? <Input value={editForm.correo} onChange={(e) => setEditForm({ ...editForm, correo: e.target.value })} /> : p.correo}</td>
                        <td className="p-3">{editing ? <Input value={editForm.telefono} onChange={(e) => setEditForm({ ...editForm, telefono: e.target.value })} /> : (p.telefono || '-')}</td>
                        <td className="p-3">{editing ? <Input value={editForm.empresa} onChange={(e) => setEditForm({ ...editForm, empresa: e.target.value })} /> : (p.empresa || '-')}</td>
                        <td className="p-3">{editing ? <Input value={editForm.cargo} onChange={(e) => setEditForm({ ...editForm, cargo: e.target.value })} /> : (p.cargo || '-')}</td>
                        <td className="p-3">{editing ? <Input value={editForm.ciudad_origen} onChange={(e) => setEditForm({ ...editForm, ciudad_origen: e.target.value })} /> : (p.ciudad_origen || '-')}</td>
                        <td className="p-3">
                          {p.estado_acreditacion
                            ? <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Sí</Badge>
                            : <Badge variant="outline">No</Badge>}
                        </td>
                        <td className="p-3">{c ? <span className="font-mono text-xs text-emerald-700">{c.folio}</span> : <span className="text-xs text-muted-foreground">—</span>}</td>
                        <td className="p-3 pr-5">
                          <div className="flex gap-2 justify-end flex-wrap">
                            {!p.estado_acreditacion && !editing && <Button size="sm" variant="outline" onClick={() => acreditar(p)}>Acreditar</Button>}
                            {c ? (
                              <Button size="sm" variant="outline" onClick={() => setPreview(c)}><QrCode className="h-3 w-3 mr-1" /> Ver</Button>
                            ) : (
                              !editing && <Button size="sm" onClick={() => emitir(p)} disabled={emitiendo === p.id}>{emitiendo === p.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <FileCheck2 className="h-3 w-3 mr-1" />}Emitir</Button>
                            )}
                            {editing ? (
                              <Button size="sm" onClick={() => guardarEdit(p)} disabled={savingEdit}>{savingEdit ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Guardar'}</Button>
                            ) : (
                              <Button size="sm" variant="ghost" onClick={() => startEdit(p)}>Editar</Button>
                            )}
                            {!editing && <Button size="sm" variant="ghost" onClick={() => eliminar(p)}><Trash2 className="h-3 w-3 text-red-500" /></Button>}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Alta */}
      <Dialog open={openPart} onClose={() => setOpenPart(false)}>
        <DialogHeader><DialogTitle>Agregar participante</DialogTitle></DialogHeader>
        <DialogContent className="space-y-3">
          <div className="grid gap-2"><Label>Nombre completo *</Label><Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Juan Pérez" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-2"><Label>Correo *</Label><Input value={form.correo} onChange={(e) => setForm({ ...form, correo: e.target.value })} placeholder="juan@ejemplo.com" /></div>
            <div className="grid gap-2"><Label>Teléfono *</Label><Input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} placeholder="5512345678" /></div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="grid gap-2"><Label>Empresa</Label><Input value={form.empresa} onChange={(e) => setForm({ ...form, empresa: e.target.value })} /></div>
            <div className="grid gap-2"><Label>Cargo</Label><Input value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} /></div>
            <div className="grid gap-2"><Label>Ciudad</Label><Input value={form.ciudad_origen} onChange={(e) => setForm({ ...form, ciudad_origen: e.target.value })} /></div>
          </div>
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpenPart(false)}>Cancelar</Button>
          <Button onClick={agregar} disabled={savingPart}>{savingPart ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Agregar</Button>
        </DialogFooter>
      </Dialog>

      {/* Preview constancia */}
      <Dialog open={!!preview} onClose={() => setPreview(null)}>
        <DialogHeader>
          <DialogTitle>
            <span className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600" /> Constancia emitida</span>
          </DialogTitle>
        </DialogHeader>
        {preview && (
          <DialogContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Folio</p><p className="font-mono font-semibold">{preview.folio}</p>
                <p className="text-xs text-muted-foreground mt-2">Participante</p><p className="font-semibold">{preview.participante_nombre}</p>
                <p className="text-xs text-muted-foreground mt-2">Curso</p><p className="font-semibold">{preview.curso_nombre}</p>
                <p className="text-xs text-muted-foreground mt-2">Hash SHA-256</p><p className="font-mono text-[11px] break-all text-muted-foreground">{preview.pdf_hash}</p>
              </div>
              <div className="flex flex-col items-center justify-center border rounded-lg p-3 bg-white">
                <p className="text-xs text-muted-foreground mb-2">Código de validación</p>
                <p className="font-mono text-[11px] break-all text-center mb-3">{preview.codigo_validacion}</p>
                <QrCode className="h-28 w-28 text-slate-800" />
                <a href={`/verificar/${preview.codigo_validacion}`} className="text-xs text-emerald-700 underline mt-3" target="_blank">Abrir verificación →</a>
              </div>
            </div>
            <div className="border rounded-lg overflow-hidden bg-slate-100">
              <iframe src={pdfUrl(preview.id)} className="w-full h-96" title="Vista previa" />
            </div>
            <a href={pdfUrl(preview.id)} target="_blank" className="text-sm text-emerald-700 underline">Descargar PDF</a>
          </DialogContent>
        )}
        <DialogFooter><Button onClick={() => setPreview(null)}>Cerrar</Button></DialogFooter>
      </Dialog>
    </div>
  )
}
