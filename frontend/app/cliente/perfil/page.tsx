'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from '@/components/ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiRequest } from '@/app/services/api'

type Perfil = { id?: string; email?: string; nombre?: string; rol?: string }

export default function PerfilPage() {
  const [perfil, setPerfil] = useState<Perfil>({})
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

  const token = typeof window !== 'undefined' ? localStorage.getItem('aaces_token') : null
  const headers: Record<string,string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

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
    } finally {
      setSaving(false)
    }
  }

  

  return (
    <div className="px-4 lg:px-6">
      <Card>
        <CardHeader><CardTitle>Perfil</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span>Nombre</span>
              <div>{perfil.nombre || '-'}</div>
            </div>
            <div>
              <span>Correo</span>
              <div>{perfil.email || '-'}</div>
            </div>
            <div>
              <span>Rol</span>
              <div>{perfil.rol || 'client'}</div>
            </div>
            <div>
              <span>Empresa o negocio</span>
              <Input value={extras.empresa} onChange={(e) => setExtras(s => ({ ...s, empresa: e.target.value }))} />
            </div>
            <div>
              <span>Ciudad</span>
              <Input value={extras.ciudad} onChange={(e) => setExtras(s => ({ ...s, ciudad: e.target.value }))} />
            </div>
          <div>
            <span>Estado</span>
            <Select value={extras.estado} onValueChange={(val) => setExtras(s => ({ ...s, estado: val }))}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Aguascalientes">Aguascalientes</SelectItem>
                <SelectItem value="Baja California">Baja California</SelectItem>
                <SelectItem value="Baja California Sur">Baja California Sur</SelectItem>
                <SelectItem value="Campeche">Campeche</SelectItem>
                <SelectItem value="Coahuila">Coahuila</SelectItem>
                <SelectItem value="Colima">Colima</SelectItem>
                <SelectItem value="Chiapas">Chiapas</SelectItem>
                <SelectItem value="Chihuahua">Chihuahua</SelectItem>
                <SelectItem value="Ciudad de México">Ciudad de México</SelectItem>
                <SelectItem value="Durango">Durango</SelectItem>
                <SelectItem value="Guanajuato">Guanajuato</SelectItem>
                <SelectItem value="Guerrero">Guerrero</SelectItem>
                <SelectItem value="Hidalgo">Hidalgo</SelectItem>
                <SelectItem value="Jalisco">Jalisco</SelectItem>
                <SelectItem value="México">México</SelectItem>
                <SelectItem value="Michoacán">Michoacán</SelectItem>
                <SelectItem value="Morelos">Morelos</SelectItem>
                <SelectItem value="Nayarit">Nayarit</SelectItem>
                <SelectItem value="Nuevo León">Nuevo León</SelectItem>
                <SelectItem value="Oaxaca">Oaxaca</SelectItem>
                <SelectItem value="Puebla">Puebla</SelectItem>
                <SelectItem value="Querétaro">Querétaro</SelectItem>
                <SelectItem value="Quintana Roo">Quintana Roo</SelectItem>
                <SelectItem value="San Luis Potosí">San Luis Potosí</SelectItem>
                <SelectItem value="Sinaloa">Sinaloa</SelectItem>
                <SelectItem value="Sonora">Sonora</SelectItem>
                <SelectItem value="Tabasco">Tabasco</SelectItem>
                <SelectItem value="Tamaulipas">Tamaulipas</SelectItem>
                <SelectItem value="Tlaxcala">Tlaxcala</SelectItem>
                <SelectItem value="Veracruz">Veracruz</SelectItem>
                <SelectItem value="Yucatán">Yucatán</SelectItem>
                <SelectItem value="Zacatecas">Zacatecas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Button disabled={saving} onClick={saveExtras}>{saving ? 'Guardando…' : 'Guardar datos'}</Button>
            <Button variant="secondary" onClick={() => { window.location.href = '/cliente/cambiar-password' }}>Cambiar contraseña</Button>
            {message && <span className="text-sm opacity-80">{message}</span>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
