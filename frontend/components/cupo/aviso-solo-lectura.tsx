"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useQuery } from "react-query"
import { motion, useReducedMotion } from "motion/react"
import { ArrowRight, Lock } from "lucide-react"
import { apiRequest } from "@/app/services/api"
import type { Cupo } from "@/lib/cupo"

/** Franja visible en todo el panel cuando la suscripción no está activa. */
export function AvisoSoloLectura() {
  const reduce = useReducedMotion()
  const pathname = usePathname()
  const { data } = useQuery(["cupo"], () => apiRequest<Cupo>("/cupo"), { retry: 1, staleTime: 60_000, refetchOnWindowFocus: true })
  if (!data || data.activa) return null
  const enPagos = pathname?.startsWith("/cliente/pagos")

  return (
    <motion.div
      role="status"
      initial={reduce ? false : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-4 mt-4 flex flex-col gap-3 rounded-2xl border border-amber-500/40 bg-amber-50 p-4 text-amber-900 sm:flex-row sm:items-center lg:mx-6 dark:bg-amber-500/10 dark:text-amber-200"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white"><Lock className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold">Tu cuenta está en modo solo lectura</p>
        <p className="mt-0.5 text-amber-800 dark:text-amber-300/90">
          Tu suscripción no está activa. Puedes consultar todo y reimprimir tus DC-3 (siguen siendo válidos), pero no crear ni editar cursos, participantes o constancias.
        </p>
      </div>
      {!enPagos && (
        <Link href="/cliente/pagos" className="group inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600">
          Renovar mi plan <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </motion.div>
  )
}
