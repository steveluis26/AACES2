"use client"
import { useState } from "react"
import { MapPin, Search, Building2, Star, CheckCircle, Loader2 } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { PageHero } from "@/components/landing/page-hero"
import { FeatureCard } from "@/components/landing/feature-card"
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal"
import FooterSection from "src/components/footer"
import Link from "next/link"

export default function MarketplacePage() {
  const [nombre, setNombre] = useState("")
  const [email, setEmail] = useState("")
  const [empresa, setEmpresa] = useState("")
  const [ciudad, setCiudad] = useState("")
  const [mensaje, setMensaje] = useState("")
  const [error, setError] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [listo, setListo] = useState(false)

  const enviar = async () => {
    setError("")
    if (!nombre.trim()) { setError("Escribe tu nombre"); return }
    if (!email.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { setError("Escribe un correo válido"); return }
    if (!empresa.trim()) { setError("Escribe el nombre de tu empresa"); return }
    setEnviando(true)
    try {
      const res = await fetch("/api/v1/public/lista-espera", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          email: email.trim(),
          empresa: empresa.trim(),
          ciudad: ciudad.trim() || null,
          tipo: "empresa",
          mensaje: mensaje.trim() || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || "No se pudo registrar")
      }
      setListo(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo registrar")
    } finally {
      setEnviando(false)
    }
  }

  const inputCls = "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none transition-[border-color,box-shadow] duration-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15"
  const labelCls = "mb-1.5 block text-sm font-medium"
  const reduce = useReducedMotion()
  const features = [
    { icon: Search, t: "Busca por especialidad", d: "Encuentra agencias por tipo de capacitación: alturas, seguridad, industrial, etc." },
    { icon: MapPin, t: "Ubicación", d: "Agencias cerca de tu ciudad o región para capacitación presencial." },
    { icon: Star, t: "Calificaciones", d: "Compara agencias por reputación y opiniones de otras empresas." },
  ]

  return (
    <div className="min-h-screen bg-background">
      <PageHero
        eyebrow="Próximamente disponible"
        title="Encuentra capacitación confiable para tu empresa"
        description="El directorio nacional de agencias capacitadoras validadas. Busca por especialidad y ubicación, y contrata con la confianza de que sus constancias son verificables."
      />

      <section className="pb-16 md:pb-24">
        <div className="mx-auto max-w-4xl px-6">
          <Stagger className="grid gap-6 sm:grid-cols-3">
            {features.map((f) => (
              <StaggerItem key={f.t}>
                <FeatureCard icon={f.icon} title={f.t}>{f.d}</FeatureCard>
              </StaggerItem>
            ))}
          </Stagger>

          <Reveal y={32} className="mt-12">
            <div className="relative overflow-hidden rounded-3xl border border-orange-200 bg-orange-50 p-8 text-center dark:border-orange-800 dark:bg-orange-950/20 md:p-10">
              <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-orange-500/10 blur-3xl" />
              <motion.div
                className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-lg shadow-orange-500/30"
                animate={reduce ? undefined : { y: [0, -5, 0] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
              >
                <Building2 className="h-7 w-7" />
              </motion.div>
              <h2 className="relative mt-5 text-2xl font-semibold">Sé de las primeras empresas en usarlo</h2>
              <p className="relative mx-auto mt-2 max-w-lg text-muted-foreground">
                Déjanos tus datos y te avisaremos en cuanto puedas buscar capacitación para tu empresa en el directorio.
              </p>

              <AnimatePresence mode="wait">
                {listo ? (
                  <motion.div
                    key="ok"
                    role="status"
                    initial={reduce ? false : { opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative mx-auto mt-8 flex max-w-lg flex-col items-center rounded-2xl border border-green-200 bg-background p-6 dark:border-green-800"
                  >
                    <motion.span
                      initial={reduce ? false : { scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.1 }}
                      className="flex h-12 w-12 items-center justify-center rounded-full bg-green-600 text-white"
                    >
                      <CheckCircle className="h-6 w-6" />
                    </motion.span>
                    <p className="mt-3 font-semibold text-green-700 dark:text-green-400">¡Listo! Ya estás en la lista.</p>
                    <p className="mt-1 text-sm text-muted-foreground">Te avisaremos en cuanto el directorio esté disponible.</p>
                  </motion.div>
                ) : (
                  <motion.form
                    key="form"
                    noValidate
                    onSubmit={(e) => { e.preventDefault(); enviar() }}
                    exit={reduce ? undefined : { opacity: 0, y: -8 }}
                    className="relative mx-auto mt-8 max-w-lg space-y-4 text-left"
                  >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label htmlFor="mk_nombre" className={labelCls}>Tu nombre <span className="text-orange-500">*</span></label>
                        <input id="mk_nombre" autoComplete="name" className={inputCls} value={nombre} onChange={e => setNombre(e.target.value)} />
                      </div>
                      <div>
                        <label htmlFor="mk_email" className={labelCls}>Correo <span className="text-orange-500">*</span></label>
                        <input id="mk_email" type="email" autoComplete="email" className={inputCls} placeholder="nombre@empresa.com" value={email} onChange={e => setEmail(e.target.value)} />
                      </div>
                      <div>
                        <label htmlFor="mk_empresa" className={labelCls}>Empresa <span className="text-orange-500">*</span></label>
                        <input id="mk_empresa" autoComplete="organization" className={inputCls} value={empresa} onChange={e => setEmpresa(e.target.value)} />
                      </div>
                      <div>
                        <label htmlFor="mk_ciudad" className={labelCls}>Ciudad <span className="text-xs font-normal text-muted-foreground">(opcional)</span></label>
                        <input id="mk_ciudad" autoComplete="address-level2" className={inputCls} value={ciudad} onChange={e => setCiudad(e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="mk_msg" className={labelCls}>¿Qué capacitación buscas? <span className="text-xs font-normal text-muted-foreground">(opcional)</span></label>
                      <textarea id="mk_msg" className={inputCls} rows={2} placeholder="Ej. Trabajos en alturas para 20 personas" value={mensaje} onChange={e => setMensaje(e.target.value)} />
                    </div>
                    <AnimatePresence>
                      {error && (
                        <motion.p
                          role="alert"
                          initial={reduce ? false : { opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="text-sm text-red-600"
                        >
                          {error}
                        </motion.p>
                      )}
                    </AnimatePresence>
                    <div className="text-center">
                      <button
                        type="submit"
                        disabled={enviando}
                        className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-500/25 transition-all duration-200 hover:bg-orange-600 active:scale-95 disabled:opacity-60"
                      >
                        {enviando ? <><Loader2 className="h-4 w-4 animate-spin" /> Registrando…</> : "Avísame cuando esté listo"}
                      </button>
                    </div>
                    <p className="text-center text-xs text-muted-foreground">
                      ¿Tienes una agencia capacitadora? <Link href="/cliente/catalogo" className="underline hover:text-orange-500">Publica tus cursos desde tu panel</Link>
                    </p>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </Reveal>
        </div>
      </section>

      <FooterSection />
    </div>
  )
}
