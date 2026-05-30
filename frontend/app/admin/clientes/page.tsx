'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Input, Card, CardHeader, CardTitle, CardContent, Table, THead, TBody, TR, TH, TD, Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter, Badge } from '@/components/ui'
import { Label } from '@/components/ui/label'

type Cliente = { id: string; nombre: string; correo: string; ciudad_base?: string; categoria: string; estado: string; vigencia_desde?: string | null; vigencia_hasta?: string | null; vigente?: boolean }

export default function AdminClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [search, setSearch] = useState('')
  const [estado, setEstado] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [nuevo, setNuevo] = useState<any>({ nombre: '', correo: '', categoria: 'basico', ciudad_base: '' })
  const [tempPwd, setTempPwd] = useState<Record<string, string>>({})
  const [editOpen, setEditOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editData, setEditData] = useState<any>({})

  const token = typeof window !== 'undefined' ? localStorage.getItem('aaces_token') : null
  const headers = useMemo(() => {
    const h: Record<string,string> = { 'Content-Type': 'application/json' }
    if (token) h['Authorization'] = `Bearer ${token}`
    return h
  }, [token])

  const load = useCallback(async () => {
    const r = await fetch('/api/v1/admin/clientes?limit=200', { headers })
    const data = await r.json()
    setClientes(data.data ?? [])
  }, [headers])

  useEffect(() => { load() }, [load])

  const crearCliente = async () => {
    await fetch('/api/v1/admin/clientes', { method: 'POST', headers, body: JSON.stringify(nuevo) })
    setNuevo({ nombre: '', correo: '', categoria: 'basico', ciudad_base: '' })
    setShowForm(false)
    await load()
  }

  const filtered = clientes.filter(c => {
    const term = search.trim().toLowerCase()
    const okSearch = term === '' || [c.nombre, c.correo, c.ciudad_base ?? ''].some(v => v.toLowerCase().includes(term))
    const okEstado = estado === '' || c.estado === estado
    return okSearch && okEstado
  })

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 lg:px-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Clientes</h1>
          <div className="flex items-center gap-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <Input placeholder="Buscar por nombre/correo/ciudad" value={search} onChange={(e) => setSearch(e.target.value)} />
              <select className="border rounded px-2 py-2" value={estado} onChange={(e) => setEstado(e.target.value)}>
                <option value="">todos</option>
                <option value="activo">activo</option>
                <option value="suspendido">suspendido</option>
                <option value="eliminado">eliminado</option>
              </select>
              <Button variant="secondary" onClick={load}>Actualizar</Button>
            </div>
            <Button onClick={() => setShowForm(s => !s)}>{showForm ? 'Cerrar' : 'Nuevo cliente'}</Button>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="px-4 lg:px-6">
          <Card>
            <CardHeader><CardTitle>Crear cliente</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                <div>
                  <Label>Nombre</Label>
                  <Input className="mt-1 bg-background" value={nuevo.nombre} onChange={(e) => setNuevo((s: any) => ({ ...s, nombre: e.target.value }))} />
                </div>
                <div>
                  <Label>Correo</Label>
                  <Input className="mt-1 bg-background" value={nuevo.correo} onChange={(e) => setNuevo((s: any) => ({ ...s, correo: e.target.value }))} />
                </div>
                <div>
                  <Label>Ciudad base</Label>
                  <Input className="mt-1 bg-background" value={nuevo.ciudad_base} onChange={(e) => setNuevo((s: any) => ({ ...s, ciudad_base: e.target.value }))} />
                </div>
                <div>
                  <Label>Categoría</Label>
                  <select className="mt-1 w-full border border-input rounded px-2 py-2 bg-background text-foreground" value={nuevo.categoria} onChange={(e) => setNuevo((s: any) => ({ ...s, categoria: e.target.value }))}>
                  <option value="basico">basico</option>
                  <option value="premium">premium</option>
                  <option value="enterprise">enterprise</option>
                </select>
                </div>
                <div>
                  <Label>Vigencia desde</Label>
                  <Input type="date" className="mt-1 bg-background" onChange={(e) => setNuevo((s: any) => ({ ...s, vigencia_desde: e.target.value }))} />
                </div>
                <div>
                  <Label>Vigencia hasta</Label>
                  <Input type="date" className="mt-1 bg-background" onChange={(e) => setNuevo((s: any) => ({ ...s, vigencia_hasta: e.target.value }))} />
                </div>
              </div>
              <div className="mt-3"><Button onClick={crearCliente}>Crear</Button></div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="px-4 lg:px-6">
        <Card>
          <CardHeader><CardTitle>Listado</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <THead>
                <TR>
                  <TH>Nombre</TH>
                  <TH>Correo</TH>
                  <TH>Ciudad</TH>
                  <TH>Categoría</TH>
                  <TH>Estado</TH>
                  <TH>Vigencia</TH>
                  <TH>Vigente</TH>
                  <TH className="text-right">Acciones</TH>
                </TR>
              </THead>
              <TBody>
                {filtered.map(c => (
                  <TR key={c.id}>
                    <TD>{c.nombre}</TD>
                    <TD className="font-mono text-xs">{c.correo}</TD>
                    <TD>{c.ciudad_base || '-'}</TD>
                    <TD><Badge variant="secondary">{c.categoria}</Badge></TD>
                    <TD>{c.estado}</TD>
                    <TD className="text-xs">{c.vigencia_desde || '-'}{c.vigencia_hasta ? ` → ${c.vigencia_hasta}` : ''}</TD>
                    <TD>
                      {c.vigente ? (
                        <Badge className="text-xs" variant="default">vigente</Badge>
                      ) : (
                        <Badge className="text-xs" variant="destructive">no vigente</Badge>
                      )}
                    </TD>
                    <TD className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="secondary" onClick={() => {
                          setEditId(c.id)
                          setEditData({ nombre: c.nombre, correo: c.correo, ciudad_base: c.ciudad_base || '', categoria: c.categoria, estado: c.estado, vigencia_desde: c.vigencia_desde || '', vigencia_hasta: c.vigencia_hasta || '' })
                          setEditOpen(true)
                        }}>Editar</Button>
                        <Button variant="outline" onClick={async () => {
                          const r = await fetch(`/api/v1/admin/clientes/${c.id}/password/temp`, { method: 'POST', headers })
                          const data = await r.json()
                          setTempPwd(prev => ({ ...prev, [c.id]: data.temp_password }))
                        }}>Temp pass</Button>
                      </div>
                      {tempPwd[c.id] && (
                        <div className="mt-2 text-xs"><span>Temp:</span> <span className="font-mono">{tempPwd[c.id]}</span></div>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)}>
        <DialogHeader><DialogTitle>Editar cliente</DialogTitle></DialogHeader>
        <DialogContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Nombre</Label>
              <Input className="mt-1 bg-background" value={editData.nombre || ''} onChange={(e) => setEditData((s: any) => ({ ...s, nombre: e.target.value }))} />
            </div>
            <div>
              <Label>Correo</Label>
              <Input className="mt-1 bg-background" value={editData.correo || ''} onChange={(e) => setEditData((s: any) => ({ ...s, correo: e.target.value }))} />
            </div>
            <div>
              <Label>Ciudad base</Label>
              <Input className="mt-1 bg-background" value={editData.ciudad_base || ''} onChange={(e) => setEditData((s: any) => ({ ...s, ciudad_base: e.target.value }))} />
            </div>
            <div>
              <Label>Categoría</Label>
              <select className="mt-1 w-full border border-input rounded px-2 py-2 bg-background text-foreground" value={editData.categoria} onChange={(e) => setEditData((s: any) => ({ ...s, categoria: e.target.value }))}>
                <option value="basico">basico</option>
                <option value="premium">premium</option>
                <option value="enterprise">enterprise</option>
              </select>
            </div>
            <div>
              <Label>Estado</Label>
              <select className="mt-1 w-full border border-input rounded px-2 py-2 bg-background text-foreground" value={editData.estado} onChange={(e) => setEditData((s: any) => ({ ...s, estado: e.target.value }))}>
                <option value="activo">activo</option>
                <option value="suspendido">suspendido</option>
                <option value="eliminado">eliminado</option>
              </select>
            </div>
            <div>
              <Label>Nueva contraseña</Label>
              <Input className="mt-1 bg-background" type="password" value={editData.password || ''} onChange={(e) => setEditData((s: any) => ({ ...s, password: e.target.value }))} />
            </div>
            <div>
              <Label>Vigencia desde</Label>
              <Input className="mt-1 bg-background" type="date" value={editData.vigencia_desde || ''} onChange={(e) => setEditData((s: any) => ({ ...s, vigencia_desde: e.target.value }))} />
            </div>
            <div>
              <Label>Vigencia hasta</Label>
              <Input className="mt-1 bg-background" type="date" value={editData.vigencia_hasta || ''} onChange={(e) => setEditData((s: any) => ({ ...s, vigencia_hasta: e.target.value }))} />
            </div>
          </div>
        </DialogContent>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setEditOpen(false)}>Cancelar</Button>
          <Button onClick={async () => {
            if (!editId) return
            const { password, ...rest } = editData
            await fetch(`/api/v1/admin/clientes/${editId}`, { method: 'PUT', headers, body: JSON.stringify(rest) })
            if (password && password.length >= 6) {
              await fetch(`/api/v1/admin/clientes/${editId}/password`, { method: 'PUT', headers, body: JSON.stringify({ password }) })
            }
            setEditOpen(false)
            setEditId(null)
            setEditData({})
            await load()
          }}>Guardar</Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
