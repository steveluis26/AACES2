"use client"
import { MapPin } from "lucide-react"
import Link from "next/link"

export default function MarketplaceSection() {
  return (
    <section className="py-12 md:py-20">
      <div className="mx-auto max-w-6xl px-6 text-center">
        <span className="inline-block rounded-full border border-orange-200 bg-orange-50 px-4 py-1 text-xs font-semibold text-orange-600 dark:border-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
          Próximamente disponible
        </span>
        <h2 className="mt-6 text-3xl font-semibold">Haz que las empresas te encuentren</h2>
        <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
          Estamos construyendo un directorio para conectar empresas con agencias capacitadoras.
          Cuando esté disponible, podrás recibir solicitudes de capacitación de empresas cercanas a tu ubicación.
        </p>
        <div className="mt-8 flex justify-center">
          <div className="flex items-center gap-3 rounded-2xl border border-border/50 bg-card p-6 text-left">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
              <MapPin className="h-6 w-6" />
            </div>
            <div>
              <p className="font-semibold">Más visibilidad para tu agencia</p>
              <p className="text-sm text-muted-foreground">Aparece en los resultados de búsqueda cuando una empresa necesite capacitación.</p>
            </div>
          </div>
        </div>
        <div className="mt-8">
          <Link
            href="mailto:hola@aaces.com?subject=Quiero%20ser%20de%20las%20primeras%20agencias%20en%20el%20directorio"
            className="inline-flex items-center rounded-full bg-orange-500 px-6 py-3 text-sm font-semibold text-white hover:bg-orange-600 transition-colors"
          >
            Quiero ser de las primeras agencias
          </Link>
        </div>
      </div>
    </section>
  )
}