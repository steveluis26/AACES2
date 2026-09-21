"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts"

type ConstanciaMes = { mes: string; emitidas: number }
type Categoria = { categoria: string; cantidad: number; porcentaje: number }

const COLORS = ["#2563eb", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4"]

export function ChartsPanel({
  constancias_mes,
  cursos_categoria,
}: {
  constancias_mes: ConstanciaMes[]
  cursos_categoria: Categoria[]
}) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Constancias emitidas por mes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {constancias_mes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Sin datos</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={constancias_mes}>
                  <XAxis
                    dataKey="mes"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => {
                      const [y, m] = v.split("-")
                      const meses = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]
                      return `${meses[parseInt(m) - 1]}`
                    }}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: number) => [value, "Emitidas"]}
                    labelFormatter={(label) => {
                      const [y, m] = label.split("-")
                      const meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]
                      return `${meses[parseInt(m) - 1]} ${y}`
                    }}
                  />
                  <Bar dataKey="emitidas" fill="var(--color-primary, #2563eb)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Cursos por categoría
          </CardTitle>
        </CardHeader>
        <CardContent>
          {cursos_categoria.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Sin datos</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={cursos_categoria}
                    dataKey="cantidad"
                    nameKey="categoria"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                  >
                    {cursos_categoria.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
