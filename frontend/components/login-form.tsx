"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { AlertCircle, ArrowRight, BadgeCheck, Check, Eye, EyeOff, Loader2, Lock, Mail, QrCode } from "lucide-react"

// Convierte el `detail` de un error de la API en un mensaje legible.
// FastAPI devuelve `detail` como string en 401, pero como lista de
// errores de validación en 422; sin esto React mostraba "[object Object]".
function resolveErrorDetail(err: unknown, status: number): string {
  const fallback = status === 401 ? "Credenciales inválidas" : `Error ${status}`
  const detail = (err as { detail?: unknown } | null)?.detail
  if (typeof detail === "string" && detail.trim()) return detail
  if (Array.isArray(detail) && detail.length > 0) {
    const msg = (detail[0] as { msg?: unknown } | null)?.msg
    if (typeof msg === "string" && msg.trim()) return msg
  }
  return fallback
}

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()
  const [formData, setFormData] = useState({ email: "", password: "" })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [verPassword, setVerPassword] = useState(false)
  const [exito, setExito] = useState(false)
  // Cambia en cada intento fallido para repetir la animación de "sacudida"
  const [intento, setIntento] = useState(0)
  // Evita que el formulario se envíe de forma nativa (GET con la contraseña en la URL) antes de hidratar
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
    setError("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      if (!formData.email || !formData.password) {
        setError("Ingresa correo y contraseña")
        setLoading(false)
        return
      }
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correo: formData.email, password: formData.password }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Error de autenticación" }))
        throw new Error(resolveErrorDetail(err, res.status))
      }
      const data = await res.json()
      const token = data.access_token as string
      localStorage.setItem("aaces_token", token)
      document.cookie = `aaces_token=${token}; path=/; max-age=604800; SameSite=Lax`
      let role: "admin" | "client" = "client"
      let isSuperAdmin = false
      try {
        const parts = token.split(".")
        if (parts.length === 3) {
          const payload = JSON.parse(typeof atob === "function" ? atob(parts[1]) : Buffer.from(parts[1], "base64").toString("utf-8"))
          role = payload.role === "admin" ? "admin" : "client"
          isSuperAdmin = role === "admin" && !payload.org_id
          localStorage.setItem("aaces_user", JSON.stringify({ id: payload.sub, email: payload.email, nombre: payload.name, rol: role, isSuperAdmin }))
        }
      } catch {}
      const mustChange = Boolean(data.must_change_password)
      // Muestra la palomita un instante antes de redirigir
      setExito(true)
      await new Promise((r) => setTimeout(r, 450))
      if (mustChange && role === "client") {
        router.push("/cliente/cambiar-password")
        return
      }
      // ?next=/cliente/... (p. ej. al registrarse con un plan de pago → Suscripción)
      const next = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("next") : null
      const destino = !isSuperAdmin && next && next.startsWith("/cliente/") ? next : null
      router.push(isSuperAdmin ? "/admin/dashboard" : destino || "/cliente/dashboard")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de conexión")
      setIntento((n) => n + 1)
    } finally {
      setLoading(false)
    }
  }

  const reduce = useReducedMotion()
  const aparecer = (i: number) =>
    reduce ? {} : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5, delay: 0.15 + i * 0.07, ease: [0.22, 1, 0.36, 1] as const } }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="grid overflow-hidden rounded-3xl border border-border/60 bg-card shadow-2xl shadow-black/5 md:grid-cols-2"
      >
        {/* Formulario */}
        <form method="post" noValidate className="flex flex-col justify-center p-6 sm:p-10" onSubmit={handleSubmit}>
          <motion.div {...aparecer(0)} className="mb-8">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border bg-background shadow-sm">
              <Image src="/logo.png" alt="AACES" width={28} height={28} className="h-6 w-auto" />
            </span>
            <h1 className="mt-5 text-2xl font-bold sm:text-3xl">Bienvenido de nuevo</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">Inicia sesión para administrar tus cursos y constancias.</p>
          </motion.div>

          <div className="flex flex-col gap-5">
            <motion.div {...aparecer(1)} className="grid gap-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <div className="group relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-orange-500" />
                <Input id="email" name="email" type="email" inputMode="email" autoComplete="email" placeholder="correo@ejemplo.com" required value={formData.email} onChange={handleChange} aria-invalid={!!error || undefined} className="h-11 pl-10 transition-shadow focus-visible:ring-2 focus-visible:ring-orange-500/30" />
              </div>
            </motion.div>

            <motion.div {...aparecer(2)} className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Contraseña</Label>
                <a href="/olvide-password" className="text-xs font-medium text-orange-500 hover:underline">¿La olvidaste?</a>
              </div>
              <div className="group relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-orange-500" />
                <Input id="password" name="password" type={verPassword ? "text" : "password"} autoComplete="current-password" required value={formData.password} onChange={handleChange} aria-invalid={!!error || undefined} className="h-11 pl-10 pr-11 transition-shadow focus-visible:ring-2 focus-visible:ring-orange-500/30" />
                <button
                  type="button"
                  onClick={() => setVerPassword((v) => !v)}
                  aria-label={verPassword ? "Ocultar" : "Mostrar"}
                  aria-pressed={verPassword}
                  className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span key={verPassword ? "off" : "on"} initial={reduce ? false : { opacity: 0, rotate: -30, scale: 0.8 }} animate={{ opacity: 1, rotate: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.15 }}>
                      {verPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </motion.span>
                  </AnimatePresence>
                </button>
              </div>
            </motion.div>

            <AnimatePresence>
              {error && (
                <motion.div
                  key={error + intento}
                  role="alert"
                  initial={reduce ? false : { opacity: 0, height: 0 }}
                  animate={reduce ? { opacity: 1 } : { opacity: 1, height: "auto", x: [0, -8, 8, -5, 5, 0] }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.4 }}
                  className="overflow-hidden"
                >
                  <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div {...aparecer(3)}>
              <Button
                type="submit"
                disabled={loading || !mounted || exito}
                className={cn(
                  "group h-11 w-full text-[15px] shadow-lg transition-all duration-300 active:scale-[0.98]",
                  exito ? "bg-green-600 shadow-green-600/25 hover:bg-green-600 disabled:opacity-100" : "shadow-orange-500/25",
                )}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {exito ? (
                    <motion.span key="ok" className="inline-flex items-center gap-2" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }}>
                      <Check className="h-5 w-5" strokeWidth={3} /> ¡Listo!
                    </motion.span>
                  ) : loading ? (
                    <motion.span key="load" className="inline-flex items-center gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <Loader2 className="h-4 w-4 animate-spin" /> Iniciando…
                    </motion.span>
                  ) : (
                    <motion.span key="idle" className="inline-flex items-center gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      Entrar <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                    </motion.span>
                  )}
                </AnimatePresence>
              </Button>
            </motion.div>

            <motion.div {...aparecer(4)} className="space-y-4">
              <div className="relative text-center text-xs after:absolute after:inset-0 after:top-1/2 after:z-0 after:border-t after:border-border">
                <span className="relative z-10 bg-card px-3 text-muted-foreground">o continúa con</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {["Google", "Apple"].map((p) => (
                  <button key={p} type="button" disabled title="Próximamente" className="flex h-10 items-center justify-center gap-2 rounded-lg border text-sm text-muted-foreground opacity-70">
                    {p}
                    <span className="rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">Pronto</span>
                  </button>
                ))}
              </div>
              <p className="text-center text-sm text-muted-foreground">
                ¿No tienes cuenta?{" "}
                <a href="/contacto" className="font-semibold text-orange-500 hover:underline">Solicita acceso</a>
              </p>
            </motion.div>
          </div>
        </form>

        {/* Panel de marca */}
        <div className="relative hidden overflow-hidden bg-orange-500 p-10 text-white md:flex md:flex-col md:justify-between">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.18)_1px,transparent_0)] [background-size:22px_22px]" />
          <motion.div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/15 blur-2xl"
            animate={reduce ? undefined : { scale: [1, 1.12, 1] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }} />
          <motion.div aria-hidden="true" className="pointer-events-none absolute -bottom-28 -left-16 h-72 w-72 rounded-full bg-white/10 blur-2xl"
            animate={reduce ? undefined : { scale: [1.1, 1, 1.1] }} transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }} />

          {/* Constancia de ejemplo flotando */}
          <div className="relative flex flex-1 items-center justify-center py-6">
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 30, rotate: -6 }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, y: [0, -8, 0], rotate: -3 }}
              transition={reduce ? undefined : { opacity: { duration: 0.6, delay: 0.3 }, rotate: { duration: 0.8, delay: 0.3 }, y: { duration: 5, delay: 1, repeat: Infinity, ease: "easeInOut" } }}
              className="w-64 rounded-2xl bg-white p-4 text-left text-foreground shadow-2xl shadow-black/20"
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-900">
                  <Image src="/logo.png" alt="" width={16} height={16} className="h-4 w-auto" /> AACES
                </span>
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">Verificado</span>
              </div>
              <div className="mt-4 space-y-2">
                <div className="h-2 w-3/4 rounded-full bg-gray-200" />
                <div className="h-2 w-1/2 rounded-full bg-gray-200" />
                <div className="h-2 w-2/3 rounded-full bg-gray-100" />
              </div>
              <div className="mt-4 flex items-end justify-between">
                <div className="space-y-1.5">
                  <div className="h-1.5 w-16 rounded-full bg-gray-100" />
                  <div className="h-1.5 w-12 rounded-full bg-gray-100" />
                </div>
                <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-gray-200 text-gray-900"><QrCode className="h-8 w-8" /></span>
              </div>
            </motion.div>

            <motion.span
              className="absolute left-2 top-8 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-orange-600 shadow-lg"
              initial={reduce ? false : { opacity: 0, scale: 0.6 }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: [0, -6, 0] }}
              transition={reduce ? undefined : { opacity: { delay: 0.8 }, scale: { delay: 0.8, type: "spring", stiffness: 260, damping: 16 }, y: { delay: 1.4, duration: 4, repeat: Infinity, ease: "easeInOut" } }}
            >
              <QrCode className="h-3.5 w-3.5" /> QR único
            </motion.span>
            <motion.span
              className="absolute bottom-8 right-2 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-orange-600 shadow-lg"
              initial={reduce ? false : { opacity: 0, scale: 0.6 }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: [0, 6, 0] }}
              transition={reduce ? undefined : { opacity: { delay: 1 }, scale: { delay: 1, type: "spring", stiffness: 260, damping: 16 }, y: { delay: 1.6, duration: 4.5, repeat: Infinity, ease: "easeInOut" } }}
            >
              <BadgeCheck className="h-3.5 w-3.5" /> DC-3 STPS
            </motion.span>
          </div>

          <div className="relative">
            <motion.h2 {...aparecer(2)} className="text-2xl font-semibold leading-snug">
              Tus constancias, verificables en segundos.
            </motion.h2>
            <ul className="mt-5 space-y-3 text-sm text-white/90">
              {["Constancias DC-3 con formato oficial", "Validación pública con código QR", "Alertas antes de que venzan"].map((t, i) => (
                <motion.li key={t} {...aparecer(3 + i)} className="flex items-center gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20"><Check className="h-3 w-3" strokeWidth={3} /></span>
                  {t}
                </motion.li>
              ))}
            </ul>
          </div>
        </div>
      </motion.div>
      <motion.p
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="text-balance text-center text-xs text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-orange-500"
      >
        Al continuar, aceptas nuestros <a href="#">Términos de Servicio</a>{" "}
        y <a href="#">Política de Privacidad</a>.
      </motion.p>
    </div>
  )
}
