import { ReactNode } from "react"

interface InfoCampo {
  label: string
  value: ReactNode
  span?: 1 | 2
}

interface InfoSeccion {
  titulo: string
  campos: InfoCampo[]
}

interface InfoGridProps {
  secciones: InfoSeccion[]
}

export function InfoGrid({ secciones }: InfoGridProps) {
  return (
    <div className="space-y-8">
      {secciones.map((seccion) => (
        <section key={seccion.titulo}>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
            {seccion.titulo}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
            {seccion.campos.map((campo) => (
              <div
                key={campo.label}
                className={campo.span === 2 ? "sm:col-span-2" : undefined}
              >
                <p className="text-xs text-muted-foreground mb-0.5">
                  {campo.label}
                </p>
                <div className="text-sm font-medium">{campo.value}</div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
