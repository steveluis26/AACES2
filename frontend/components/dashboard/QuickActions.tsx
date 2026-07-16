"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, UserPlus, FileCheck, Search, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

type Onboarding = {
  tiene_cursos: boolean
  tiene_participantes: boolean
  tiene_constancias: boolean
  progreso: number
}

const EXISTING_ROUTES: Record<string, string | null> = {
  crear_curso: "/cliente/cursos/crear",
  registrar_participante: null,
  emitir_constancia: null,
  buscar_participante: "/cliente/participantes",
}

export function QuickActions({ onboarding }: { onboarding?: Onboarding }) {
  const router = useRouter()

  const actions = [
    {
      id: "crear_curso",
      label: "Nuevo curso",
      icon: Plus,
      variant: "default" as const,
      route: EXISTING_ROUTES.crear_curso,
      highlight: !onboarding?.tiene_cursos,
    },
    {
      id: "registrar_participante",
      label: "Registrar participante",
      icon: UserPlus,
      variant: "secondary" as const,
      route: EXISTING_ROUTES.registrar_participante,
      highlight: onboarding?.tiene_cursos && !onboarding?.tiene_participantes,
    },
    {
      id: "emitir_constancia",
      label: "Emitir constancia",
      icon: FileCheck,
      variant: "secondary" as const,
      route: EXISTING_ROUTES.emitir_constancia,
      highlight: onboarding?.tiene_participantes && !onboarding?.tiene_constancias,
    },
    {
      id: "buscar_participante",
      label: "Buscar participante",
      icon: Search,
      variant: "outline" as const,
      route: EXISTING_ROUTES.buscar_participante,
      highlight: false,
    },
  ]

  const handleClick = (action: typeof actions[0]) => {
    const ruta = EXISTING_ROUTES[action.id as keyof typeof EXISTING_ROUTES]
    if (ruta) {
      router.push(ruta)
    } else {
      toast("Esta función estará disponible próximamente.", {
        icon: <Sparkles className="h-4 w-4" />,
      })
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Acciones rápidas
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3">
          {actions.map((action) => (
            <Button
              key={action.id}
              variant={action.variant}
              size="sm"
              onClick={() => handleClick(action)}
              className={action.highlight ? "ring-2 ring-primary/40" : ""}
            >
              <action.icon className="h-4 w-4 mr-1.5" />
              {action.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
