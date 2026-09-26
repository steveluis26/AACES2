"use client"

import Image from "next/image"
import Link from "next/link"
import { motion, useReducedMotion } from "motion/react"
import { AlertCircle, ArrowLeft } from "lucide-react"

/** Marco de las páginas de acceso secundarias (olvidé / restablecer contraseña),
 *  con el mismo fondo y tarjeta que el login. */
export function TarjetaAcceso({ titulo, subtitulo, children }: { titulo: string; subtitulo?: React.ReactNode; children: React.ReactNode }) {
  const reduce = useReducedMotion()
  return (
    <div className="relative min-h-screen overflow-hidden bg-background pb-12 pt-24 text-foreground">
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-20 h-[420px] w-[760px] -translate-x-1/2 rounded-full bg-orange-500/10 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.06)_1px,transparent_0)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_35%,black,transparent)] dark:bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.06)_1px,transparent_0)]" />
      <div className="relative mx-auto max-w-md px-4">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-3xl border border-border/60 bg-card p-6 shadow-2xl shadow-black/5 sm:p-10"
        >
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border bg-background shadow-sm">
            <Image src="/logo.png" alt="AACES" width={28} height={28} className="h-6 w-auto" />
          </span>
          <h1 className="mt-5 text-2xl font-bold sm:text-3xl">{titulo}</h1>
          {subtitulo && <p className="mt-1.5 text-sm text-muted-foreground">{subtitulo}</p>}
          <div className="mt-8">{children}</div>
        </motion.div>
        <Link href="/login" className="mt-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-orange-500">
          <ArrowLeft className="h-4 w-4" /> Volver a iniciar sesión
        </Link>
      </div>
    </div>
  )
}

export function AvisoError({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  )
}
