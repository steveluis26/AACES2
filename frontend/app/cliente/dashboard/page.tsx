"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { useQuery } from "react-query"
import { parseFecha } from "@/lib/utils"
import { apiRequest } from "@/app/services/api"
import { DashboardHeader } from "@/components/dashboard/Header"
import { SummaryCards } from "@/components/dashboard/SummaryCards"
import { AlertsPanel } from "@/components/dashboard/AlertsPanel"
import { AgendaPanel } from "@/components/dashboard/AgendaPanel"
import { ActivityTimeline } from "@/components/dashboard/ActivityTimeline"
import { ConfidenceCard } from "@/components/dashboard/ConfidenceCard"
import { CupoCard } from "@/components/dashboard/CupoCard"
import type { Cupo } from "@/lib/cupo"
import { ConstanciasChart, ModalidadPanel } from "@/components/dashboard/ChartsPanel"
import { Skeleton } from "@/components/ui/skeleton"

type Kpis = {
  cursos_activos: number
  participantes: number
  constancias_mes: number
  por_vencer: number
  alertas_criticas: number
}

type Onboarding = {
  tiene_cursos: boolean
  tiene_participantes: boolean
  tiene_constancias: boolean
  progreso: number
}

function leerUsuario() {
  try {
    const userStr = localStorage.getItem("aaces_user")
    if (userStr) {
      const u = JSON.parse(userStr)
      return { nombre: u.nombre || u.email || "Usuario", organizacion: u.organizacion || "" }
    }
    const token = localStorage.getItem("aaces_token") || ""
    const payload = JSON.parse(atob(token.split(".")[1]))
    return { nombre: payload.name || payload.nombre || "Usuario", organizacion: payload.razon_social || "" }
  } catch {
    return { nombre: "Usuario", organizacion: "" }
  }
}

// Se lee en un efecto: leer localStorage durante el render causaba diferencias servidor/navegador
function useUserInfo() {
  const [u, setU] = useState({ nombre: "", organizacion: "" })
  useEffect(() => { setU(leerUsuario()) }, [])
  return u
}

export default function ClienteDashboardPage() {
  const { nombre, organizacion } = useUserInfo()

  const resumen = useQuery(["dashboard", "resumen"], () =>
    apiRequest<{ kpis: Kpis }>("/clientes/dashboard/resumen"),
    { refetchInterval: 60000, retry: 1 },
  )
  const confianza = useQuery(["dashboard", "confianza"], () =>
    apiRequest("/clientes/dashboard/confianza"),
    { refetchInterval: 60000, retry: 1 },
  )
  const alertas = useQuery(["dashboard", "alertas"], () =>
    apiRequest("/clientes/dashboard/alertas"),
    { refetchInterval: 60000, retry: 1 },
  )
  const agenda = useQuery(["dashboard", "agenda"], () =>
    apiRequest("/clientes/dashboard/agenda"),
    { refetchInterval: 60000, retry: 1 },
  )
  const actividad = useQuery(["dashboard", "actividad"], () =>
    apiRequest("/clientes/dashboard/actividad"),
    { refetchInterval: 60000, retry: 1 },
  )
  const graficas = useQuery(["dashboard", "graficas"], () =>
    apiRequest("/clientes/dashboard/graficas"),
    { refetchInterval: 60000, retry: 1 },
  )
  const onboarding = useQuery(["dashboard", "onboarding"], () =>
    apiRequest<Onboarding>("/clientes/dashboard/onboarding"),
    { retry: 1 },
  )
  const cupo = useQuery(["cupo"], () => apiRequest<Cupo>("/cupo"), { retry: 1 })
  const vencimientos = useQuery(["dashboard", "vencimientos"], () =>
    apiRequest("/participantes/vencimientos-por-empresa"),
    { refetchInterval: 60000, retry: 1 },
  )

  const isLoading = resumen.isLoading || confianza.isLoading
  const anyError = resumen.error || confianza.error || alertas.error

  if (anyError && !resumen.data) {
    return (
      <div className="space-y-6 px-4 py-4 lg:px-6 lg:py-6">
        <DashboardHeader nombre={nombre || "Usuario"} organizacion={organizacion} />
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-500/30 dark:bg-red-500/10">
          <p className="font-semibold text-red-700 dark:text-red-400">No pudimos cargar tu dashboard</p>
          <p className="text-sm text-muted-foreground">Revisa tu conexión e intenta de nuevo.</p>
          <button onClick={() => { resumen.refetch(); confianza.refetch(); alertas.refetch() }} className="mt-1 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600">Reintentar</button>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6 px-4 py-4 lg:px-6 lg:py-6">
        <Skeleton className="h-40 rounded-2xl" />
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-80 rounded-2xl lg:col-span-2" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </div>
    )
  }

  const kpis = (resumen.data as { kpis: Kpis } | undefined)?.kpis
  const pendientes = (resumen.data as { pendientes?: { acreditar: number; emitir: number; vencer: number } } | undefined)?.pendientes
  const agendaList = ((agenda.data as any[]) || [])
  const noData = !kpis || kpis.cursos_activos === 0

  // Resumen en una frase para el saludo
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const semana = agendaList.filter((c) => {
    const d = parseFecha(String(c.fecha_inicio || "").slice(0, 10))
    return d && d >= hoy && (d.getTime() - hoy.getTime()) / 86400000 <= 7
  }).length
  const partes: string[] = []
  if (semana > 0) partes.push(`${semana} ${semana === 1 ? "curso empieza" : "cursos empiezan"} esta semana`)
  if (kpis?.por_vencer) partes.push(`${kpis.por_vencer} ${kpis.por_vencer === 1 ? "constancia vence" : "constancias vencen"} en los próximos 30 días`)
  if (pendientes?.acreditar) partes.push(`${pendientes.acreditar} ${pendientes.acreditar === 1 ? "participante espera" : "participantes esperan"} acreditación`)
  const frase = noData
    ? "Aún no tienes cursos. Registra el primero para empezar a emitir constancias verificables."
    : partes.length ? `Hoy: ${partes.join(", ")}.` : "Todo en orden. No tienes pendientes urgentes."

  return (
    <div className="space-y-6 px-4 py-4 lg:px-6 lg:py-6">
      <DashboardHeader nombre={nombre || "Usuario"} organizacion={organizacion} resumen={frase} onboarding={onboarding.data} />

      {kpis && <SummaryCards kpis={kpis} />}

      <CupoCard cupo={cupo.data} delay={0.2} />

      {/* En móvil los pendientes van primero; en escritorio viven en la columna derecha */}
      <div className="lg:hidden">
        <AlertsPanel
          alertas={(alertas.data as any[]) || []}
          pendientes={pendientes}
          vencimientos={(vencimientos.data as any[]) || []}
          delay={0.3}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <AgendaPanel agenda={agendaList} delay={0.25} />
          <ConstanciasChart data={(graficas.data as any)?.constancias_mes || []} delay={0.35} />
          <div className="grid gap-6 sm:grid-cols-2">
            <ModalidadPanel data={(graficas.data as any)?.cursos_categoria || []} delay={0.45} />
            <Link href="/marketplace" className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-dashed border-orange-500/40 bg-orange-500/5 p-5 transition-colors hover:bg-orange-500/10 sm:p-6">
              <div>
                <span className="inline-flex rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-semibold text-white">Próximamente</span>
                <h2 className="mt-3 text-base font-semibold">Aparece en el Marketplace</h2>
                <p className="mt-1 text-sm text-muted-foreground">Las empresas podrán encontrar tus cursos publicados en el directorio.</p>
              </div>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-orange-500">Publicar cursos <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span>
            </Link>
          </div>
        </div>
        <div className="min-w-0 space-y-6">
          <div className="hidden lg:block">
            <AlertsPanel
              alertas={(alertas.data as any[]) || []}
              pendientes={pendientes}
              vencimientos={(vencimientos.data as any[]) || []}
              delay={0.3}
            />
          </div>
          <ConfidenceCard data={confianza.data as any} delay={0.4} />
          <ActivityTimeline actividad={(actividad.data as any[]) || []} delay={0.5} />
        </div>
      </div>
    </div>
  )
}
