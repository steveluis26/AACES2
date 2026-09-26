"use client"

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Check, Eye, EyeOff, Loader2, Lock } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AvisoError, TarjetaAcceso } from "@/components/auth/tarjeta-acceso"
import { cn } from "@/lib/utils"

const REGLAS = [
  { texto: "Al menos 8 caracteres", ok: (p: string) => p.length >= 8 },
  { texto: "Letras y al menos un número", ok: (p: string) => /[a-zA-Z]/.test(p) && /\d/.test(p) },
]

function Restablecer() {
  const router = useRouter()
  const token = useSearchParams().get("token") || ""
  const [estado, setEstado] = useState<"cargando" | "valido" | "invalido">("cargando")
  const [correo, setCorreo] = useState("")
  const [password, setPassword] = useState("")
  const [confirmar, setConfirmar] = useState("")
  const [ver, setVer] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!token) { setEstado("invalido"); return }
    fetch(`/api/v1/auth/restablecer-password?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error()
        const d = await r.json()
        setCorreo(d.correo || "")
        setEstado("valido")
      })
      .catch(() => setEstado("invalido"))
  }, [token])

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!REGLAS.every((r) => r.ok(password))) { setError("La contraseña no cumple los requisitos"); return }
    if (password !== confirmar) { setError("Las contraseñas no coinciden"); return }
    setGuardando(true)
    try {
      const r = await fetch("/api/v1/auth/restablecer-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(typeof d.detail === "string" ? d.detail : "No se pudo guardar la contraseña")
      try { localStorage.removeItem("aaces_token"); localStorage.removeItem("aaces_user") } catch {}
      toast.success("Contraseña actualizada", { description: "Ya puedes iniciar sesión." })
      router.push("/login")
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  if (estado === "cargando") {
    return (
      <TarjetaAcceso titulo="Restablecer contraseña">
        <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-orange-500" /></div>
      </TarjetaAcceso>
    )
  }

  if (estado === "invalido") {
    return (
      <TarjetaAcceso titulo="El enlace ya no es válido" subtitulo="Venció o ya se usó. Por seguridad, cada enlace dura 1 hora y sirve una sola vez.">
        <Button asChild className="h-11 w-full text-[15px] shadow-lg shadow-orange-500/25">
          <Link href="/olvide-password">Pedir un enlace nuevo</Link>
        </Button>
      </TarjetaAcceso>
    )
  }

  return (
    <TarjetaAcceso titulo="Crea tu nueva contraseña" subtitulo={correo ? <>Para la cuenta <strong className="text-foreground">{correo}</strong></> : undefined}>
      <form noValidate onSubmit={guardar} className="flex flex-col gap-5">
        <div className="grid gap-2">
          <Label htmlFor="password">Nueva contraseña</Label>
          <div className="group relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-orange-500" />
            <Input id="password" type={ver ? "text" : "password"} autoComplete="new-password" autoFocus value={password}
              onChange={(e) => { setPassword(e.target.value); setError("") }}
              className="h-11 pl-10 pr-11 transition-shadow focus-visible:ring-2 focus-visible:ring-orange-500/30" />
            <button type="button" onClick={() => setVer((v) => !v)} aria-label={ver ? "Ocultar" : "Mostrar"} aria-pressed={ver}
              className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              {ver ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <ul className="mt-1 grid gap-1">
            {REGLAS.map((r) => {
              const ok = r.ok(password)
              return (
                <li key={r.texto} className={cn("flex items-center gap-1.5 text-xs transition-colors", ok ? "text-green-600 dark:text-green-400" : "text-muted-foreground")}>
                  <Check className={cn("h-3.5 w-3.5", ok ? "opacity-100" : "opacity-30")} /> {r.texto}
                </li>
              )
            })}
          </ul>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="confirmar">Confirma la contraseña</Label>
          <div className="group relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-orange-500" />
            <Input id="confirmar" type={ver ? "text" : "password"} autoComplete="new-password" value={confirmar}
              onChange={(e) => { setConfirmar(e.target.value); setError("") }}
              className="h-11 pl-10 transition-shadow focus-visible:ring-2 focus-visible:ring-orange-500/30" />
          </div>
        </div>
        {error && <AvisoError>{error}</AvisoError>}
        <Button type="submit" disabled={guardando} className="h-11 w-full text-[15px] shadow-lg shadow-orange-500/25">
          {guardando ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando…</> : "Guardar contraseña"}
        </Button>
      </form>
    </TarjetaAcceso>
  )
}

export default function RestablecerPasswordPage() {
  return <Suspense><Restablecer /></Suspense>
}
