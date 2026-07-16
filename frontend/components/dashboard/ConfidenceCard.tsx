"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ShieldCheck, Eye, TrendingUp, Building2 } from "lucide-react"

type Confianza = {
  emitidos: number
  consultados: number
  tasa: number
  ciudades: number
}

export function ConfidenceCard({ data }: { data: Confianza }) {
  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-card to-primary/5">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Confianza generada</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="text-3xl font-bold text-primary">{data.emitidos.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Constancias emitidas</p>
          </div>
          <div>
            <div className="text-3xl font-bold">{data.consultados.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Verificadas</p>
          </div>
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold">{data.tasa}%</span>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </div>
            <p className="text-xs text-muted-foreground">Tasa de consulta</p>
          </div>
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold">{data.ciudades}</span>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">Empresas verificadoras</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
