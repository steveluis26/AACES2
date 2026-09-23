"use client"
import Image from "next/image"
import { Shield, BadgeCheck, UserCheck, QrCode, BarChart3, Users, Bell, LayoutDashboard, FileText, Scan } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { PageHero } from "@/components/landing/page-hero"
import { SectionHeading } from "@/components/landing/section-heading"
import { FeatureCard } from "@/components/landing/feature-card"
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal"
import CtaSection from "@/components/landing/cta-section"
import FooterSection from "src/components/footer"

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

const EASE = [0.22, 1, 0.36, 1] as const

export default function ProductoPage() {
  const reduce = useReducedMotion()
  return (
    <div className="min-h-screen bg-background">
      <PageHero
        eyebrow="Producto"
        title="Todo lo que tu agencia necesita"
        description="AACES centraliza la operación de tu agencia capacitadora: cursos, participantes, constancias DC-3 y certificados verificables."
      />

      {/* Funcionalidades */}
      <section className="py-12 md:py-16">
        <Stagger className="mx-auto grid max-w-6xl gap-6 px-6 sm:grid-cols-2 lg:grid-cols-3" stagger={0.07}>
          {features.map((f) => (
            <StaggerItem key={f.title}>
              <FeatureCard icon={f.icon} title={f.title}>{f.desc}</FeatureCard>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* Cómo funciona la verificación */}
      <section className="bg-muted/30 py-12 md:py-20">
        <div className="mx-auto max-w-5xl px-6">
          <SectionHeading
            eyebrow="Verificación"
            title="Cómo funciona la verificación"
            description="Cada certificado conserva la trazabilidad completa desde su emisión hasta su validación."
          />
          <div className="relative mt-14">
            <motion.div
              aria-hidden="true"
              className="absolute left-[10%] right-[10%] top-7 hidden h-0.5 origin-left bg-gradient-to-r from-orange-500 via-orange-400 to-orange-500 md:block"
              initial={reduce ? false : { scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 1.2, ease: EASE, delay: 0.1 }}
            />
            <ol className="grid gap-8 md:grid-cols-5 md:gap-4">
              {steps.map((s, i) => (
                <motion.li
                  key={i}
                  className="relative flex items-center gap-4 md:flex-col md:items-center md:gap-0 md:text-center"
                  initial={reduce ? false : { opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.5 }}
                  transition={{ duration: 0.5, ease: EASE, delay: 0.2 + i * 0.18 }}
                >
                  <span className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-orange-600 text-black shadow-lg shadow-orange-500/20 ring-8 ring-orange-100 dark:bg-orange-500 dark:ring-orange-500/10">
                    <s.icon className="h-6 w-6" />
                  </span>
                  <div className="md:mt-4">
                    <span className="text-xs font-semibold text-orange-600 dark:text-orange-400">Paso {i + 1}</span>
                    <p className="text-sm font-medium md:mx-auto md:max-w-[9rem]">{s.label}</p>
                  </div>
                </motion.li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Ejemplo de certificado */}
      <section className="py-12 md:py-20">
        <div className="mx-auto max-w-5xl px-6">
          <SectionHeading
            eyebrow="Así se ve"
            title="Un certificado que cualquiera puede verificar"
            description="Datos del participante, del curso y su vigencia, con un QR que lleva a la validación pública."
          />
          <Reveal y={40} scale={0.97} className="mx-auto mt-12 max-w-2xl">
            <div className="overflow-hidden rounded-2xl border border-border/50 bg-white shadow-2xl shadow-black/10">
              <Image src="/hero-preview.png" alt="Ejemplo de certificado AACES" width={800} height={640} className="h-auto w-full" />
            </div>
          </Reveal>
        </div>
      </section>

      <CtaSection />
      <FooterSection />
    </div>
  )
}
