'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from '@/components/ui'

type Perfil = { id?: string; email?: string; nombre?: string; rol?: string }

export default function AdminPerfilPage() {
  const [perfil, setPerfil] = useState<Perfil>({})
  const [edit, setEdit] = useState({ nombre: '', email: '' })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' })
  const [pwdMsg, setPwdMsg] = useState('')

  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('aaces_user') : null
      if (raw) {
        const u = JSON.parse(raw)
        setPerfil(u)
        setEdit({ nombre: u.nombre || '', email: u.email || '' })
      }
    } catch {}
  }, [])

  const headers: Record<string,string> = { 'Content-Type': 'application/json' }
  const token = typeof window !== 'undefined' ? localStorage.getItem('aaces_token') : null
  if (token) headers['Authorization'] = `Bearer ${token}`

  const saveProfile = async () => {
    setMessage('')
    setSaving(true)
    try {
      const res = await fetch('/api/v1/auth/profile', { method: 'PUT', headers, body: JSON.stringify({ nombre: edit.nombre, correo: edit.email }) })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || `Error ${res.status}`)
      }
      const me = await fetch('/api/v1/auth/me', { headers })
      const mejson = await me.json().catch(() => null)
      if (mejson) {
        try { localStorage.setItem('aaces_user', JSON.stringify(mejson)) } catch {}
        setPerfil(mejson)
      }
      setMessage('Perfil actualizado')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Error al actualizar')
    } finally {
      setSaving(false)
    }
  }

  const changePassword = async () => {
    setPwdMsg('')
    const { current, next, confirm } = pwd
    if (next.length < 6) { setPwdMsg('La contraseña debe tener al menos 6 caracteres'); return }
    if (next !== confirm) { setPwdMsg('Las contraseñas no coinciden'); return }
    const res = await fetch('/api/v1/auth/change-password', { method: 'POST', headers, body: JSON.stringify({ current_password: current, new_password: next }) })
    if (res.ok) {
      setPwdMsg('Contraseña actualizada. Inicia sesión nuevamente.')
      try { localStorage.removeItem('aaces_token'); localStorage.removeItem('aaces_user') } catch {}
      setTimeout(() => { window.location.href = '/login' }, 1000)
    } else {
      const data = await res.json().catch(() => ({}))
      setPwdMsg(data.detail || 'Error actualizando la contraseña')
    }
  }

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 lg:px-6">
        <h1 className="text-2xl font-semibold">Perfil</h1>
      </div>
      <div className="px-4 lg:px-6 space-y-6">
        <Card>
          <CardHeader><CardTitle>Información</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span>Nombre</span>
                <Input value={edit.nombre} onChange={(e) => setEdit(s => ({ ...s, nombre: e.target.value }))} />
              </div>
              <div>
                <span>Correo</span>
                <Input type="email" value={edit.email} onChange={(e) => setEdit(s => ({ ...s, email: e.target.value }))} />
              </div>
              <div>
                <span>Rol</span>
                <div>{perfil.rol || 'admin'}</div>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <Button disabled={saving} onClick={saveProfile}>{saving ? 'Guardando…' : 'Guardar cambios'}</Button>
              {message && <span className="text-sm opacity-80">{message}</span>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Cambiar contraseña</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span>Actual</span>
                <Input type="password" value={pwd.current} onChange={(e) => setPwd(s => ({ ...s, current: e.target.value }))} />
              </div>
              <div>
                <span>Nueva</span>
                <Input type="password" value={pwd.next} onChange={(e) => setPwd(s => ({ ...s, next: e.target.value }))} />
              </div>
              <div>
                <span>Confirmar</span>
                <Input type="password" value={pwd.confirm} onChange={(e) => setPwd(s => ({ ...s, confirm: e.target.value }))} />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <Button variant="secondary" onClick={changePassword}>Actualizar contraseña</Button>
              {pwdMsg && <span className="text-sm opacity-80">{pwdMsg}</span>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
