"use client"
import { LayoutDashboard, FileText, ShieldCheck, Bell } from "lucide-react"

const benefits = [
  { icon: LayoutDashboard, title: "Centraliza tu operación", desc: "Administra cursos, participantes, instructores y constancias desde un solo lugar." },
  { icon: FileText, title: "Emite constancias en segundos", desc: "Genera constancias DC-3 con formato oficial STPS automáticamente." },
  { icon: ShieldCheck, title: "Genera confianza con certificados verificables", desc: "Cada certificado incluye un código QR único para validación inmediata." },
  { icon: Bell, title: "Nunca pierdas una vigencia importante", desc: "Alertas automáticas cuando una constancia está por vencer." }
]

export default function MainBenefitSection() {
  return (
    <section className="py-12 md:py-20">
      <div className="mx-auto max-w-6xl px-6 text-center">
        <h2 className="text-3xl font-semibold">Menos tiempo administrando.<br />Más tiempo capacitando.</h2>
        <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">Organiza cursos, emite constancias, verifica certificados y controla vigencias. Todo desde una sola plataforma.</p>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map((b, i) => (
            <div key={i} className="rounded-2xl border border-border/50 bg-card p-6 text-left">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
                <b.icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold">{b.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{b.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}