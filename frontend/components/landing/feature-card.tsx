import type { LucideIcon } from "lucide-react"

/** Tarjeta con ícono naranja, elevación y resplandor al pasar el mouse. */
export function FeatureCard({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: React.ReactNode }) {
  return (
    <div className="group relative h-full overflow-hidden rounded-2xl border border-border/50 bg-card p-6 text-left transition-all duration-300 hover:-translate-y-1 hover:border-orange-500/30 hover:shadow-lg hover:shadow-orange-500/5">
      <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-orange-500/0 blur-2xl transition-colors duration-500 group-hover:bg-orange-500/10" />
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-orange-600 text-black transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110 dark:bg-orange-500 dark:text-black">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <div className="mt-2 text-sm text-muted-foreground">{children}</div>
    </div>
  )
}
