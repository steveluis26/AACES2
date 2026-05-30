'use client'

import React, { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'

export default function ContactoPage() {
  const [form, setForm] = useState({
    nombre: '',
    email: '',
    empresa: '',
    asunto: 'soporte',
    mensaje: '',
    acepta: false,
  })
  const [loading, setLoading] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setForm((s) => ({ ...s, [name]: value }))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nombre || !form.email || !form.mensaje || !form.acepta) {
      toast.error('Completa los campos requeridos y acepta la política de privacidad')
      return
    }
    setLoading(true)
    try {
      const payload = {
        nombre: form.nombre,
        email: form.email,
        empresa: form.empresa || undefined,
        asunto: form.asunto,
        mensaje: form.mensaje,
      }

      const api = process.env.NEXT_PUBLIC_API_URL
      const url = api ? `${api}/api/v1/contacto` : '/api/contacto'

      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => {})

      toast.success('Mensaje enviado. Te contactaremos pronto.')
      setForm({ nombre: '', email: '', empresa: '', asunto: 'soporte', mensaje: '', acepta: false })
    } catch (err) {
      console.error(err)
      toast.error('No se pudo enviar el mensaje, intenta más tarde')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <section className="py-24 bg-gradient-to-b from-[var(--background)] to-[var(--card)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="text-balance text-4xl font-semibold md:text-5xl">Contacto</h1>
            <p className="mx-auto mt-4 max-w-2xl text-pretty text-lg opacity-80">
              ¿Tienes dudas o necesitas soporte? Envíanos un mensaje y te responderemos en breve.
            </p>
          </div>
          <div className="relative mx-auto mt-16 max-w-5xl">
            <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] mix-blend-overlay [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)] dark:opacity-5" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Envíanos un mensaje</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={submit} className="space-y-4">
                    <div>
                      <Label htmlFor="nombre">Nombre</Label>
                      <Input id="nombre" name="nombre" value={form.nombre} onChange={handleChange} placeholder="Tu nombre" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="email">Correo</Label>
                        <Input id="email" name="email" type="email" value={form.email} onChange={handleChange} placeholder="tucorreo@empresa.com" />
                      </div>
                      <div>
                        <Label htmlFor="empresa">Empresa</Label>
                        <Input id="empresa" name="empresa" value={form.empresa} onChange={handleChange} placeholder="Opcional" />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="asunto">Asunto</Label>
                      <select
                        id="asunto"
                        name="asunto"
                        value={form.asunto}
                        onChange={(e) => setForm((s) => ({ ...s, asunto: e.target.value }))}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:text-sm"
                      >
                        <option value="soporte">Soporte</option>
                        <option value="ventas">Ventas</option>
                        <option value="integraciones">Integraciones</option>
                        <option value="otros">Otros</option>
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="mensaje">Mensaje</Label>
                      <textarea
                        id="mensaje"
                        name="mensaje"
                        value={form.mensaje}
                        onChange={handleChange}
                        rows={6}
                        placeholder="Cuéntanos cómo podemos ayudarte"
                        className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:text-sm"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <Checkbox id="acepta" checked={form.acepta} onCheckedChange={(v) => setForm((s) => ({ ...s, acepta: !!v }))} />
                      <Label htmlFor="acepta" className="text-sm text-muted-foreground">
                        Acepto la política de privacidad y el tratamiento de datos
                      </Label>
                    </div>
                    <div className="flex justify-end">
                      <Button type="submit" disabled={loading || !form.acepta}>
                        {loading ? 'Enviando...' : 'Enviar'}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Información</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm">
                    <div>
                      <div className="text-muted-foreground">Correo</div>
                      <div className="font-medium">contacto@aaces.com</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Teléfono</div>
                      <div className="font-medium">+52 55 1234 5678</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Horario</div>
                      <div className="font-medium">Lunes a Viernes · 9:00–18:00</div>
                    </div>
                    <div className="pt-2 text-muted-foreground">
                      También puedes escribirnos para integraciones, soporte avanzado o demos personalizadas.
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
