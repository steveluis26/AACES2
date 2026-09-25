"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { motion, useReducedMotion } from "motion/react"
import { ArrowRight, Plus, QrCode, UserPlus } from "lucide-react"

type Onboarding = { tiene_cursos: boolean; tiene_participantes: boolean; tiene_constancias: boolean; progreso: number }

export function DashboardHeader({
  nombre,
  organizacion,
  resumen,
  onboarding,
}: {
  nombre: string
  organizacion: string
  resumen?: string
  onboarding?: Onboarding
}) {
  const reduce = useReducedMotion()
  // Saludo y fecha se calculan en el navegador (evita diferencias con el servidor)
  const [saludo, setSaludo] = useState("Hola")
  const [fecha, setFecha] = useState("")
  useEffect(() => {
    const d = new Date()
    const h = d.getHours()
    setSaludo(h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches")
    const f = d.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    setFecha(f.charAt(0).toUpperCase() + f.slice(1))
  }, [])

  const pasos = onboarding ? [
    { ok: onboarding.tiene_cursos, t: "Registra un curso", href: "/cliente/gestion" },
    { ok: onboarding.tiene_participantes, t: "Inscribe participantes", href: "/cliente/cursos" },
    { ok: onboarding.tiene_constancias, t: "Emite una constancia", href: "/cliente/constancias" },
  ] : []
  const completos = pasos.filter((p) => p.ok).length
  const mostrarGuia = pasos.length > 0 && completos < pasos.length

  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-2xl border bg-card p-6 shadow-sm sm:p-8"
    >
      <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-orange-500/10 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.05)_1px,transparent_0)] [background-size:20px_20px] [mask-image:linear-gradient(to_left,black,transparent_60%)] dark:bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.05)_1px,transparent_0)]" />

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{fecha}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            {saludo}, <span className="text-orange-500">{nombre.split(" ")[0]}</span>
          </h1>
          {organizacion && <p className="mt-0.5 text-sm text-muted-foreground">{organizacion}</p>}
          {resumen && <p className="mt-3 max-w-xl text-sm text-foreground/80">{resumen}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/cliente/gestion" className="group inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-orange-500/25 transition-all duration-200 hover:bg-orange-600 active:scale-[0.98]">
            <Plus className="h-4 w-4" /> Nuevo curso
          </Link>
          <Link href="/cliente/participantes" className="inline-flex items-center gap-2 rounded-lg border bg-background px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-muted active:scale-[0.98]">
            <UserPlus className="h-4 w-4" /> Participante
          </Link>
          <Link href="/verificar" className="inline-flex items-center gap-2 rounded-lg border bg-background px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-muted active:scale-[0.98]">
            <QrCode className="h-4 w-4" /> Verificar
          </Link>
        </div>
      </div>

      {mostrarGuia && (
        <div className="relative mt-6 rounded-xl border border-orange-500/20 bg-orange-500/5 p-4">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-semibold">Configura tu cuenta</span>
            <span className="text-xs text-muted-foreground">{completos} de {pasos.length}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-orange-500/15">
            <motion.div
              className="h-full rounded-full bg-orange-500"
              initial={reduce ? false : { width: 0 }}
              animate={{ width: `${(completos / pasos.length) * 100}%` }}
              transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {pasos.map((p) => (
              <Link key={p.t} href={p.href} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${p.ok ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400" : "bg-background text-foreground ring-1 ring-border hover:ring-orange-500/50"}`}>
                {p.ok ? "✓" : <ArrowRight className="h-3 w-3 text-orange-500" />} {p.t}
              </Link>
            ))}
          </div>
        </div>
      )}
    </motion.section>
  )
}
