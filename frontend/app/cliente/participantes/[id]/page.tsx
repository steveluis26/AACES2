'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Alert } from '@/components/ui'
import { Field } from '@/components/ui/field'
import { Badge } from '@/components/ui/badge'
import { apiRequest } from '@/app/services/api'

type CursoHistorial = {
  curso_id: string
  curso_nombre: string
  codigo_curso: string
  fecha_inicio: string | null
  fecha_fin: string | null
  duracion_horas: number | null
  modalidad: string | null
  ciudad: string | null
  empresa_contratante: string | null
  fecha_inicio_vigencia: string | null
  fecha_expiracion: string | null
  estado_acreditacion: boolean
  calificacion: number | null
  estado_vigencia: string
}

type ParticipanteDetalle = {
  id: string
  pax_id: string
  nombre: string
  correo: string | null
  telefono: string | null
  empresa: string | null
  cargo: string | null
  ciudad_origen: string | null
  curp: string | null
  ocupacion: string | null
  fecha_nacimiento: string | null
  nivel_educacion: string | null
  fecha_creacion: string | null
  cursos: CursoHistorial[]
  total_cursos: number
  vigentes: number
  por_vencer: number
  vencidos: number
}

const ESTADO_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  vigente: { label: 'Vigente', variant: 'default' },
  por_vencer: { label: 'Por vencer', variant: 'secondary' },
  vencido: { label: 'Vencido', variant: 'destructive' },
  sin_vigencia: { label: 'Sin vigencia', variant: 'outline' },
}

export default function ParticipanteDetallePage() {
  const params = useParams()
  const pid = params.id as string
  const [p, setP] = useState<ParticipanteDetalle | null>(null)
  const [editando, setEditando] = useState(false)
  const [guardarError, setGuardarError] = useState('')
  const [editNombre, setEditNombre] = useState('')
  const [editCorreo, setEditCorreo] = useState('')
  const [editTelefono, setEditTelefono] = useState('')
  const [editEmpresa, setEditEmpresa] = useState('')
  const [editCargo, setEditCargo] = useState('')
  const [editCiudad, setEditCiudad] = useState('')
  const [editCurp, setEditCurp] = useState('')
  const [editOcupacion, setEditOcupacion] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const load = useCallback(async () => {
    try {
      const data = await apiRequest<ParticipanteDetalle>(`/participantes/${pid}`)
      setP(data)
    } catch { setP(null) }
  }, [pid])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!p || !canvasRef.current) return
    const baseUrl = `${window.location.origin}/p/${p.pax_id}`
    import('qrcode').then(qr => {
      qr.toCanvas(canvasRef.current, baseUrl, { width: 200, margin: 2 }, (err: Error | null) => {
        if (err) console.error(err)
      })
    })
  }, [p])

  const guardar = async () => {
    setGuardarError('')
    try {
      await apiRequest(`/participantes/${pid}`, {
        method: 'PUT',
        body: JSON.stringify({
          nombre: editNombre, correo: editCorreo, telefono: editTelefono,
          empresa: editEmpresa, cargo: editCargo, ciudad_origen: editCiudad,
          curp: editCurp, ocupacion: editOcupacion,
        }),
      })
      setEditando(false)
      load()
    } catch (e) { setGuardarError((e as Error)?.message || 'Error al actualizar') }
  }

  const descargarQR = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `${p?.pax_id || 'participante'}-qr.png`
    a.click()
  }

  if (!p) return <div className="p-6 text-muted-foreground">Cargando...</div>

  const stats = [
    { label: 'Cursos', value: p.total_cursos },
    { label: 'Vigentes', value: p.vigentes, color: 'text-green-600' },
    { label: 'Por vencer', value: p.por_vencer, color: 'text-yellow-600' },
    { label: 'Vencidos', value: p.vencidos, color: 'text-red-600' },
  ]

  return (
    <div className="space-y-6 px-4 py-4 lg:px-6 lg:py-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold truncate">{p.nombre}</h1>
          <p className="text-sm text-muted-foreground font-mono truncate">{p.pax_id}</p>
        </div>
        <Button variant="outline" className="shrink-0" onClick={() => {
          if (!editando) {
            setEditNombre(p.nombre); setEditCorreo(p.correo || '')
            setEditTelefono(p.telefono || ''); setEditEmpresa(p.empresa || '')
            setEditCargo(p.cargo || ''); setEditCiudad(p.ciudad_origen || '')
            setEditCurp(p.curp || ''); setEditOcupacion(p.ocupacion || '')
          }
          setEditando(!editando)
        }}>
          {editando ? 'Cancelar' : 'Editar'}
        </Button>
      </div>

      <div className="flex gap-2">
        {stats.map(s => (
          <Card key={s.label} className="flex-1">
            <CardContent className="p-4 text-center">
              <div className={`text-2xl font-bold ${s.color || ''}`}>{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader><CardTitle>Información</CardTitle></CardHeader>
          <CardContent>
            {editando ? (
              <div className="space-y-3">
                <Field label="Nombre" htmlFor="e_nombre">
                  <Input id="e_nombre" value={editNombre} onChange={e => setEditNombre(e.target.value)} />
                </Field>
                <Field label="Correo" htmlFor="e_correo">
                  <Input id="e_correo" value={editCorreo} onChange={e => setEditCorreo(e.target.value)} />
                </Field>
                <Field label="Teléfono" htmlFor="e_telefono">
                  <Input id="e_telefono" value={editTelefono} onChange={e => setEditTelefono(e.target.value)} />
                </Field>
                <Field label="Empresa" htmlFor="e_empresa">
                  <Input id="e_empresa" value={editEmpresa} onChange={e => setEditEmpresa(e.target.value)} />
                </Field>
                <Field label="Cargo" htmlFor="e_cargo">
                  <Input id="e_cargo" value={editCargo} onChange={e => setEditCargo(e.target.value)} />
                </Field>
                <Field label="Ciudad" htmlFor="e_ciudad">
                  <Input id="e_ciudad" value={editCiudad} onChange={e => setEditCiudad(e.target.value)} />
                </Field>
                <Field label="CURP" htmlFor="e_curp">
                  <Input id="e_curp" maxLength={18} autoCapitalize="characters" spellCheck={false} className="font-mono uppercase tracking-wider" value={editCurp} onChange={e => setEditCurp(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())} />
                </Field>
                <Field label="Ocupación específica (DC-3)" htmlFor="e_ocupacion">
                  <Input id="e_ocupacion" value={editOcupacion} onChange={e => setEditOcupacion(e.target.value)} />
                </Field>
                <Button onClick={guardar}>Guardar cambios</Button>
                {guardarError && (<Alert className="alert-error">{guardarError}</Alert>)}
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                <div><span className="font-medium">Correo:</span> {p.correo || '-'}</div>
                <div><span className="font-medium">Teléfono:</span> {p.telefono || '-'}</div>
                <div><span className="font-medium">Empresa:</span> {p.empresa || '-'}</div>
                <div><span className="font-medium">Cargo:</span> {p.cargo || '-'}</div>
                <div><span className="font-medium">Ciudad:</span> {p.ciudad_origen || '-'}</div>
                <div><span className="font-medium">CURP:</span> <span className="font-mono">{p.curp || '-'}</span></div>
                <div><span className="font-medium">Ocupación:</span> {p.ocupacion || '-'}</div>
                {p.fecha_nacimiento && <div><span className="font-medium">Fecha de nacimiento:</span> {p.fecha_nacimiento}</div>}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>QR permanente</CardTitle></CardHeader>
          <CardContent className="flex flex-col items-center gap-3">
            <canvas ref={canvasRef} />
            <p className="text-xs text-muted-foreground text-center break-all">
              {typeof window !== 'undefined' && `${window.location.origin}/p/${p.pax_id}`}
            </p>
            <Button variant="outline" size="sm" onClick={descargarQR}>
              Descargar QR
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Historial de cursos ({p.total_cursos})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="p-3 font-medium">Curso</th>
                <th className="p-3 font-medium">Periodo</th>
                <th className="p-3 font-medium">Vigencia</th>
                <th className="p-3 font-medium">Estado</th>
                <th className="p-3 font-medium">Calif.</th>
              </tr>
            </thead>
            <tbody>
              {p.cursos.map(c => {
                const badge = ESTADO_BADGE[c.estado_vigencia] || ESTADO_BADGE.sin_vigencia
                return (
                  <tr key={c.curso_id} className="border-b last:border-0">
                    <td className="p-3">{c.curso_nombre}<br /><span className="text-xs text-muted-foreground">{c.codigo_curso}</span></td>
                    <td className="p-3">{c.fecha_inicio?.slice(0, 10)} — {c.fecha_fin?.slice(0, 10)}</td>
                    <td className="p-3">{c.fecha_expiracion?.slice(0, 10) || '-'}</td>
                    <td className="p-3"><Badge variant={badge.variant}>{badge.label}</Badge></td>
                    <td className="p-3">{c.calificacion != null ? `${c.calificacion}%` : '-'}</td>
                  </tr>
                )
              })}
              {p.cursos.length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Sin cursos registrados aún.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
