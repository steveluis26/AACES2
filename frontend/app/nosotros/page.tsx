'use client'

import { Cpu, Lock, Sparkles, Zap } from 'lucide-react'
import { PageHero } from '@/components/landing/page-hero'
import { FeatureCard } from '@/components/landing/feature-card'
import { Reveal, Stagger, StaggerItem } from '@/components/motion/reveal'
import CtaSection from '@/components/landing/cta-section'
import FooterSection from 'src/components/footer'

const valores = [
  { icon: Zap, t: 'Ágil', d: 'Procesos rápidos para administración y validación de certificaciones.' },
  { icon: Cpu, t: 'Potente', d: 'Herramientas robustas para cursos, participantes y constancias.' },
  { icon: Lock, t: 'Seguridad', d: 'Verificación por código único y controles anti‑fraude.' },
  { icon: Sparkles, t: 'Optimizado', d: 'Experiencia moderna y adaptable para equipos y empresas.' },
]

export default function NosotrosPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PageHero
        eyebrow="Nosotros"
        title="Impulsamos la capacitación y la certificación confiable"
        description="AACES integra herramientas modernas, trazabilidad y verificación en un mismo sistema para elevar la seguridad y la profesionalización."
      />

      <section className="pb-12 md:pb-20">
        <div className="mx-auto max-w-5xl px-6">
          <Reveal y={40} scale={0.97}>
            <div className="group overflow-hidden rounded-3xl shadow-2xl shadow-black/10">
              <picture>
                <source srcSet="https://images.unsplash.com/photo-1616587226960-4a03badbe8bf?q=80&w=1280&auto=format&fit=crop" media="(min-width: 768px)" />
                <img
                  className="h-auto w-full grayscale transition-all duration-700 group-hover:scale-[1.02] group-hover:grayscale-0"
                  src="https://images.unsplash.com/photo-1616587226960-4a03badbe8bf?q=80&w=800&auto=format&fit=crop"
                  alt="Equipo trabajando con AACES"
                  loading="lazy"
                />
              </picture>
            </div>
          </Reveal>

          <Stagger className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {valores.map((v) => (
              <StaggerItem key={v.t}>
                <FeatureCard icon={v.icon} title={v.t}>{v.d}</FeatureCard>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      <CtaSection />
      <FooterSection />
    </div>
  )
}
