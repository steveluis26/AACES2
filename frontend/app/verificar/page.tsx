"use client"
import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { QrCode, SendHorizonal, ShieldCheck, Loader2, ScanLine, KeyRound, BadgeCheck } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal"
import FooterSection from "src/components/footer"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

export const dynamic = "force-dynamic"


export default function VerificarPage() {
  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  // Un solo lugar para el resultado: la página pública /v/{código} (la misma que abre el QR)
  const verify = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    const c = code.trim().toUpperCase()
    if (!c) { toast.error("Ingresa un código de validación"); return }
    setLoading(true)
    router.push(`/v/${encodeURIComponent(c)}`)
  }, [code, router])

  const reduce = useReducedMotion()

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
                  disabled={loading}
                />
                <Button type="submit" className="h-10 rounded-full bg-orange-500 px-5 text-white shadow-md shadow-orange-500/25 transition-all hover:bg-orange-600 active:scale-95" disabled={loading}>
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

          </Reveal>

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
