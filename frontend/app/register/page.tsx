'use client'

import React, { useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'

const STEPS = ['organizacion', 'admin', 'confirmacion']

function RegisterForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const plan = searchParams.get('plan') || 'trial'
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)

  const [org, setOrg] = useState({ rfc: '', razon_social: '', nombre_comercial: '', estado: '', ciudad: '' })
  const [admin, setAdmin] = useState({ nombre: '', correo: '', password: '', confirmar: '' })
  const [acepta, setAcepta] = useState(false)

  const PLANES: Record<string, { label: string; precio: string }> = {
    profesional: { label: 'Profesional', precio: '$499/mes' },
    empresa: { label: 'Empresa', precio: '$1,299/mes' },
  }
  const planPago = PLANES[plan]
  const planLabel = planPago ? planPago.label : 'Prueba gratuita'
  const planPrice = planPago ? `${planPago.precio} IVA incluido` : 'Gratis por 30 días'

  const handleOrgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setOrg(s => ({ ...s, [name]: name === 'rfc' ? value.toUpperCase() : value }))
  }

  const handleAdminChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setAdmin(s => ({ ...s, [name]: value }))
  }

  const validarPaso1 = () => {
    if (!org.rfc || org.rfc.length < 12) {
      toast.error('RFC inválido (debe tener al menos 12 caracteres)')
      return false
    }
    if (!org.razon_social) {
      toast.error('La razón social es requerida')
      return false
    }
    return true
  }

  const validarPaso2 = () => {
    if (!admin.nombre) {
      toast.error('El nombre del administrador es requerido')
      return false
    }
    if (!admin.correo || !admin.correo.includes('@')) {
      toast.error('Correo electrónico inválido')
      return false
    }
    if (!admin.password || admin.password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres')
      return false
    }
    if (admin.password !== admin.confirmar) {
      toast.error('Las contraseñas no coinciden')
      return false
    }
    if (!acepta) {
      toast.error('Debes aceptar los términos y condiciones')
      return false
    }
    return true
  }

  const submit = async () => {
    setLoading(true)
    try {
      const payload = {
        organizacion: {
          rfc: org.rfc,
          razon_social: org.razon_social,
          nombre_comercial: org.nombre_comercial || undefined,
          estado: org.estado || undefined,
          ciudad: org.ciudad || undefined,
        },
        admin: {
          nombre: admin.nombre,
          correo: admin.correo,
          password: admin.password,
        },
        plan: plan,
      }

      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'Error al registrar')
      }

      setStep(2) // Show confirmation
    } catch (err: any) {
      toast.error(err.message || 'No se pudo completar el registro')
    } finally {
      setLoading(false)
    }
  }

  if (step === 2) {
    return (
      <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex items-center justify-center">
        <Card className="max-w-lg w-full mx-4">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600 dark:text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <CardTitle className="text-2xl">Registro exitoso</CardTitle>
            <CardDescription className="mt-2">
              Tu organización <strong>{org.razon_social}</strong> ya está lista con <strong>30 días de prueba</strong> y 50 constancias.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              Ya puedes iniciar sesión y empezar a usar AACES.
              {planPago && (
                <>
                  <br /><br />
                  Al iniciar sesión te llevamos a activar tu plan <strong>{planPago.label}</strong> con Mercado Pago.
                  Mientras tanto usas la prueba sin costo.
                </>
              )}
            </p>
            <div className="pt-4 space-y-2">
              <Button className="w-full" onClick={() => router.push(planPago ? `/login?next=${encodeURIComponent(`/cliente/pagos?plan=${plan}`)}` : '/login')}>
                Ir a iniciar sesión
              </Button>
              <Button variant="outline" className="w-full" onClick={() => router.push('/')}>
                Volver al inicio
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex items-center justify-center py-12">
      <div className="max-w-lg w-full mx-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold">Crear cuenta</h1>
          <p className="mt-2 text-muted-foreground">
            Plan: <strong>{planLabel}</strong> — {planPrice}
          </p>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step >= 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>1</div>
          <div className="w-16 h-0.5 bg-muted"><div className={`h-full bg-primary transition-all ${step >= 1 ? 'w-full' : 'w-0'}`} /></div>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>2</div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{step === 0 ? 'Datos de la organización' : 'Administrador'}</CardTitle>
            <CardDescription>
              {step === 0
                ? 'Ingresa los datos de tu agencia o empresa'
                : 'Datos de la persona que administrará la cuenta'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === 0 ? (
              <form onSubmit={(e) => { e.preventDefault(); if (validarPaso1()) setStep(1) }} className="space-y-4">
                <div>
                  <Label htmlFor="rfc">RFC *</Label>
                  <Input id="rfc" name="rfc" value={org.rfc} onChange={handleOrgChange} placeholder="ABC010203XYZ" maxLength={13} className="uppercase" />
                </div>
                <div>
                  <Label htmlFor="razon_social">Razón social *</Label>
                  <Input id="razon_social" name="razon_social" value={org.razon_social} onChange={handleOrgChange} placeholder="Capacitación del Golfo S.A. de C.V." />
                </div>
                <div>
                  <Label htmlFor="nombre_comercial">Nombre comercial</Label>
                  <Input id="nombre_comercial" name="nombre_comercial" value={org.nombre_comercial} onChange={handleOrgChange} placeholder="Opcional" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="estado">Estado</Label>
                    <Input id="estado" name="estado" value={org.estado} onChange={handleOrgChange} placeholder="Ej: Veracruz" />
                  </div>
                  <div>
                    <Label htmlFor="ciudad">Ciudad</Label>
                    <Input id="ciudad" name="ciudad" value={org.ciudad} onChange={handleOrgChange} placeholder="Ej: Coatzacoalcos" />
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <Button type="submit">Continuar</Button>
                </div>
              </form>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); if (validarPaso2()) submit() }} className="space-y-4">
                <div>
                  <Label htmlFor="nombre">Nombre completo *</Label>
                  <Input id="nombre" name="nombre" value={admin.nombre} onChange={handleAdminChange} placeholder="Tu nombre" />
                </div>
                <div>
                  <Label htmlFor="correo">Correo electrónico *</Label>
                  <Input id="correo" name="correo" type="email" value={admin.correo} onChange={handleAdminChange} placeholder="admin@miempresa.com" />
                </div>
                <div>
                  <Label htmlFor="password">Contraseña *</Label>
                  <Input id="password" name="password" type="password" value={admin.password} onChange={handleAdminChange} placeholder="Mínimo 6 caracteres" />
                </div>
                <div>
                  <Label htmlFor="confirmar">Confirmar contraseña *</Label>
                  <Input id="confirmar" name="confirmar" type="password" value={admin.confirmar} onChange={handleAdminChange} placeholder="Repite la contraseña" />
                </div>
                <div className="flex items-center gap-3">
                  <Checkbox id="acepta" checked={acepta} onCheckedChange={(v) => setAcepta(!!v)} />
                  <Label htmlFor="acepta" className="text-sm text-muted-foreground">
                    Acepto los términos y condiciones y el aviso de privacidad
                  </Label>
                </div>
                <div className="flex justify-between pt-2">
                  <Button type="button" variant="outline" onClick={() => setStep(0)}>Atrás</Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Registrando...' : 'Crear cuenta'}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    }>
      <RegisterForm />
    </Suspense>
  )
}
