"use client"
import { LayoutDashboard, FileText, ShieldCheck } from "lucide-react"

const benefits = [
  {
    icon: LayoutDashboard,
    title: "Centraliza tu operación",
    desc: "Administra cursos, participantes, instructores y constancias desde un solo lugar."
  },
  {
    icon: FileText,
    title: "Emite constancias verificables",
    desc: "Genera constancias DC-3 con formato oficial STPS y QR único de validación."
  },
  {
    icon: ShieldCheck,
    title: "Genera confianza en tus clientes",
    desc: "Cada certificado puede verificarse al instante. Tus clientes comprueban la autenticidad sin llamar."
  }
]

export default function WhySection() {
  return (
    <section className="py-12 md:py-20">
      <div className="mx-auto max-w-6xl px-6 text-center">
        <h2 className="text-3xl font-semibold">¿Por qué AACES?</h2>
        <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
          Deja de usar hojas de cálculo y sistemas dispersos. AACES centraliza todo lo que necesitas para operar tu agencia capacitadora.
        </p>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {benefits.map((b, i) => (
            <div key={i} className="rounded-2xl border border-border/50 bg-card p-6 text-left">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-orange-600 text-black dark:bg-orange-500 dark:text-black">
                <b.icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold">{b.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{b.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}