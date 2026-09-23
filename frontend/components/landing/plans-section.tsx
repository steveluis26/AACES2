"use client"
import Link from "next/link"
import { Check } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"

const tiers = [
  {
    name: "Prueba",
    price: "$0",
    desc: "Para conocer la plataforma",
    popular: false,
    features: [
      "50 constancias",
      "1 capacitador",
      "Validación QR"
    ],
    cta: "Comenzar",
    href: "/register?plan=trial"
  },
  {
    name: "Profesional",
    price: "$399",
    desc: "Para capacitadores activos",
    popular: true,
    features: [
      "500 constancias",
      "Capacitadores ilimitados",
      "Validación QR",
      "Diplomas personalizados",
      "Soporte prioritario"
    ],
    cta: "Elegir plan",
    href: "/register?plan=profesional"
  },
  {
    name: "Empresa",
    price: "$799",
    desc: "Para organizaciones grandes",
    popular: false,
    features: [
      "Constancias ilimitadas",
      "Capacitadores ilimitados",
      "API de validación",
      "White label",
      "Soporte dedicado"
    ],
    cta: "Contactar",
    href: "/contacto"
  }
]

export default function PlansSection() {
  const reduce = useReducedMotion()
  return (
    <section id="planes" className="scroll-mt-24 py-12 md:py-20 bg-muted/30">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center">
          <h2 className="text-3xl font-semibold">Planes</h2>
          <p className="mt-4 text-muted-foreground">Precios que tienen sentido. Sin límites absurdos de constancias. Paga por lo que usas.</p>
        </div>
        <div className="mt-12 grid items-center gap-6 md:grid-cols-3">
          {tiers.map((tier, i) => (
            <motion.div
              key={i}
              initial={reduce ? false : { opacity: 0, y: 24, scale: tier.popular ? 0.96 : 1 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, delay: tier.popular ? 0.2 : i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className={`relative flex flex-col rounded-2xl p-6 transition-shadow duration-300 ${
                tier.popular
                  ? "z-10 border-2 border-orange-500 bg-card shadow-xl shadow-orange-500/15 hover:shadow-2xl hover:shadow-orange-500/20 md:py-9"
                  : "border border-border/50 bg-card hover:shadow-md"
              }`}
            >
              {tier.popular && (
                <>
                  <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 rounded-2xl bg-gradient-to-b from-orange-50 to-transparent dark:from-orange-500/10" />
                  <span className="absolute -top-3.5 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-orange-500 px-4 py-1 text-xs font-semibold text-white shadow-md shadow-orange-500/30">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-white opacity-75 motion-safe:animate-ping" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                    </span>
                    Más popular
                  </span>
                </>
              )}
              <div className="mb-6">
                <h3 className="text-lg font-semibold">{tier.name}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className={`font-bold ${tier.popular ? "text-5xl text-orange-600 dark:text-orange-500" : "text-4xl"}`}>{tier.price}</span>
                  <span className="text-sm text-muted-foreground">/mes</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{tier.desc}</p>
              </div>
              <ul className="mb-8 flex-1 space-y-3">
                {tier.features.map((f, j) => (
                  <li key={j} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-orange-500 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={tier.href}
                className={`inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-medium transition-colors ${
                  tier.popular
                    ? "bg-orange-500 py-3 text-white shadow-md shadow-orange-500/25 hover:bg-orange-600 active:scale-[0.98]"
                    : "border border-border bg-background hover:bg-muted"
                }`}
              >
                {tier.cta}
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}