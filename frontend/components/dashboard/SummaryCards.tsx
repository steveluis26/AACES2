"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BookOpen, Users, FileText, AlertTriangle } from "lucide-react"

type Kpis = {
  cursos_activos: number
  participantes: number
  constancias_mes: number
  por_vencer: number
}

export function SummaryCards({ kpis }: { kpis: Kpis }) {
  const cards = [
    { label: "Cursos activos", value: kpis.cursos_activos, icon: BookOpen, color: "text-blue-600" },
    { label: "Participantes", value: kpis.participantes, icon: Users, color: "text-green-600" },
    { label: "Constancias del mes", value: kpis.constancias_mes, icon: FileText, color: "text-purple-600" },
    { label: "Por vencer", value: kpis.por_vencer, icon: AlertTriangle, color: "text-amber-600" },
  ]

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.label}
            </CardTitle>
            <card.icon className={`h-4 w-4 ${card.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{card.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
