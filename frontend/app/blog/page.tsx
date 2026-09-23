"use client"
import Link from "next/link"
import { useState } from "react"
import { ArrowRight, BookOpen, Clock, FileCheck2, HardHat, Scale, ShieldCheck } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { PageHero } from "@/components/landing/page-hero"
import { Reveal } from "@/components/motion/reveal"
import FooterSection from "src/components/footer"

// Temas planeados. Se muestran como "Próximamente" hasta que exista el contenido real.
const posts = [
  { cat: "Constancias", icon: FileCheck2, title: "Guía completa de la constancia DC-3", desc: "Qué datos debe llevar, quién la emite y cómo evitar rechazos ante la STPS.", read: "8 min" },
  { cat: "Normatividad", icon: Scale, title: "NOM-035: lo que tu empresa debe cumplir", desc: "Factores de riesgo psicosocial explicados en lenguaje claro y con ejemplos.", read: "6 min" },
  { cat: "Seguridad", icon: HardHat, title: "Trabajos en alturas: capacitación según la NOM-009", desc: "Temario mínimo, vigencia recomendada y evidencias que conviene conservar.", read: "7 min" },
  { cat: "Verificación", icon: ShieldCheck, title: "Cómo detectar una constancia falsa", desc: "Señales de alerta y por qué la verificación con QR cambia las reglas del juego.", read: "5 min" },
  { cat: "Gestión", icon: Clock, title: "Controla vencimientos sin hojas de cálculo", desc: "Estrategias para renovar a tiempo y no perder clientes por olvido.", read: "4 min" },
  { cat: "Constancias", icon: BookOpen, title: "DC-3 vs. DC-4 vs. DC-5: diferencias clave", desc: "Cuándo se usa cada formato y cómo se relacionan entre sí.", read: "6 min" },
]
const categorias = ["Todos", ...Array.from(new Set(posts.map((p) => p.cat)))]

export default function BlogPage() {
  const [cat, setCat] = useState("Todos")
  const reduce = useReducedMotion()
  const visibles = cat === "Todos" ? posts : posts.filter((p) => p.cat === cat)

  return (
    <div className="min-h-screen bg-background">
      <PageHero
        eyebrow="Blog"
        title="Recursos para capacitadores"
        description="Guías prácticas sobre normatividad STPS, constancias y cómo operar una agencia capacitadora con confianza."
      />

      <section className="pb-12 md:pb-20">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal className="flex flex-wrap justify-center gap-2" y={12}>
            {categorias.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCat(c)}
                aria-pressed={cat === c}
                className={`rounded-full border px-4 py-1.5 text-sm transition-all duration-200 active:scale-95 ${
                  cat === c ? "border-orange-500 bg-orange-500 text-white shadow-md shadow-orange-500/25" : "border-border hover:border-orange-500/40 hover:text-orange-500"
                }`}
              >
                {c}
              </button>
            ))}
          </Reveal>

          <motion.div layout={!reduce} className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {visibles.map((p, i) => (
                <motion.article
                  key={p.title}
                  layout={!reduce}
                  initial={reduce ? false : { opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.4, delay: reduce ? 0 : i * 0.05 }}
                  className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/50 bg-card transition-shadow duration-300 hover:shadow-lg hover:shadow-orange-500/5"
                >
                  <div className="relative flex h-40 items-center justify-center overflow-hidden bg-gradient-to-br from-orange-500/15 via-orange-500/5 to-transparent">
                    <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(249,115,22,0.18)_1px,transparent_0)] [background-size:18px_18px]" />
                    <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-lg shadow-orange-500/30 transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110">
                      <p.icon className="h-7 w-7" />
                    </span>
                    <span className="absolute left-4 top-4 rounded-full bg-background/90 px-2.5 py-0.5 text-xs font-medium backdrop-blur">{p.cat}</span>
                    <span className="absolute right-4 top-4 rounded-full bg-orange-500 px-2.5 py-0.5 text-xs font-semibold text-white">Próximamente</span>
                  </div>
                  <div className="flex flex-1 flex-col p-6">
                    <h2 className="text-lg font-semibold leading-snug transition-colors group-hover:text-orange-600">{p.title}</h2>
                    <p className="mt-2 flex-1 text-sm text-muted-foreground">{p.desc}</p>
                    <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" /> Lectura de {p.read}
                    </p>
                  </div>
                </motion.article>
              ))}
            </AnimatePresence>
          </motion.div>

          <Reveal className="mt-14">
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-orange-500/20 bg-orange-500/5 p-8 text-center sm:flex-row sm:text-left">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white">
                <BookOpen className="h-6 w-6" />
              </span>
              <div className="flex-1">
                <h2 className="text-lg font-semibold">¿Quieres que te avisemos cuando publiquemos?</h2>
                <p className="mt-1 text-sm text-muted-foreground">Escríbenos y te enviaremos los artículos en cuanto estén listos.</p>
              </div>
              <Link
                href="/contacto"
                className="group inline-flex items-center gap-2 rounded-full bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-orange-500/25 transition-all duration-200 hover:bg-orange-600 active:scale-95"
              >
                Avísenme <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <FooterSection />
    </div>
  )
}
