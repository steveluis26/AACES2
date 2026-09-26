"use client"

import { useState } from "react"
import { Loader2, Mail, MailCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AvisoError, TarjetaAcceso } from "@/components/auth/tarjeta-acceso"

export default function OlvidePasswordPage() {
  const [correo, setCorreo] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState("")

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!correo.includes("@")) { setError("Escribe el correo con el que entras a AACES"); return }
    setEnviando(true)
    try {
      const r = await fetch("/api/v1/auth/olvide-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correo: correo.trim() }),
      })
      if (!r.ok) throw new Error()
      setEnviado(true)
    } catch {
      setError("No pudimos enviar la solicitud. Revisa tu conexión e inténtalo de nuevo.")
    } finally {
      setEnviando(false)
    }
  }

  if (enviado) {
    return (
      <TarjetaAcceso titulo="Revisa tu correo">
        <div className="flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm dark:border-orange-500/30 dark:bg-orange-500/10">
          <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-orange-500" />
          <p>
            Si <strong>{correo.trim()}</strong> tiene una cuenta en AACES, te enviamos un enlace para crear una nueva contraseña.
            Vence en 1 hora y solo sirve una vez.
          </p>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          ¿No llega? Revisa la carpeta de spam o{" "}
          <button type="button" onClick={() => setEnviado(false)} className="font-medium text-orange-500 hover:underline">intenta con otro correo</button>.
        </p>
      </TarjetaAcceso>
    )
  }

  return (
    <TarjetaAcceso titulo="¿Olvidaste tu contraseña?" subtitulo="Escribe tu correo y te mandamos un enlace para crear una nueva.">
      <form noValidate onSubmit={enviar} className="flex flex-col gap-5">
        <div className="grid gap-2">
          <Label htmlFor="correo">Correo electrónico</Label>
          <div className="group relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-orange-500" />
            <Input id="correo" type="email" inputMode="email" autoComplete="email" autoFocus placeholder="correo@ejemplo.com" value={correo}
              onChange={(e) => { setCorreo(e.target.value); setError("") }} aria-invalid={!!error || undefined}
              className="h-11 pl-10 transition-shadow focus-visible:ring-2 focus-visible:ring-orange-500/30" />
          </div>
        </div>
        {error && <AvisoError>{error}</AvisoError>}
        <Button type="submit" disabled={enviando} className="h-11 w-full text-[15px] shadow-lg shadow-orange-500/25">
          {enviando ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando…</> : "Enviar enlace"}
        </Button>
      </form>
    </TarjetaAcceso>
  )
}
