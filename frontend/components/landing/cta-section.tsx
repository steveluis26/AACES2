"use client"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Reveal } from "@/components/motion/reveal"

export default function CtaSection() {
  return (
    <section className="px-6 py-12 md:py-20">
      <Reveal scale={0.97} className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500 to-orange-600 px-6 py-14 text-center text-white shadow-2xl shadow-orange-500/20 sm:px-12 md:py-16">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-black/10 blur-2xl" />
        <div className="relative">
          <h2 className="mx-auto max-w-2xl text-balance text-3xl font-semibold sm:text-4xl">
            Profesionaliza tu agencia capacitadora hoy
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-white/85">
            Empieza gratis con 50 constancias. Sin tarjeta de crédito.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/register?plan=trial"
              className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-orange-600 shadow-lg transition-all duration-200 hover:bg-orange-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-orange-500 sm:w-auto"
            >
              Comenzar gratis
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/contacto"
              className="inline-flex w-full items-center justify-center rounded-full border border-white/40 px-6 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-white/10 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:w-auto"
            >
              Hablar con ventas
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  )
}
