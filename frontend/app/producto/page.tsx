"use client"
import Image from "next/image"
import { Shield, BadgeCheck, UserCheck, ScrollText, QrCode, BarChart3, Users, Bell, LayoutDashboard, FileText, Scan } from "lucide-react"

const steps = [
  { icon: Shield, label: "La agencia emite la constancia" },
  { icon: BadgeCheck, label: "AACES genera un identificador único" },
  { icon: UserCheck, label: "El participante recibe su certificado" },
  { icon: Scan, label: "La empresa escanea el QR" },
  { icon: BadgeCheck, label: "La autenticidad se verifica al instante" },
]

const features = [
  { icon: LayoutDashboard, title: "Administración", desc: "Gestiona cursos, grupos, instructores y participantes desde un solo panel." },
  { icon: FileText, title: "Constancias DC-3", desc: "Genera constancias con formato oficial STPS en segundos." },
  { icon: QrCode, title: "Código QR único", desc: "Cada certificado incluye un QR para verificación inmediata." },
  { icon: Users, title: "Participantes", desc: "Controla inscripciones, pagos y expedientes de cada trabajador." },
  { icon: Bell, title: "Alertas de vigencia", desc: "Notificaciones automáticas cuando una constancia está por vencer." },
  { icon: BarChart3, title: "Dashboard", desc: "Métricas de cursos, ingresos y participantes en tiempo real." },
]

export default function ProductoPage() {
  return (
    <div className="min-h-screen bg-background pt-24">
      {/* Hero producto */}
      <section className="py-16 md:py-24 bg-gradient-to-b from-background to-muted/20 text-center">
        <div className="mx-auto max-w-4xl px-6">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold">Todo lo que tu agencia necesita</h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            AACES centraliza la operación de tu agencia capacitadora: cursos, participantes, constancias DC-3 y certificados verificables.
          </p>
        </div>
      </section>

      {/* Features grid */}
      <section className="py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <div key={i} className="rounded-2xl border border-border/50 bg-card p-6">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-orange-600 text-black dark:bg-orange-500 dark:text-black">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cómo funciona la verificación */}
      <section className="py-16 bg-muted/30">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-3xl font-semibold">Cómo funciona la verificación</h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            Cada certificado conserva la trazabilidad completa desde su emisión hasta su validación.
          </p>
          <div className="mt-12 flex flex-col items-center gap-6 md:flex-row md:justify-center md:gap-4">
            {steps.map((s, i) => (
              <div key={i} className="flex flex-col items-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-orange-600 text-black dark:bg-orange-500 dark:text-black">
                  <s.icon className="h-6 w-6" />
                </div>
                <p className="mt-2 text-xs font-medium max-w-28 text-center">{s.label}</p>
                {i < steps.length - 1 && (
                  <div className="hidden md:block w-8 h-0.5 bg-muted-foreground/30 mt-7" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Screenshot */}
      <section className="py-16">
        <div className="mx-auto max-w-3xl px-6">
          <div className="rounded-2xl border border-border/50 overflow-hidden shadow-xl bg-white">
            <Image src="/hero-preview.png" alt="Panel AACES" width={800} height={640} className="w-full h-auto" />
          </div>
        </div>
      </section>
    </div>
  )
}