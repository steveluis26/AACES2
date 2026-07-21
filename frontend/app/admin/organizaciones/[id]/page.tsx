'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card, CardHeader, CardTitle, CardContent,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

type Usuario = {
  id: string
  nombre: string
  correo: string
  rol: string
  activo: boolean
  ultimo_acceso?: string
  fecha_creacion?: string
}

type Suscripcion = {
  id: string
  plan_codigo: string
  plan_nombre: string
  estatus: string
  fecha_inicio?: string
  fecha_fin?: string
  cursos_max: number
  usuarios_max: number
  constancias_max: number
}

type OrgDetail = {
  id: string
  rfc: string
  razon_social: string
  nombre_comercial?: string
  email_contacto?: string
  telefono?: string
  estado?: string
  ciudad?: string
  direccion?: string
  estatus: string
  fecha_creacion?: string
  fecha_activacion?: string
  notas_admin?: string
  usuarios: Usuario[]
  suscripciones: Suscripcion[]
}

type Plan = {
  id: string
  codigo: string
  nombre: string
  precio_mensual: number
}

const estatusColors: Record<string, string> = {
  pendiente: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  activa: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  suspendida: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  cancelada: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
}

export default function OrgDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [org, setOrg] = useState<OrgDetail | null>(null)
  const [planes, setPlanes] = useState<Plan[]>([])

  // Suscripción dialog
  const [suspOpen, setSuspOpen] = useState(false)
  const [suspForm, setSuspForm] = useState({
    plan: '',
    estado: 'activa',
    fecha_inicio: '',
    fecha_fin: '',
  })
  const [savingSusp, setSavingSusp] = useState(false)

  const token = typeof window !== 'undefined' ? localStorage.getItem('aaces_token') : null
  const headers = useMemo(() => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) h['Authorization'] = `Bearer ${token}`
    return h
  }, [token])

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/v1/admin/organizaciones/${params.id}`, { headers })
      const data = await r.json()
      setOrg(data)
    } catch {
      setOrg(null)
    }
  }, [params.id, headers])

  const loadPlanes = useCallback(async () => {
    try {
      const r = await fetch('/api/v1/planes', { headers })
      if (r.ok) {
        const data = await r.json()
        setPlanes(data.data ?? [])
      }
    } catch {
      // planes opcionales
    }
  }, [headers])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadPlanes() }, [loadPlanes])

  const activar = async () => {
    if (!org) return
    try {
      const r = await fetch(`/api/v1/admin/organizaciones/${org.id}/activar`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({}),
      })
      if (!r.ok) throw new Error('Error al activar')
      toast.success(`Organización ${org.razon_social} activada`)
      await load()
    } catch {
      toast.error('Error al activar la organización')
    }
  }

  const suspender = async () => {
    if (!org) return
    if (!confirm('¿Suspender esta organización? Los usuarios no podrán acceder.')) return
    try {
      const r = await fetch(`/api/v1/admin/organizaciones/${org.id}/suspender`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ notas_admin: 'Suspendido por administrador' }),
      })
      if (!r.ok) throw new Error('Error al suspender')
      toast.success(`Organización ${org.razon_social} suspendida`)
      await load()
    } catch {
      toast.error('Error al suspender la organización')
    }
  }

  const abrirSuscripcion = () => {
    if (!org) return
    const actual = org.suscripciones[0]
    setSuspForm({
      plan: actual?.plan_codigo ?? planes[0]?.codigo ?? '',
      estado: actual?.estatus ?? 'activa',
      fecha_inicio: actual?.fecha_inicio ? actual.fecha_inicio.slice(0, 10) : '',
      fecha_fin: actual?.fecha_fin ? actual.fecha_fin.slice(0, 10) : '',
    })
    setSuspOpen(true)
  }

  const guardarSuscripcion = async () => {
    if (!org) return
    setSavingSusp(true)
    try {
      const body: Record<string, any> = { estado: suspForm.estado }
      if (suspForm.plan) body.plan = suspForm.plan
      if (suspForm.fecha_inicio) body.fecha_inicio = suspForm.fecha_inicio
      if (suspForm.fecha_fin) body.fecha_fin = suspForm.fecha_fin
      const r = await fetch(`/api/v1/admin/organizaciones/${org.id}/suscripcion`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(body),
      })
      if (!r.ok) throw new Error('Error al actualizar suscripción')
      toast.success(`Suscripción de ${org.razon_social} actualizada`)
      setSuspOpen(false)
      await load()
    } catch {
      toast.error('Error al actualizar la suscripción')
    } finally {
      setSavingSusp(false)
    }
  }

  if (!org) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="mx-4 lg:mx-6 flex items-center justify-between">
        <Button variant="outline" onClick={() => router.push('/admin/organizaciones')}>
          ← Volver
        </Button>
        <div className="flex items-center gap-2">
          {org.estatus === 'pendiente' && (
            <Button size="sm" onClick={activar}>Activar</Button>
          )}
          {org.estatus === 'activa' && (
            <Button size="sm" variant="destructive" onClick={suspender}>Suspender</Button>
          )}
          <Button size="sm" variant="outline" onClick={abrirSuscripcion}>Gestionar suscripción</Button>
        </div>
      </div>

      <Card className="mx-4 lg:mx-6">
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="text-2xl">{org.razon_social}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              RFC: {org.rfc} · Registrada: {org.fecha_creacion ? new Date(org.fecha_creacion).toLocaleDateString('es-MX') : '-'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${estatusColors[org.estatus] || ''}`}>
              {org.estatus}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            {org.nombre_comercial && (
              <div><Label className="text-xs text-muted-foreground">Nombre comercial</Label><p>{org.nombre_comercial}</p></div>
            )}
            <div><Label className="text-xs text-muted-foreground">Email contacto</Label><p>{org.email_contacto || '-'}</p></div>
            {org.telefono && <div><Label className="text-xs text-muted-foreground">Teléfono</Label><p>{org.telefono}</p></div>}
            {org.estado && <div><Label className="text-xs text-muted-foreground">Estado</Label><p>{org.estado}</p></div>}
            {org.ciudad && <div><Label className="text-xs text-muted-foreground">Ciudad</Label><p>{org.ciudad}</p></div>}
            {org.fecha_activacion && (
              <div><Label className="text-xs text-muted-foreground">Fecha de activación</Label><p>{new Date(org.fecha_activacion).toLocaleDateString('es-MX')}</p></div>
            )}
          </div>
          {org.notas_admin && (
            <div className="mt-4 p-3 rounded-lg bg-muted">
              <Label className="text-xs text-muted-foreground">Notas del administrador</Label>
              <p className="text-sm mt-1 whitespace-pre-wrap">{org.notas_admin}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mx-4 lg:mx-6">
        <CardHeader>
          <CardTitle>Suscripciones</CardTitle>
        </CardHeader>
        <CardContent>
          {org.suscripciones.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin suscripciones</p>
          ) : (
            <div className="space-y-3">
              {org.suscripciones.map(s => (
                <div key={s.id} className="p-4 rounded-lg border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{s.plan_nombre}</span>
                      <Badge variant={s.estatus === 'activa' ? 'default' : 'secondary'}>{s.estatus}</Badge>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-2 text-sm text-muted-foreground">
                    <div>Cursos: {s.cursos_max}</div>
                    <div>Usuarios: {s.usuarios_max}</div>
                    <div>Constancias: {s.constancias_max}</div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {s.fecha_inicio && `Inicio: ${new Date(s.fecha_inicio).toLocaleDateString('es-MX')}`}
                    {s.fecha_fin && ` · Fin: ${new Date(s.fecha_fin).toLocaleDateString('es-MX')}`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mx-4 lg:mx-6">
        <CardHeader>
          <CardTitle>Usuarios</CardTitle>
        </CardHeader>
        <CardContent>
          {org.usuarios.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin usuarios registrados</p>
          ) : (
            <div className="space-y-2">
              {org.usuarios.map(u => (
                <div key={u.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{u.nombre}</span>
                      <Badge variant="outline" className="text-xs">{u.rol}</Badge>
                      {!u.activo && <Badge variant="destructive" className="text-xs">Inactivo</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">{u.correo}</p>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {u.ultimo_acceso ? `Último acceso: ${new Date(u.ultimo_acceso).toLocaleDateString('es-MX')}` : 'Sin acceso'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Suscripción */}
      <Dialog open={suspOpen} onClose={() => setSuspOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gestionar suscripción</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Plan</Label>
              <select
                value={suspForm.plan}
                onChange={(e) => setSuspForm(s => ({ ...s, plan: e.target.value }))}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Sin plan</option>
                {planes.map(p => (
                  <option key={p.id} value={p.codigo}>{p.nombre} ({p.codigo})</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Estado</Label>
              <select
                value={suspForm.estado}
                onChange={(e) => setSuspForm(s => ({ ...s, estado: e.target.value }))}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="activa">activa</option>
                <option value="suspendida">suspendida</option>
                <option value="cancelada">cancelada</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Fecha inicio</Label>
                <Input type="date" value={suspForm.fecha_inicio} onChange={(e) => setSuspForm(s => ({ ...s, fecha_inicio: e.target.value }))} />
              </div>
              <div>
                <Label>Fecha fin</Label>
                <Input type="date" value={suspForm.fecha_fin} onChange={(e) => setSuspForm(s => ({ ...s, fecha_fin: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspOpen(false)}>Cancelar</Button>
            <Button onClick={guardarSuscripcion} disabled={savingSusp}>
              {savingSusp ? 'Guardando...' : 'Guardar suscripción'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
