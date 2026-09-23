'use client'

import React, { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { CheckCircle, Clock, Loader2, Mail, Phone, Send } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { PageHero } from '@/components/landing/page-hero'
import { Reveal } from '@/components/motion/reveal'
import FooterSection from 'src/components/footer'

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
  const [enviado, setEnviado] = useState<string | null>(null)
  const reduce = useReducedMotion()

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

      // Antes el error se ignoraba y siempre decía "enviado" aunque fallara.
      const res = await fetch('/api/v1/contacto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      toast.success('Mensaje enviado. Te contactaremos pronto.')
      setEnviado(form.nombre.split(' ')[0] || 'listo')
      setForm({ nombre: '', email: '', empresa: '', asunto: 'soporte', mensaje: '', acepta: false })
    } catch (err) {
      console.error(err)
      toast.error('No se pudo enviar el mensaje, intenta más tarde')
    } finally {
      setLoading(false)
    }
  }

  const asuntos = [
    { v: 'soporte', l: 'Soporte' },
    { v: 'ventas', l: 'Ventas' },
    { v: 'integraciones', l: 'Integraciones' },
    { v: 'otros', l: 'Otros' },
  ]
  const info = [
    { icon: Mail, t: 'Correo', d: 'contacto@aaces.com', href: 'mailto:contacto@aaces.com' },
    { icon: Phone, t: 'Teléfono', d: '+52 55 1234 5678', href: 'tel:+525512345678' },
    { icon: Clock, t: 'Horario', d: 'Lunes a Viernes · 9:00–18:00' },
  ]

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PageHero
        eyebrow="Contacto"
        title="Hablemos"
        description="¿Tienes dudas o necesitas soporte? Envíanos un mensaje y te responderemos en breve."
      />

      <section className="pb-16 md:pb-24">
        <div className="mx-auto grid max-w-5xl gap-6 px-6 md:grid-cols-5">
          <Reveal x={-24} y={0} className="md:col-span-3">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Envíanos un mensaje</CardTitle>
              </CardHeader>
              <CardContent>
                <AnimatePresence mode="wait">
                  {enviado ? (
                    <motion.div
                      key="ok"
                      initial={reduce ? false : { opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={reduce ? undefined : { opacity: 0 }}
                      className="flex flex-col items-center py-10 text-center"
                      role="status"
                    >
                      <motion.span
                        initial={reduce ? false : { scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.1 }}
                        className="flex h-14 w-14 items-center justify-center rounded-full bg-green-600 text-white shadow-lg shadow-green-600/25"
                      >
                        <CheckCircle className="h-7 w-7" />
                      </motion.span>
                      <h3 className="mt-5 text-lg font-semibold">¡Gracias{enviado !== 'listo' ? `, ${enviado}` : ''}!</h3>
                      <p className="mt-1 max-w-sm text-sm text-muted-foreground">Recibimos tu mensaje. Te responderemos por correo en menos de 24 horas hábiles.</p>
                      <Button variant="outline" className="mt-6 rounded-full" onClick={() => setEnviado(null)}>Enviar otro mensaje</Button>
                    </motion.div>
                  ) : (
                    <motion.form
                      key="form"
                      onSubmit={submit}
                      className="space-y-5"
                      initial={reduce ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={reduce ? undefined : { opacity: 0 }}
                    >
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label htmlFor="nombre">Nombre <span className="text-orange-500">*</span></Label>
                          <Input id="nombre" name="nombre" autoComplete="name" value={form.nombre} onChange={handleChange} placeholder="Tu nombre" />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="email">Correo <span className="text-orange-500">*</span></Label>
                          <Input id="email" name="email" type="email" autoComplete="email" value={form.email} onChange={handleChange} placeholder="tucorreo@empresa.com" />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="empresa">Empresa <span className="text-xs font-normal text-muted-foreground">(opcional)</span></Label>
                          <Input id="empresa" name="empresa" autoComplete="organization" value={form.empresa} onChange={handleChange} placeholder="Nombre de tu empresa" />
                        </div>
                      </div>
                      <fieldset className="space-y-1.5">
                        <legend className="text-sm font-medium">Asunto</legend>
                        <div className="flex flex-wrap gap-2 pt-1">
                          {asuntos.map((a) => (
                            <label
                              key={a.v}
                              className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm transition-all duration-200 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-orange-500 ${
                                form.asunto === a.v ? 'border-orange-500 bg-orange-500 text-white shadow-md shadow-orange-500/20' : 'hover:border-orange-500/40 hover:text-orange-500'
                              }`}
                            >
                              <input type="radio" name="asunto" value={a.v} checked={form.asunto === a.v} onChange={() => setForm((s) => ({ ...s, asunto: a.v }))} className="sr-only" />
                              {a.l}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                      <div className="space-y-1.5">
                        <Label htmlFor="mensaje">Mensaje <span className="text-orange-500">*</span></Label>
                        <textarea
                          id="mensaje"
                          name="mensaje"
                          value={form.mensaje}
                          onChange={handleChange}
                          rows={5}
                          maxLength={2000}
                          placeholder="Cuéntanos cómo podemos ayudarte"
                          className="flex w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:border-orange-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/20 md:text-sm"
                        />
                        <p className="text-right text-xs text-muted-foreground">{form.mensaje.length}/2000</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <Checkbox id="acepta" className="mt-0.5" checked={form.acepta} onCheckedChange={(v) => setForm((s) => ({ ...s, acepta: !!v }))} />
                        <Label htmlFor="acepta" className="text-sm font-normal leading-snug text-muted-foreground">
                          Acepto la política de privacidad y el tratamiento de datos
                        </Label>
                      </div>
                      <Button type="submit" disabled={loading || !form.acepta} className="w-full rounded-full transition-transform active:scale-[0.98] sm:w-auto sm:px-8">
                        {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando…</> : <><Send className="h-4 w-4" /> Enviar mensaje</>}
                      </Button>
                    </motion.form>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </Reveal>

          <Reveal x={24} y={0} delay={0.1} className="md:col-span-2">
            <div className="flex h-full flex-col gap-4">
              {info.map((x) => {
                const inner = (
                  <>
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-600 text-black transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110 dark:bg-orange-500">
                      <x.icon className="h-5 w-5" />
                    </span>
                    <span>
                      <span className="block text-xs text-muted-foreground">{x.t}</span>
                      <span className="block font-medium">{x.d}</span>
                    </span>
                  </>
                )
                const cls = 'group flex items-center gap-4 rounded-2xl border border-border/50 bg-card p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-orange-500/30 hover:shadow-md'
                return x.href ? <a key={x.t} href={x.href} className={cls}>{inner}</a> : <div key={x.t} className={cls}>{inner}</div>
              })}
              <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-5 text-sm">
                <p className="font-medium">¿Buscas una demo?</p>
                <p className="mt-1 text-muted-foreground">También puedes escribirnos para integraciones, soporte avanzado o demos personalizadas.</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <FooterSection />
    </div>
  )
}
