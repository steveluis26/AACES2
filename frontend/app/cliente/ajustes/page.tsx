'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from '@/components/ui'
import { Field } from '@/components/ui/field'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiRequest } from '@/app/services/api'

export default function AjustesPage() {
  return (
    <div className="px-4 py-4 lg:px-6 lg:py-6">
      <h1 className="text-2xl font-semibold mb-6">Ajustes</h1>
      <Tabs defaultValue="perfil">
        <TabsList>
          <TabsTrigger value="perfil">Perfil</TabsTrigger>
          <TabsTrigger value="directorio">Directorio</TabsTrigger>
          <TabsTrigger value="seguridad">Seguridad</TabsTrigger>
        </TabsList>

        <TabsContent value="perfil" className="mt-4">
          <PerfilTab />
        </TabsContent>

        <TabsContent value="directorio" className="mt-4">
          <DirectorioTab />
        </TabsContent>

        <TabsContent value="seguridad" className="mt-4">
          <SeguridadTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function PerfilTab() {
  const [perfil, setPerfil] = useState<{ nombre?: string; email?: string; rol?: string }>({})
  const [extras, setExtras] = useState<{ empresa: string; ciudad: string; estado: string }>({ empresa: '', ciudad: '', estado: '' })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    try {
      const raw = localStorage.getItem('aaces_user')
      if (raw) {
        const p = JSON.parse(raw)
        setPerfil(p)
        if (!localStorage.getItem('cliente_profile_extra')) {
          setExtras(s => ({ ...s, empresa: p.nombre || s.empresa }))
        }
      }
      const ex = localStorage.getItem('cliente_profile_extra')
      if (ex) {
        const j = JSON.parse(ex)
        setExtras({ empresa: j.empresa || '', ciudad: j.ciudad || '', estado: j.estado || '' })
      }
    } catch {}
  }, [])

  const saveExtras = async () => {
    setMessage('')
    setSaving(true)
    try {
      const ciudad_base = extras.ciudad + (extras.estado ? `, ${extras.estado}` : '')
      await apiRequest('/auth/profile', { method: 'PUT', body: JSON.stringify({ nombre: extras.empresa, ciudad_base }) })
      try { localStorage.setItem('cliente_profile_extra', JSON.stringify(extras)) } catch {}
      setMessage('Datos guardados')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Error al guardar')
    } finally { setSaving(false) }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Información de la cuenta</CardTitle></CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
          <div>
            <span className="block text-muted-foreground mb-1">Nombre</span>
            <div>{perfil.nombre || '-'}</div>
          </div>
          <div>
            <span className="block text-muted-foreground mb-1">Correo</span>
            <div>{perfil.email || '-'}</div>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <span className="block text-sm text-muted-foreground mb-1">Empresa o negocio</span>
            <Input value={extras.empresa} onChange={e => setExtras(s => ({ ...s, empresa: e.target.value }))} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <span className="block text-sm text-muted-foreground mb-1">Ciudad</span>
              <Input value={extras.ciudad} onChange={e => setExtras(s => ({ ...s, ciudad: e.target.value }))} />
            </div>
            <div>
              <span className="block text-sm text-muted-foreground mb-1">Estado</span>
              <Select value={extras.estado} onValueChange={val => setExtras(s => ({ ...s, estado: val }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {["Aguascalientes","Baja California","Baja California Sur","Campeche","Coahuila","Colima","Chiapas","Chihuahua","Ciudad de México","Durango","Guanajuato","Guerrero","Hidalgo","Jalisco","México","Michoacán","Morelos","Nayarit","Nuevo León","Oaxaca","Puebla","Querétaro","Quintana Roo","San Luis Potosí","Sinaloa","Sonora","Tabasco","Tamaulipas","Tlaxcala","Veracruz","Yucatán","Zacatecas"].map(e => (
                    <SelectItem key={e} value={e}>{e}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button disabled={saving} onClick={saveExtras}>{saving ? 'Guardando…' : 'Guardar cambios'}</Button>
            {message && <span className="text-sm">{message}</span>}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function DirectorioTab() {
  const [form, setForm] = useState({ nombre_comercial: '', descripcion_publica: '', sitio_web: '', logo_url: '', telefono: '', email_contacto: '', ciudad: '', estado: '' })
  const [stps, setStps] = useState<{ validado: boolean; registro: string | null }>({ validado: false, registro: null })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    (async () => {
      try {
        const p = await apiRequest<any>('/organizaciones/perfil')
        setForm({
          nombre_comercial: p.nombre_comercial || '',
          descripcion_publica: p.descripcion_publica || '',
          sitio_web: p.sitio_web || '',
          logo_url: p.logo_url || '',
          telefono: p.telefono || '',
          email_contacto: p.email_contacto || '',
          ciudad: p.ciudad || '',
          estado: p.estado || '',
        })
        setStps({ validado: !!p.stps_validado, registro: p.stps_registro || null })
      } catch {}
      finally { setLoading(false) }
    })()
  }, [])

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const guardar = async () => {
    setMessage('')
    setSaving(true)
    try {
      await apiRequest('/organizaciones/perfil', { method: 'PUT', body: JSON.stringify(form) })
      setMessage('Perfil público guardado')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Error al guardar')
    } finally { setSaving(false) }
  }

  if (loading) return <Card><CardContent className="py-6 text-sm text-muted-foreground">Cargando perfil…</CardContent></Card>

  return (
    <Card>
      <CardHeader>
        <CardTitle>Perfil público del directorio</CardTitle>
        <p className="text-sm text-muted-foreground">Esto es lo que verán las empresas cuando el directorio esté disponible.</p>
      </CardHeader>
      <CardContent>
        <div className="mb-4 text-sm">
          {stps.validado ? (
            <span className="inline-block rounded-full bg-green-100 text-green-800 px-3 py-1 text-xs font-semibold">✓ Agente Capacitador validado STPS{stps.registro ? ` · ${stps.registro}` : ''}</span>
          ) : (
            <span className="inline-block rounded-full bg-amber-100 text-amber-800 px-3 py-1 text-xs font-semibold">Validación STPS pendiente</span>
          )}
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <span className="block text-sm text-muted-foreground mb-1">Nombre comercial</span>
              <Input value={form.nombre_comercial} onChange={e => set('nombre_comercial', e.target.value)} placeholder="Ej. Capacitación Industrial del Norte" />
            </div>
            <div>
              <span className="block text-sm text-muted-foreground mb-1">Sitio web</span>
              <Input value={form.sitio_web} onChange={e => set('sitio_web', e.target.value)} placeholder="tudominio.com" />
            </div>
          </div>
          <div>
            <span className="block text-sm text-muted-foreground mb-1">Descripción pública</span>
            <Input value={form.descripcion_publica} onChange={e => set('descripcion_publica', e.target.value)} placeholder="A qué se dedica tu agencia, experiencia, cobertura…" />
          </div>
          <div>
            <span className="block text-sm text-muted-foreground mb-1">Logo (URL de imagen)</span>
            <Input value={form.logo_url} onChange={e => set('logo_url', e.target.value)} placeholder="https://…" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <span className="block text-sm text-muted-foreground mb-1">Teléfono público</span>
              <Input value={form.telefono} onChange={e => set('telefono', e.target.value)} />
            </div>
            <div>
              <span className="block text-sm text-muted-foreground mb-1">Correo público</span>
              <Input value={form.email_contacto} onChange={e => set('email_contacto', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <span className="block text-sm text-muted-foreground mb-1">Ciudad</span>
              <Input value={form.ciudad} onChange={e => set('ciudad', e.target.value)} />
            </div>
            <div>
              <span className="block text-sm text-muted-foreground mb-1">Estado</span>
              <Input value={form.estado} onChange={e => set('estado', e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button disabled={saving} onClick={guardar}>{saving ? 'Guardando…' : 'Guardar perfil público'}</Button>
            {message && <span className="text-sm">{message}</span>}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function SeguridadTab() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState('')
  const token = typeof window !== 'undefined' ? localStorage.getItem('aaces_token') : null

  const submit = async () => {
    setMessage('')
    if (next.length < 6) { setMessage('La contraseña debe tener al menos 6 caracteres'); return }
    if (next !== confirm) { setMessage('Las contraseñas no coinciden'); return }
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch('/api/v1/clientes/me/password', { method: 'PUT', headers, body: JSON.stringify({ current_password: current, new_password: next }) })
    if (res.ok) {
      setMessage('Contraseña actualizada. Inicia sesión nuevamente.')
      try { localStorage.removeItem('aaces_token'); localStorage.removeItem('aaces_user') } catch {}
      setTimeout(() => { window.location.href = '/login' }, 1000)
    } else {
      const data = await res.json().catch(() => ({}))
      setMessage(data.detail || 'Error actualizando la contraseña')
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Cambiar contraseña</CardTitle></CardHeader>
      <CardContent>
        <div className="space-y-3 max-w-md">
          <Field label="Contraseña actual" htmlFor="aj_current">
            <Input id="aj_current" type="password" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} />
          </Field>
          <Field label="Nueva contraseña" htmlFor="aj_next">
            <Input id="aj_next" type="password" autoComplete="new-password" value={next} onChange={e => setNext(e.target.value)} />
          </Field>
          <Field label="Confirmar nueva contraseña" htmlFor="aj_confirm">
            <Input id="aj_confirm" type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} />
          </Field>
          <Button onClick={submit}>Guardar contraseña</Button>
          {message && <div className="text-sm">{message}</div>}
        </div>
      </CardContent>
    </Card>
  )
}
