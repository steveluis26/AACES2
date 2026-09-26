"use client"
import { ScrollText, QrCode, Users, Clock, BarChart3, Compass, BadgeCheck, GraduationCap, Printer } from "lucide-react"
import { Stagger, StaggerItem } from "@/components/motion/reveal"
import { FeatureCard } from "@/components/landing/feature-card"
import { SectionHeading } from "@/components/landing/section-heading"

const features = [
  {
    icon: Printer,
    title: "DC-3 con tu propio formato",
    description: "Sube tu DC-3 con tus logos, coloca los campos una vez y genera los de todo un grupo en un solo PDF listo para imprimir."
  },
  {
    icon: BadgeCheck,
    title: "Registro STPS verificado",
    description: "Comprobamos tu registro en el buscador oficial de la STPS y cada constancia lo muestra como verificado."
  },
  {
    icon: GraduationCap,
    title: "Plantilla de instructores",
    description: "Registra a tus instructores y los cursos que imparten. El DC-3 lleva el nombre de quien realmente dio el curso."
  },
  {
    icon: QrCode,
    title: "QR de verificación",
    description: "La empresa escanea y ve al agente, el curso registrado, el instructor y la vigencia. Sin llamadas."
  },
  {
    icon: Users,
    title: "Grupos y acreditación",
    description: "Inscribe con o sin anticipo. Solo quienes acreditas reciben folio y QR: quien no se presentó no gasta constancias."
  },
  {
    icon: ScrollText,
    title: "Datos listos para el DC-3",
    description: "Nombre, CURP, ocupación, puesto y empresa de cada trabajador se llenan solos en cada constancia."
  },
  {
    icon: Clock,
    title: "Vigencia automática",
    description: "Seguimiento de vencimientos por curso. Alertas cuando una constancia está por expirar."
  },
  {
    icon: BarChart3,
    title: "Dashboard y uso de tu plan",
    description: "Tus cursos, participantes y cuántas constancias llevas en el mes, con la recomendación del plan que te conviene."
  },
  {
    icon: Compass,
    title: "Trazabilidad completa",
    description: "Cada constancia guarda quién la emitió, quién impartió el curso y cada vez que alguien la verificó."
  }
]

export default function FeaturesSection() {
  return (
    <section id="funcionalidades" className="scroll-mt-24 py-12 md:py-20">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="Funcionalidades"
          title="Todo lo que necesitas para capacitar"
          description="Herramientas diseñadas para agentes capacitadores que quieren emitir DC-3 que resistan cualquier revisión."
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