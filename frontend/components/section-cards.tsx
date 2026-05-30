import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function SectionCards({
  data,
  labels,
}: {
  data?: {
    pagos_recibidos?: number
    participantes_total?: number
    cursos_activos?: number
    cursos_total?: number
  }
  labels?: {
    ingresos?: string
    clientes?: string
    cuentas?: string
    crecimiento?: string
  }
}) {
  const fmtMXN = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
  const revenue = typeof data?.pagos_recibidos === "number" ? fmtMXN.format(Number(data!.pagos_recibidos!)) : fmtMXN.format(0)
  const customers = typeof data?.participantes_total === "number" ? `${data!.participantes_total}` : "0"
  const activeAccounts = typeof data?.cursos_activos === "number" ? `${data!.cursos_activos}` : "0"
  const growth = (() => {
    if (typeof data?.cursos_activos === "number" && typeof data?.cursos_total === "number" && data!.cursos_total! > 0) {
      const pct = (data!.cursos_activos! / data!.cursos_total!) * 100
      return `${pct.toFixed(1)}%`
    }
    return "0%"
  })()
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 px-4 lg:px-6 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card *:data-[slot=card]:shadow-xs">
      <Card className="@container/card">
        <CardHeader className="relative">
          <CardDescription>{labels?.ingresos ?? 'Ingresos totales'}</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
            {revenue}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">{revenue}</div>
          <div className="text-muted-foreground">Total acumulado</div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader className="relative">
          <CardDescription>{labels?.clientes ?? 'Nuevos clientes'}</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
            {customers}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">{customers}</div>
          <div className="text-muted-foreground">Periodo actual</div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader className="relative">
          <CardDescription>{labels?.cuentas ?? 'Cuentas activas'}</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
            {activeAccounts}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">{activeAccounts}</div>
          <div className="text-muted-foreground">Estado actual</div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader className="relative">
          <CardDescription>{labels?.crecimiento ?? 'Tasa de crecimiento'}</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
            {growth}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">{growth}</div>
          <div className="text-muted-foreground">Activos vs total</div>
        </CardFooter>
      </Card>
    </div>
  )
}
