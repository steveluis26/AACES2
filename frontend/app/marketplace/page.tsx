"use client"
import { useState } from "react"
import { MapPin, Search, Building2, Star } from "lucide-react"
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

  const inputCls = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-orange-500"

  return (
    <div className="min-h-screen bg-background pt-24">
      <section className="py-16 md:py-24 text-center">
        <div className="mx-auto max-w-3xl px-6">
          <span className="inline-block rounded-full border border-orange-200 bg-orange-50 px-4 py-1 text-xs font-semibold text-orange-600 dark:border-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
            Próximamente disponible
          </span>
          <h1 className="mt-6 text-3xl sm:text-4xl md:text-5xl font-semibold">
            Encuentra capacitación confiable para tu empresa
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            El directorio nacional de agencias capacitadoras validadas. Busca por especialidad y ubicación, y contrata con la confianza de que sus constancias son verificables.
          </p>

          <div className="mt-12 grid gap-6 sm:grid-cols-3 text-left">
            <div className="rounded-2xl border border-border/50 bg-card p-6">
              <Search className="h-8 w-8 text-orange-500 mb-3" />
              <h3 className="font-semibold">Busca por especialidad</h3>
              <p className="mt-1 text-sm text-muted-foreground">Encuentra agencias por tipo de capacitación: alturas, seguridad, industrial, etc.</p>
            </div>
            <div className="rounded-2xl border border-border/50 bg-card p-6">
              <MapPin className="h-8 w-8 text-orange-500 mb-3" />
              <h3 className="font-semibold">Ubicación</h3>
              <p className="mt-1 text-sm text-muted-foreground">Agencias cerca de tu ciudad o región para capacitación presencial.</p>
            </div>
            <div className="rounded-2xl border border-border/50 bg-card p-6">
              <Star className="h-8 w-8 text-orange-500 mb-3" />
              <h3 className="font-semibold">Calificaciones</h3>
              <p className="mt-1 text-sm text-muted-foreground">Compara agencias por reputación y opiniones de otras empresas.</p>
            </div>
          </div>

          <div className="mt-12 rounded-2xl border border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20 p-8">
            <Building2 className="h-10 w-10 text-orange-500 mx-auto" />
            <h2 className="mt-4 text-2xl font-semibold">Sé de las primeras empresas en usarlo</h2>
            <p className="mt-2 text-muted-foreground max-w-lg mx-auto">
              Déjanos tus datos y te avisaremos en cuanto puedas buscar capacitación para tu empresa en el directorio.
            </p>

            {listo ? (
              <div className="mt-6 rounded-xl border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30 p-6">
                <p className="font-semibold text-green-700 dark:text-green-400">¡Listo! Ya estás en la lista.</p>
                <p className="mt-1 text-sm text-muted-foreground">Te avisaremos en cuanto el directorio esté disponible.</p>
              </div>
            ) : (
              <div className="mt-6 text-left max-w-lg mx-auto space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input className={inputCls} placeholder="Tu nombre *" value={nombre} onChange={e => setNombre(e.target.value)} />
                  <input className={inputCls} placeholder="Correo *" type="email" value={email} onChange={e => setEmail(e.target.value)} />
                  <input className={inputCls} placeholder="Nombre de tu empresa *" value={empresa} onChange={e => setEmpresa(e.target.value)} />
                  <input className={inputCls} placeholder="Ciudad" value={ciudad} onChange={e => setCiudad(e.target.value)} />
                </div>
                <textarea className={inputCls} rows={2} placeholder="¿Qué capacitación buscas? (opcional)" value={mensaje} onChange={e => setMensaje(e.target.value)} />
                {error && <p className="text-sm text-red-600">{error}</p>}
                <div className="text-center">
                  <button
                    onClick={enviar}
                    disabled={enviando}
                    className="inline-flex items-center rounded-full bg-orange-500 px-6 py-3 text-sm font-semibold text-white hover:bg-orange-600 transition-colors disabled:opacity-60"
                  >
                    {enviando ? "Registrando…" : "Avísame cuando esté listo"}
                  </button>
                </div>
                <p className="text-center text-xs text-muted-foreground">
                  ¿Tienes una agencia capacitadora? <Link href="/cliente/catalogo" className="underline hover:text-orange-500">Publica tus cursos desde tu panel</Link>
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
