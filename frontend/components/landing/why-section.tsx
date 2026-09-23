"use client"
import { LayoutDashboard, FileText, ShieldCheck } from "lucide-react"
import { Stagger, StaggerItem } from "@/components/motion/reveal"
import { FeatureCard } from "@/components/landing/feature-card"
import { SectionHeading } from "@/components/landing/section-heading"

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
        <SectionHeading
          eyebrow="Por qué elegirnos"
          title="¿Por qué AACES?"
          description="Deja de usar hojas de cálculo y sistemas dispersos. AACES centraliza todo lo que necesitas para operar tu agencia capacitadora."
        />
        <Stagger className="mt-12 grid gap-6 md:grid-cols-3">
          {benefits.map((b, i) => (
            <StaggerItem key={i}>
              <FeatureCard icon={b.icon} title={b.title}>{b.desc}</FeatureCard>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  )
}