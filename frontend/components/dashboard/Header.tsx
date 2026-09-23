"use client"

import { Card } from "@/components/ui/card"

type HeaderProps = {
  nombre: string
  organizacion: string
}

export function DashboardHeader({ nombre, organizacion }: HeaderProps) {
  const ahora = new Date()
  const hora = ahora.getHours()
  const saludo = hora < 12 ? "Buenos días" : hora < 19 ? "Buenas tardes" : "Buenas noches"
  const fecha = ahora.toLocaleDateString("es-MX", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  })

  return (
    <Card className="p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {saludo}, {nombre}
        </h1>
        <p className="text-sm text-muted-foreground">{organizacion}</p>
        <p className="text-xs text-muted-foreground">{fecha.charAt(0).toUpperCase() + fecha.slice(1)}</p>
      </div>
    </Card>
  )
}
