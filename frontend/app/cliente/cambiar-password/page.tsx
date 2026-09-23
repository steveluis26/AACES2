'use client'

import React, { useState } from 'react'
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from '@/components/ui'
import { Field } from '@/components/ui/field'

export default function CambiarPasswordPage() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState('')

  const token = typeof window !== 'undefined' ? localStorage.getItem('aaces_token') : null

  const submit = async () => {
    setMessage('')
    if (next.length < 6) { setMessage('La contraseña debe tener al menos 6 caracteres'); return }
    if (next !== confirm) { setMessage('Las contraseñas no coinciden'); return }
    const headers: Record<string,string> = { 'Content-Type': 'application/json' }
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
    <div className="p-6">
      <Card>
        <CardHeader><CardTitle>Cambiar contraseña</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:items-start">
            <Field label="Contraseña actual" htmlFor="cp_current">
              <Input id="cp_current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
            </Field>
            <Field label="Nueva contraseña" htmlFor="cp_next">
              <Input id="cp_next" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
            </Field>
            <Field label="Confirmar nueva contraseña" htmlFor="cp_confirm">
              <Input id="cp_confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </Field>
          </div>
          <div className="mt-3"><Button onClick={submit}>Guardar</Button></div>
          {message && <div role="status" className="mt-2 text-sm">{message}</div>}
        </CardContent>
      </Card>
    </div>
  )
}