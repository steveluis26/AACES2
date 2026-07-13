'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card, CardHeader, CardTitle, CardContent,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

type Organizacion = {
  id: string
  rfc: string
  razon_social: string
  nombre_comercial?: string
  email_contacto?: string
  estado?: string
  ciudad?: string
  estatus: string
  fecha_creacion?: string
  num_usuarios: number
  suscripciones_activas: number
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

export default function AdminOrganizacionesPage() {
  const router = useRouter()
  const [orgs, setOrgs] = useState<Organizacion[]>([])
  const [search, setSearch] = useState('')
  const [filtroEstatus, setFiltroEstatus] = useState('')
  const [planes, setPlanes] = useState<Plan[]>([])
  const [activarOpen, setActivarOpen] = useState(false)
  const [activarOrg, setActivarOrg] = useState<Organizacion | null>(null)
  const [activarForm, setActivarForm] = useState({
    plan_id: '',
    vigencia_desde: '',
    vigencia_hasta: '',
    cursos_max: '',
    notas_admin: '',
  })

  const token = typeof window !== 'undefined' ? localStorage.getItem('aaces_token') : null
  const headers = useMemo(() => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) h['Authorization'] = `Bearer ${token}`
    return h
  }, [token])

  const loadOrgs = useCallback(async () => {
    try {
      let url = '/api/v1/admin/organizaciones?per_page=100'
      if (filtroEstatus) url += `&estatus=${filtroEstatus}`
      const r = await fetch(url, { headers })
      const data = await r.json()
      setOrgs(data.data ?? [])
    } catch {
      setOrgs([])
    }
  }, [headers, filtroEstatus])

  const loadPlanes = useCallback(async () => {
    try {
      const adminR = await fetch('/api/v1/admin/clientes?limit=1', { headers })
      const r = await fetch('/api/v1/planes', { headers })
      if (r.ok) {
        const data = await r.json()
        setPlanes(data.data ?? [])
      }
    } catch {
      // Will get planes from a direct API call if needed
    }
  }, [headers])

  useEffect(() => { loadOrgs() }, [loadOrgs])
  useEffect(() => { loadPlanes() }, [loadPlanes])

  const pendientes = orgs.filter(o => o.estatus === 'pendiente').length

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return orgs
    return orgs.filter(o =>
      o.razon_social.toLowerCase().includes(term) ||
      o.rfc.toLowerCase().includes(term) ||
      (o.nombre_comercial && o.nombre_comercial.toLowerCase().includes(term)) ||
      (o.email_contacto && o.email_contacto.toLowerCase().includes(term))
    )
  }, [orgs, search])

  const abrirActivar = (org: Organizacion) => {
    setActivarOrg(org)
    setActivarForm({ plan_id: '', vigencia_desde: '', vigencia_hasta: '', cursos_max: '', notas_admin: '' })
    setActivarOpen(true)
  }

  const activarOrgSubmit = async () => {
    if (!activarOrg) return
    try {
      const body: Record<string, any> = {}
      if (activarForm.plan_id) body.plan_id = activarForm.plan_id
      if (activarForm.vigencia_desde) body.vigencia_desde = activarForm.vigencia_desde
      if (activarForm.vigencia_hasta) body.vigencia_hasta = activarForm.vigencia_hasta
      if (activarForm.cursos_max) body.cursos_max = parseInt(activarForm.cursos_max)
      if (activarForm.notas_admin) body.notas_admin = activarForm.notas_admin

      const r = await fetch(`/api/v1/admin/organizaciones/${activarOrg.id}/activar`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(body),
      })
      if (!r.ok) throw new Error('Error al activar')
      setActivarOpen(false)
      await loadOrgs()
    } catch {
      alert('Error al activar la organización')
    }
  }

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <Card className="mx-4 lg:mx-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Organizaciones</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {pendientes > 0
                ? <span className="text-yellow-600 font-medium">{pendientes} pendiente(s) de activación</span>
                : 'Todas activas'}
            </p>
          </div>
          <div className="flex gap-2">
            <select
              value={filtroEstatus}
              onChange={(e) => setFiltroEstatus(e.target.value)}
              className="flex h-9 w-40 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Todos los estados</option>
              <option value="pendiente">Pendientes</option>
              <option value="activa">Activas</option>
              <option value="suspendida">Suspendidas</option>
              <option value="cancelada">Canceladas</option>
            </select>
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64"
            />
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No hay organizaciones registradas</p>
          ) : (
            <div className="space-y-2">
              {filtered.map((org) => (
                <div
                  key={org.id}
                  className="flex items-center justify-between p-4 rounded-lg border transition-colors hover:bg-accent cursor-pointer"
                  onClick={() => router.push(`/admin/organizaciones/${org.id}`)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{org.razon_social}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${estatusColors[org.estatus] || ''}`}>
                        {org.estatus}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      RFC: {org.rfc} · {org.email_contacto || 'Sin correo'}
                      {org.ciudad && ` · ${org.ciudad}`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {org.num_usuarios} usuario(s) · {org.suscripciones_activas} suscripción(es) activa(s)
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    {org.estatus === 'pendiente' && (
                      <Button size="sm" onClick={(e) => { e.stopPropagation(); abrirActivar(org) }}>
                        Activar
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); router.push(`/admin/organizaciones/${org.id}`) }}>
                      Ver detalle
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={activarOpen} onOpenChange={setActivarOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Activar organización</DialogTitle>
          </DialogHeader>
          {activarOrg && (
            <div className="space-y-4">
              <div className="text-sm">
                <strong>{activarOrg.razon_social}</strong> · RFC: {activarOrg.rfc}
              </div>
              <div>
                <Label>Plan</Label>
                <select
                  value={activarForm.plan_id}
                  onChange={(e) => setActivarForm(s => ({ ...s, plan_id: e.target.value }))}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Seleccionar plan</option>
                  {planes.map(p => (
                    <option key={p.id} value={p.id}>{p.nombre} (${p.precio_mensual}/mes)</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Vigencia desde</Label>
                  <Input type="date" value={activarForm.vigencia_desde} onChange={(e) => setActivarForm(s => ({ ...s, vigencia_desde: e.target.value }))} />
                </div>
                <div>
                  <Label>Vigencia hasta</Label>
                  <Input type="date" value={activarForm.vigencia_hasta} onChange={(e) => setActivarForm(s => ({ ...s, vigencia_hasta: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Cursos máximos (opcional, usa el del plan si se deja vacío)</Label>
                <Input type="number" value={activarForm.cursos_max} onChange={(e) => setActivarForm(s => ({ ...s, cursos_max: e.target.value }))} />
              </div>
              <div>
                <Label>Notas</Label>
                <textarea
                  value={activarForm.notas_admin}
                  onChange={(e) => setActivarForm(s => ({ ...s, notas_admin: e.target.value }))}
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="Notas internas"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActivarOpen(false)}>Cancelar</Button>
            <Button onClick={activarOrgSubmit}>Activar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
