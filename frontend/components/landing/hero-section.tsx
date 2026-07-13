"use client"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

export default function HeroSection() {
  return (
    <section className="py-16 md:py-24 bg-gradient-to-b from-background to-muted/20">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-6xl pt-10 lg:pt-16">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="text-balance text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-medium">
              La plataforma de <span className="text-orange-500">confianza</span> para la capacitación laboral en México.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground">
              Centraliza la operación de tu agencia capacitadora, emite constancias verificables y demuestra la autenticidad de cada certificación con AACES.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Ideal para:</span>
              <span className="rounded-full border border-border px-3 py-1">Capacitadores independientes</span>
              <span className="rounded-full border border-border px-3 py-1">Agencias capacitadoras</span>
              <span className="rounded-full border border-border px-3 py-1">Empresas</span>
            </div>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/login"
                className="inline-flex items-center rounded-full bg-orange-500 px-6 py-3 text-sm font-semibold text-white hover:bg-orange-600 transition-colors"
              >
                Ingresar <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link
                href="/verificar"
                className="inline-flex items-center rounded-full border border-border bg-background px-6 py-3 text-sm font-medium hover:bg-muted transition-colors"
              >
                Verificar certificado
              </Link>
            </div>
          </div>
          <div className="relative mx-auto mt-12 max-w-lg">
            <div className="relative rounded-2xl border border-border/50 overflow-hidden shadow-xl bg-white">
              <Image
                src="/hero-preview.png"
                alt="Panel de control AACES"
                width={800}
                height={640}
                className="w-full h-auto"
                priority
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}