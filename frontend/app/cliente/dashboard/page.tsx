"use client"

import { useQuery } from "react-query"
import { apiRequest } from "@/app/services/api"
import { DashboardHeader } from "@/components/dashboard/Header"
import { SummaryCards } from "@/components/dashboard/SummaryCards"
import { QuickActions } from "@/components/dashboard/QuickActions"
import { AlertsPanel } from "@/components/dashboard/AlertsPanel"
import { AgendaPanel } from "@/components/dashboard/AgendaPanel"
import { ActivityTimeline } from "@/components/dashboard/ActivityTimeline"
import { ConfidenceCard } from "@/components/dashboard/ConfidenceCard"
import { ChartsPanel } from "@/components/dashboard/ChartsPanel"
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

function useUserInfo() {
  if (typeof window === "undefined") return { nombre: "Usuario", organizacion: "" }
  const userStr = localStorage.getItem("aaces_user")
  if (userStr) {
    try {
      const u = JSON.parse(userStr)
      return { nombre: u.nombre || u.email || "Usuario", organizacion: u.organizacion || "" }
    } catch {}
  }
  try {
    const token = localStorage.getItem("aaces_token") || ""
    const payload = JSON.parse(atob(token.split(".")[1]))
    return {
      nombre: payload.name || payload.nombre || "Usuario",
      organizacion: payload.razon_social || "",
    }
  } catch {
    return { nombre: "Usuario", organizacion: "" }
  }
}

function SectionSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-20 w-full rounded-lg" />
    </div>
  )
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

  const isLoading = resumen.isLoading || confianza.isLoading
  const anyError = resumen.error || confianza.error || alertas.error

  if (anyError && !resumen.data) {
    return (
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
        <DashboardHeader nombre={nombre} organizacion={organizacion} />
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-6 text-center">
          <p className="text-destructive font-medium">Error al cargar el dashboard</p>
          <p className="text-sm text-muted-foreground mt-1">
            Verifica tu conexión e intenta de nuevo
          </p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
        <SectionSkeleton />
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-16 rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-40 rounded-lg" />
          <Skeleton className="h-40 rounded-lg" />
        </div>
      </div>
    )
  }

  const kpis = (resumen.data as { kpis: Kpis } | undefined)?.kpis
  const noData = !kpis || kpis.cursos_activos === 0

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 lg:px-6">
        <DashboardHeader nombre={nombre} organizacion={organizacion} />
      </div>

      {noData ? (
        <div className="px-4 lg:px-6">
          <div className="rounded-lg border border-dashed p-8 text-center space-y-4">
            <h2 className="text-xl font-semibold">Bienvenido a AACES</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Todavía no tienes cursos registrados. Crea tu primer curso para comenzar a
              generar constancias y certificados digitales verificables.
            </p>
            <button
              onClick={() => {
                const r = "/cliente/cursos/crear"
                try { window.location.href = r } catch {}
              }}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Crear mi primer curso
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="px-4 lg:px-6">
            <SummaryCards kpis={kpis!} />
          </div>

          <div className="px-4 lg:px-6">
            <QuickActions onboarding={onboarding.data} />
          </div>

          {(alertas.data as unknown[])?.length > 0 && (
            <div className="px-4 lg:px-6">
              <AlertsPanel alertas={alertas.data as any[]} />
            </div>
          )}

          <div className="px-4 lg:px-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <AgendaPanel agenda={(agenda.data as any[]) || []} />
            <ActivityTimeline actividad={(actividad.data as any[]) || []} />
          </div>

          <div className="px-4 lg:px-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <ConfidenceCard data={confianza.data as any} />
            <div className="rounded-lg border border-dashed p-6 flex flex-col items-center justify-center text-center gap-2">
              <h3 className="text-sm font-medium text-muted-foreground">Visibilidad</h3>
              <p className="text-xs text-muted-foreground">
                Próximamente — Marketplace
              </p>
            </div>
          </div>

          <div className="px-4 lg:px-6">
            <ChartsPanel
              constancias_mes={(graficas.data as any)?.constancias_mes || []}
              cursos_categoria={(graficas.data as any)?.cursos_categoria || []}
            />
          </div>
        </>
      )}
    </div>
  )
}
