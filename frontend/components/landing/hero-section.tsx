"use client"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, QrCode, ShieldCheck } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"

const EASE = [0.22, 1, 0.36, 1] as const

export default function HeroSection() {
  const reduce = useReducedMotion()
  // Entrada escalonada al cargar la página
  const enter = (delay: number, y = 20) =>
    reduce
      ? {}
      : { initial: { opacity: 0, y }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.7, delay, ease: EASE } }

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-background to-muted/20 py-16 md:py-24">
      {/* Resplandor naranja de fondo */}
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-24 -z-0 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-orange-500/10 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.06)_1px,transparent_0)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_30%,black,transparent)] dark:bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.06)_1px,transparent_0)]" />

      <div className="relative mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-6xl pt-10 lg:pt-16">
          <div className="mx-auto max-w-4xl text-center">
            <motion.div {...enter(0)} className="mb-6 flex justify-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/5 px-3 py-1 text-xs font-medium text-orange-500 dark:text-orange-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-orange-500 opacity-60 motion-safe:animate-ping" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-500" />
                </span>
                Constancias DC-3 verificables con QR
              </span>
            </motion.div>

            <motion.h1 {...enter(0.08, 28)} className="text-balance text-3xl font-medium sm:text-4xl md:text-5xl lg:text-6xl">
              La plataforma de{" "}
              <span className="relative inline-block text-orange-500">
                confianza
                <motion.svg
                  aria-hidden="true"
                  viewBox="0 0 200 12"
                  preserveAspectRatio="none"
                  className="absolute -bottom-1 left-0 h-2.5 w-full text-orange-500/40"
                  initial={reduce ? false : { pathLength: 0 }}
                >
                  <motion.path
                    d="M2 9 C 50 2, 150 2, 198 8"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeLinecap="round"
                    initial={reduce ? false : { pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.9, delay: 0.6, ease: EASE }}
                  />
                </motion.svg>
              </span>{" "}
              para la capacitación laboral en México.
            </motion.h1>

            <motion.p {...enter(0.18)} className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground">
              Centraliza la operación de tu agencia capacitadora, emite constancias verificables y demuestra la autenticidad de cada certificación con AACES.
            </motion.p>

            <motion.div {...enter(0.28)} className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/register?plan=trial"
                className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-500/25 transition-all duration-200 hover:bg-orange-600 hover:shadow-orange-500/35 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 sm:w-auto"
              >
                Comenzar gratis
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/verificar"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-background px-6 py-3 text-sm font-semibold transition-colors duration-200 hover:bg-muted active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 sm:w-auto"
              >
                <QrCode className="h-4 w-4" />
                Verificar una constancia
              </Link>
            </motion.div>

            <motion.div {...enter(0.38)} className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Ideal para:</span>
              <span className="rounded-full border border-border px-3 py-1">Capacitadores independientes</span>
              <span className="rounded-full border border-border px-3 py-1">Agencias capacitadoras</span>
              <span className="rounded-full border border-border px-3 py-1">Empresas</span>
            </motion.div>
          </div>

          <motion.div
            className="relative mx-auto mt-14 max-w-lg"
            initial={reduce ? false : { opacity: 0, y: 48, rotateX: 12 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ duration: 1, delay: 0.45, ease: EASE }}
            style={{ transformPerspective: 1200 }}
          >
            <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-white shadow-2xl shadow-black/10">
              <Image
                src="/hero-preview.png"
                alt="Ejemplo de certificación verificada con AACES"
                width={800}
                height={640}
                className="h-auto w-full"
                priority
              />
            </div>

            {/* Insignia flotante de verificación */}
            <motion.div
              className="absolute right-full top-[22%] mr-6 hidden items-center gap-2.5 whitespace-nowrap rounded-xl border border-border/60 bg-background/95 px-3.5 py-2.5 shadow-xl backdrop-blur lg:flex"
              initial={reduce ? false : { opacity: 0, x: -16 }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, x: 0, y: [0, -6, 0] }}
              transition={reduce ? undefined : { opacity: { delay: 1.1, duration: 0.5 }, x: { delay: 1.1, duration: 0.5 }, y: { delay: 1.6, duration: 4, repeat: Infinity, ease: "easeInOut" } }}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-500/15 dark:text-green-400">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <span className="text-left leading-tight">
                <span className="block text-sm font-semibold">Certificado auténtico</span>
                <span className="block text-xs text-muted-foreground">Verificado al instante</span>
              </span>
            </motion.div>

            <motion.div
              className="absolute bottom-[18%] left-full ml-6 hidden items-center gap-2 whitespace-nowrap rounded-xl border border-border/60 bg-background/95 px-3.5 py-2.5 shadow-xl backdrop-blur lg:flex"
              initial={reduce ? false : { opacity: 0, x: 16 }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, x: 0, y: [0, 6, 0] }}
              transition={reduce ? undefined : { opacity: { delay: 1.3, duration: 0.5 }, x: { delay: 1.3, duration: 0.5 }, y: { delay: 1.8, duration: 4.5, repeat: Infinity, ease: "easeInOut" } }}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500/10 text-orange-500 dark:text-orange-400">
                <QrCode className="h-4 w-4" />
              </span>
              <span className="text-left leading-tight">
                <span className="block text-sm font-semibold">QR único</span>
                <span className="block text-xs text-muted-foreground">por constancia</span>
              </span>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
