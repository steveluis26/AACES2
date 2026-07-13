"use client"
import Image from "next/image"
import Link from "next/link"

export default function HeroSection() {
  return (
    <section className="py-16 md:py-24 bg-gradient-to-b from-background to-muted/20">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="text-balance text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-medium">
              Gestiona tus capacitaciones con certificación oficial
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground">
              La plataforma sencilla para capacitadores que genera constancias DC-3 con validez STPS, controla participantes y emite certificados digitales verificables por QR.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/login"
                className="inline-flex items-center rounded-full bg-orange-500 px-6 py-3 text-sm font-semibold text-white hover:bg-orange-600 transition-colors"
              >
                Ingresar
              </Link>
              <Link
                href="#planes"
                className="inline-flex items-center rounded-full border border-border bg-background px-6 py-3 text-sm font-semibold hover:bg-muted transition-colors"
              >
                Ver planes
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