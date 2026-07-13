"use client"
import Link from "next/link"
import { Check } from "lucide-react"

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
    href: "/login"
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
    href: "/login"
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
  return (
    <section id="planes" className="scroll-mt-24 py-12 md:py-20 bg-muted/30">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center">
          <h2 className="text-3xl font-semibold">Planes</h2>
          <p className="mt-4 text-muted-foreground">Precios que tienen sentido. Sin límites absurdos de constancias. Paga por lo que usas.</p>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {tiers.map((tier, i) => (
            <div
              key={i}
              className={`relative flex flex-col rounded-2xl border p-6 ${
                tier.popular
                  ? "border-orange-500 shadow-lg"
                  : "border-border/50 bg-card"
              }`}
            >
              {tier.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-orange-500 px-4 py-1 text-xs font-semibold text-white">
                  Más popular
                </span>
              )}
              <div className="mb-6">
                <h3 className="text-lg font-semibold">{tier.name}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-4xl font-bold">{tier.price}</span>
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
                    ? "bg-orange-500 text-white hover:bg-orange-600"
                    : "border border-border bg-background hover:bg-muted"
                }`}
              >
                {tier.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}