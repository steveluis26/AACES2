"use client"
import { FilePlus2, UserPlus, QrCode } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { SectionHeading } from "@/components/landing/section-heading"

const pasos = [
  { icon: FilePlus2, title: "Registra tu curso", desc: "Define fechas, sede, precio y las constancias que emitirá." },
  { icon: UserPlus, title: "Inscribe participantes", desc: "Da de alta a los trabajadores y lleva su expediente y pagos." },
  { icon: QrCode, title: "Emite y verifica", desc: "Genera constancias DC-3 con QR único, verificables al instante." },
]

const EASE = [0.22, 1, 0.36, 1] as const

export default function HowSection() {
  const reduce = useReducedMotion()
  return (
    <section id="como-funciona" className="scroll-mt-24 bg-muted/30 py-12 md:py-20">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="Cómo funciona"
          title="De la inscripción a la constancia en 3 pasos"
          description="Todo el flujo de tu agencia en un mismo lugar, sin hojas de cálculo."
        />
        <div className="relative mt-14">
          {/* Línea que se dibuja al entrar en pantalla (escritorio) */}
          <motion.div
            aria-hidden="true"
            className="absolute left-[16.66%] right-[16.66%] top-7 hidden h-0.5 origin-left bg-gradient-to-r from-orange-500 via-orange-400 to-orange-500 md:block"
            initial={reduce ? false : { scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 1.1, ease: EASE, delay: 0.2 }}
          />
          <ol className="grid gap-10 md:grid-cols-3 md:gap-6">
            {pasos.map((p, i) => (
              <motion.li
                key={p.title}
                className="relative flex flex-col items-center text-center"
                initial={reduce ? false : { opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.6, ease: EASE, delay: 0.25 + i * 0.25 }}
              >
                <span className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-lg shadow-orange-500/25 ring-8 ring-background">
                  <p.icon className="h-6 w-6" />
                  <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background">
                    {i + 1}
                  </span>
                </span>
                <h3 className="mt-5 text-lg font-semibold">{p.title}</h3>
                <p className="mt-2 max-w-xs text-sm text-muted-foreground">{p.desc}</p>
              </motion.li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
