"use client"
import { useState, useCallback } from "react"
import { QrCode, SendHorizonal, Shield, ShieldCheck, CheckCircle, Loader2, ScanLine, KeyRound, BadgeCheck } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal"
import FooterSection from "src/components/footer"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

export const dynamic = "force-dynamic"

interface ValidationResult {
  valido: boolean
  mensaje: string
  datos_certificado?: {
    nombre_participante: string
    nombre_curso: string
    codigo_curso: string
    fecha_inicio: string
    fecha_fin: string
    duracion_horas: number
    calificacion?: number
    fecha_emision?: string
    fecha_expiracion?: string
    id_certificado?: string
    constancias?: string[]
    capacitador?: string
    estado?: string
  }
  intentos_restantes?: number
}

export default function VerificarPage() {
  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ValidationResult | null>(null)
  const [attempts, setAttempts] = useState(5)

  const verify = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) { toast.error("Ingresa un código de validación"); return }
    setLoading(true)
    // Timeout de 20s: sin esto, si el backend no responde el fetch se queda
    // colgado para siempre y el botón queda deshabilitado sin explicación.
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 20000)
    try {
      const raw = code.trim().toUpperCase()
      const c = raw.startsWith("CERT-") ? raw.slice(5) : raw
      const res = await fetch("/api/v1/validaciones/validar-certificado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo_validacion: c, ip_address: "127.0.0.1", user_agent: navigator.userAgent }),
        signal: controller.signal,
      })
      const data = await res.json()
      const norm = data?.certificado ? { ...data, datos_certificado: data.datos_certificado ?? data.certificado } : data
      setResult(norm)
      if (norm.intentos_restantes !== undefined) setAttempts(norm.intentos_restantes)
      if (norm.valido) toast.success("Certificado verificado exitosamente")
      else toast.error(norm.mensaje)
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        toast.error("La verificación tardó demasiado. Intenta de nuevo.")
      } else {
        toast.error("Error al verificar el certificado")
      }
    } finally {
      clearTimeout(timer)
      setLoading(false)
    }
  }, [code])

  const reduce = useReducedMotion()
  const d = result?.datos_certificado
  const fecha = (v?: string) => {
    if (!v) return null
    const x = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(v + "T00:00:00") : new Date(v)
    return isNaN(x.getTime()) ? null : x
  }
  const exp = fecha(d?.fecha_expiracion)
  const vencido = d?.estado === "Vencido" || (exp ? exp < new Date() : false)
  const fmt = (v?: string) => fecha(v)?.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })

  return (
    <div className="min-h-screen bg-background">
      <section className="relative overflow-hidden bg-gradient-to-b from-background to-muted/20 pb-16 pt-32 md:pt-40">
        <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-16 h-[320px] w-[620px] -translate-x-1/2 rounded-full bg-orange-500/10 blur-3xl" />
        <div className="relative mx-auto max-w-2xl px-6 text-center">
          <motion.div
            initial={reduce ? false : { opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-xl shadow-orange-500/30"
          >
            <ShieldCheck className="h-8 w-8" />
          </motion.div>
          <Reveal y={16}>
            <h1 className="text-balance text-3xl font-semibold sm:text-4xl">Verificar certificado</h1>
            <p className="mt-3 text-muted-foreground">
              Ingresa el código único de tu constancia o escanea el código QR.
            </p>
          </Reveal>

          <Reveal y={16} delay={0.1}>
            <form onSubmit={verify} className="mx-auto mt-8 max-w-lg">
              <label htmlFor="codigo" className="sr-only">Código de validación</label>
              <div className="relative grid grid-cols-[1fr_auto] items-center rounded-full border bg-background pr-2 shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-shadow duration-200 focus-within:border-orange-500/50 focus-within:shadow-[0_8px_30px_rgba(249,115,22,0.15)]">
                <QrCode className="pointer-events-none absolute inset-y-0 left-5 my-auto h-5 w-5 text-orange-500" />
                <input
                  id="codigo"
                  placeholder="AACES-26-XXXXXX"
                  className="h-14 w-full bg-transparent pl-14 font-mono text-sm tracking-wider focus:outline-none"
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  maxLength={20}
                  disabled={loading || attempts <= 0}
                />
                <Button type="submit" className="h-10 rounded-full bg-orange-500 px-5 text-white shadow-md shadow-orange-500/25 transition-all hover:bg-orange-600 active:scale-95" disabled={loading || attempts <= 0}>
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" strokeWidth={2} />
                  ) : (
                    <>
                      <span className="hidden sm:block">Verificar</span>
                      <SendHorizonal className="h-5 w-5 sm:hidden" strokeWidth={2} />
                      <span className="sr-only sm:hidden">Verificar</span>
                    </>
                  )}
                </Button>
              </div>
            </form>

            {attempts <= 3 && attempts > 0 && (
              <p className="mt-3 text-sm text-muted-foreground">Intentos restantes: {attempts}</p>
            )}
            {attempts <= 0 && (
              <p className="mt-3 text-sm text-destructive">Has excedido el número de intentos.</p>
            )}
          </Reveal>

          {/* Resultado */}
          <AnimatePresence mode="wait">
            {result && (
              <motion.div
                key={(d?.id_certificado || "") + String(result.valido) + result.mensaje}
                initial={reduce ? false : { opacity: 0, y: 24, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduce ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                role="status"
                className={`mt-10 overflow-hidden rounded-2xl border text-left shadow-lg ${
                  result.valido ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20" : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20"
                }`}
              >
                <div className="flex items-center gap-4 p-6">
                  <motion.span
                    initial={reduce ? false : { scale: 0, rotate: -30 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.15 }}
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${result.valido ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}
                  >
                    {result.valido ? <CheckCircle className="h-6 w-6" /> : <Shield className="h-6 w-6" />}
                  </motion.span>
                  <div>
                    <p className={`text-lg font-semibold ${result.valido ? "text-green-800 dark:text-green-300" : "text-red-800 dark:text-red-300"}`}>
                      {result.mensaje}
                    </p>
                    {result.valido && <p className="text-sm text-green-700/80 dark:text-green-400/80">Este documento fue emitido a través de AACES.</p>}
                  </div>
                </div>
                {d && (
                  <dl className="grid gap-4 border-t border-black/5 bg-background/60 p-6 sm:grid-cols-2 dark:border-white/10">
                    <div>
                      <dt className="text-xs text-muted-foreground">Participante</dt>
                      <dd className="font-medium">{d.nombre_participante}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Curso</dt>
                      <dd className="font-medium">{d.nombre_curso}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Emitido por</dt>
                      <dd className="font-medium">{d.capacitador || "-"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Emisión</dt>
                      <dd className="font-medium">{fmt(d.fecha_emision) || "-"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Vigencia</dt>
                      <dd className="font-medium">{fmt(d.fecha_expiracion) || "No expira"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Estado</dt>
                      <dd>
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-sm font-semibold ${vencido ? "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400" : "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400"}`}>
                          {d.estado || (vencido ? "Vencido" : "Vigente")}
                        </span>
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-xs text-muted-foreground">ID</dt>
                      <dd className="font-mono text-sm">{d.id_certificado || "-"}</dd>
                    </div>
                  </dl>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* Cómo verificar */}
      <section className="py-12 md:py-20">
        <div className="mx-auto max-w-5xl px-6">
          <Reveal className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center rounded-full bg-orange-500 px-3 py-1 text-xs font-semibold text-white">Cómo funciona</span>
            <h2 className="mt-4 text-3xl font-semibold">Verifica en segundos</h2>
            <p className="mt-4 text-muted-foreground">Cualquier persona o empresa puede comprobar si una constancia es auténtica, sin registrarse.</p>
          </Reveal>
          <Stagger className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              { icon: ScanLine, t: "Escanea el QR", d: "Con la cámara de tu celular, apunta al código QR impreso en la constancia." },
              { icon: KeyRound, t: "O escribe el código", d: "Ingresa el código único que aparece junto al QR, por ejemplo AACES-26-XXXXXX." },
              { icon: BadgeCheck, t: "Consulta el resultado", d: "Verás si es auténtica, a quién se emitió, el curso y si sigue vigente." },
            ].map((x, i) => (
              <StaggerItem key={x.t}>
                <div className="group h-full rounded-2xl border border-border/50 bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-orange-500/30 hover:shadow-lg hover:shadow-orange-500/5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500 text-white transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
                      <x.icon className="h-5 w-5" />
                    </span>
                    <span className="text-xs font-semibold text-orange-500 dark:text-orange-400">Paso {i + 1}</span>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">{x.t}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{x.d}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      <FooterSection />
    </div>
  )
}
