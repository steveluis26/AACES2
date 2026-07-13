"use client"
import { MapPin, Search, Building2, Star } from "lucide-react"
import Link from "next/link"

export default function MarketplacePage() {
  return (
    <div className="min-h-screen bg-background pt-24">
      <section className="py-16 md:py-24 text-center">
        <div className="mx-auto max-w-3xl px-6">
          <span className="inline-block rounded-full border border-orange-200 bg-orange-50 px-4 py-1 text-xs font-semibold text-orange-600 dark:border-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
            Próximamente disponible
          </span>
          <h1 className="mt-6 text-3xl sm:text-4xl md:text-5xl font-semibold">
            Haz que las empresas encuentren tu agencia
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Estamos construyendo el directorio nacional de agencias capacitadoras para conectar empresas con proveedores confiables de capacitación.
          </p>

          <div className="mt-12 grid gap-6 sm:grid-cols-3 text-left">
            <div className="rounded-2xl border border-border/50 bg-card p-6">
              <Search className="h-8 w-8 text-orange-500 mb-3" />
              <h3 className="font-semibold">Busca por especialidad</h3>
              <p className="mt-1 text-sm text-muted-foreground">Encuentra agencias por tipo de capacitación: alturas, seguridad, industrial, etc.</p>
            </div>
            <div className="rounded-2xl border border-border/50 bg-card p-6">
              <MapPin className="h-8 w-8 text-orange-500 mb-3" />
              <h3 className="font-semibold">Ubicación</h3>
              <p className="mt-1 text-sm text-muted-foreground">Agencias cerca de tu ciudad o región para capacitación presencial.</p>
            </div>
            <div className="rounded-2xl border border-border/50 bg-card p-6">
              <Star className="h-8 w-8 text-orange-500 mb-3" />
              <h3 className="font-semibold">Calificaciones</h3>
              <p className="mt-1 text-sm text-muted-foreground">Compara agencias por reputación y opiniones de otras empresas.</p>
            </div>
          </div>

          <div className="mt-12 rounded-2xl border border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20 p-8">
            <Building2 className="h-10 w-10 text-orange-500 mx-auto" />
            <h2 className="mt-4 text-2xl font-semibold">Sé de las primeras agencias</h2>
            <p className="mt-2 text-muted-foreground max-w-lg mx-auto">
              Únete al directorio desde el inicio. Cuando una empresa busque capacitación en tu ciudad, aparecerás entre los primeros resultados.
            </p>
            <div className="mt-6">
              <Link
                href="mailto:hola@aaces.com?subject=Quiero%20aparecer%20en%20el%20directorio%20de%20AACES"
                className="inline-flex items-center rounded-full bg-orange-500 px-6 py-3 text-sm font-semibold text-white hover:bg-orange-600 transition-colors"
              >
                Quiero aparecer en el directorio
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}