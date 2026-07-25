'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ShieldCheck, QrCode, GraduationCap, Loader2 } from 'lucide-react'
import { login, getUser, clearToken } from './lib/api'
import { ErrorBeacon } from '@/components/error-beacon'

export default function DemoEntryPage() {
  const router = useRouter()
  const [correo, setCorreo] = useState('cliente.demo@aaces.mx')
  const [password, setPassword] = useState('demo1234')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const doLogin = async (c: string, p: string) => {
    setLoading(true)
    setError('')
    try {
      await login(c, p)
      router.push('/demo/cursos')
    } catch (e: any) {
      setError(e?.message || 'No se pudo iniciar sesión')
      setLoading(false)
    }
  }

  const user = typeof window !== 'undefined' ? getUser() : null

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center p-4">
      <ErrorBeacon />
      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-8 items-center">
        {/* Lado izquierdo: propuesta de valor */}
        <div className="hidden md:flex flex-col gap-6">
          <div className="flex items-center gap-2 text-2xl font-bold text-slate-800">
            <ShieldCheck className="h-8 w-8 text-emerald-600" /> AACES · Demo
          </div>
          <h1 className="text-3xl font-bold text-slate-900 leading-tight">
            De un curso a una constancia verificable en minutos.
          </h1>
          <p className="text-slate-600">
            Registra un curso, da de alta a tus participantes y emite constancias con
            código QR y folio. Cualquiera puede validar su autenticidad escaneando el QR.
          </p>
          <div className="space-y-3">
            <Feature icon={<GraduationCap className="h-5 w-5 text-emerald-600" />} text="Crea cursos y agrega participantes" />
            <Feature icon={<QrCode className="h-5 w-5 text-emerald-600" />} text="Genera constancias con QR + folio + hash" />
            <Feature icon={<ShieldCheck className="h-5 w-5 text-emerald-600" />} text="Verificación pública e inalterable" />
          </div>
        </div>

        {/* Lado derecho: login */}
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-xl">Entrar al demo</CardTitle>
            <p className="text-sm text-muted-foreground">
              Usa la cuenta de demostración o tus credenciales de cliente.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2">
                {error}
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="correo">Correo</Label>
              <Input id="correo" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="cliente.demo@aaces.mx" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button className="w-full" disabled={loading} onClick={() => doLogin(correo, password)}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Entrar
            </Button>
            <Button variant="outline" className="w-full" disabled={loading} onClick={() => doLogin('cliente.demo@aaces.mx', 'demo1234')}>
              Entrar como demo (1 click)
            </Button>
          </CardContent>
          <CardFooter className="text-xs text-muted-foreground justify-center">
            Cuenta demo: cliente.demo@aaces.mx / demo1234
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}

function Feature({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3 text-slate-700">
      <div className="bg-emerald-50 rounded-full p-2">{icon}</div>
      <span>{text}</span>
    </div>
  )
}
