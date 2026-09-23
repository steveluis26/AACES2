"use client"
import { ScrollText, QrCode, Users, Clock, BarChart3, Compass } from "lucide-react"
import { Stagger, StaggerItem } from "@/components/motion/reveal"
import { FeatureCard } from "@/components/landing/feature-card"
import { SectionHeading } from "@/components/landing/section-heading"

const features = [
  {
    icon: ScrollText,
    title: "Constancias DC-3 oficiales",
    description: "Genera constancias con formato oficial STPS en segundos, con QR y folio único."
  },
  {
    icon: QrCode,
    title: "QR de verificación",
    description: "Cada constancia incluye código QR para que empresas verifiquen su autenticidad."
  },
  {
    icon: Users,
    title: "Gestión de participantes",
    description: "Administra grupos, inscripciones, pagos y expedientes de cada trabajador."
  },
  {
    icon: Clock,
    title: "Vigencia automática",
    description: "Seguimiento de vencimientos por curso. Alertas cuando una constancia está por expirar."
  },
  {
    icon: BarChart3,
    title: "Dashboard y reportes",
    description: "Métricas de tus cursos, ingresos y participantes en tiempo real."
  },
  {
    icon: Compass,
    title: "Trazabilidad completa",
    description: "Cada certificado conserva el historial desde su emisión hasta su validación."
  }
]

export default function FeaturesSection() {
  return (
    <section id="funcionalidades" className="scroll-mt-24 py-12 md:py-20">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="Funcionalidades"
          title="Todo lo que necesitas para capacitar"
          description="Herramientas diseñadas para capacitadores que buscan profesionalizar su servicio."
        />
        <Stagger className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" stagger={0.07}>
          {features.map((f, i) => (
            <StaggerItem key={i}>
              <FeatureCard icon={f.icon} title={f.title}>{f.description}</FeatureCard>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  )
}