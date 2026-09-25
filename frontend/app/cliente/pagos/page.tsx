"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardHeader, CardTitle, CardContent, Button } from "@/components/ui"
import { apiRequest } from "@/app/services/api"
import { toast } from "sonner"
import { CheckIcon, CreditCardIcon, Loader2 } from "lucide-react"
import { CupoCard } from "@/components/dashboard/CupoCard"
import { UsoConstancias } from "@/components/cupo/uso-constancias"
import type { Cupo } from "@/lib/cupo"

type Plan = {
  id: string
  codigo: string
  nombre: string
  descripcion: string
  precio_mensual: number
  precio_anual: number
  cursos_max: number
  usuarios_max: number
  constancias_max: number
  incluye_marketplace: boolean
  incluye_api: boolean
  incluye_white_label: boolean
  incluye_soporte_prioritario: boolean
}

type Suscripcion = {
  id: string
  plan_nombre: string
  plan_codigo: string
  estatus: string
  fecha_inicio: string | null
  fecha_fin: string | null
  metodo_pago: string | null
  referencia_pago: string | null
}

const FEATURES_BY_PLAN: Record<string, string[]> = {
  prueba: ["50 constancias", "1 capacitador", "Validación QR"],
  profesional: ["500 constancias", "Capacitadores ilimitados", "Validación QR", "Diplomas personalizados", "Soporte prioritario"],
  empresa: ["Constancias ilimitadas", "Capacitadores ilimitados", "API de validación", "White label", "Soporte dedicado"],
}

export default function ClientePagosPage() {
  const [planes, setPlanes] = useState<Plan[]>([])
  const [suscripcion, setSuscripcion] = useState<Suscripcion | null>(null)
  const [loading, setLoading] = useState(true)
  const [procesando, setProcesando] = useState<string | null>(null)
  const [cupo, setCupo] = useState<Cupo | null>(null)
  const [destacado, setDestacado] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const [ps, mi, cu] = await Promise.all([
        apiRequest<Plan[]>("/stripe/planes"),
        apiRequest<Suscripcion | null>("/stripe/suscripcion/mia").catch(() => null),
        apiRequest<Cupo>("/cupo").catch(() => null),
      ])
      setPlanes(ps)
      setSuscripcion(mi)
      setCupo(cu)
    } catch {
      toast.error("Error al cargar planes")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const elegirPlan = async (plan: Plan) => {
    setProcesando(plan.codigo)
    try {
      const res = await apiRequest<{ demo: boolean; estatus: string; mensaje?: string }>(
        "/stripe/suscripcion",
        { method: "POST", body: JSON.stringify({ plan_codigo: plan.codigo }) }
      )
      toast.success(res.mensaje || "Suscripción iniciada")
      await cargar()
    } catch (e) {
      toast.error((e as Error)?.message || "Error al suscribirse")
    } finally {
      setProcesando(null)
    }
  }

  const cancelar = async () => {
    if (!suscripcion) return
    try {
      await apiRequest(`/stripe/suscripcion/${suscripcion.id}/cancelar`, { method: "PUT" })
      toast.success("Suscripción cancelada")
      await cargar()
    } catch (e) {
      toast.error((e as Error)?.message || "Error al cancelar")
    }
  }

  const recomendado = cupo?.recomendacion?.plan_sugerido?.codigo ?? null

  const badgeColor =
    suscripcion?.estatus === "activa"
      ? "bg-green-100 text-green-800"
      : suscripcion?.estatus === "pendiente"
      ? "bg-amber-100 text-amber-800"
      : "bg-gray-100 text-gray-800"

  return (
    <div className="space-y-6 px-4 lg:px-6 py-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Suscripción a AACES</h1>
        {suscripcion && (
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${badgeColor}`}>
            {suscripcion.estatus === "activa" ? "Activa" : suscripcion.estatus === "pendiente" ? "Pendiente de pago" : suscripcion.estatus}
          </span>
        )}
      </div>

      {suscripcion && (
        <Card>
          <CardHeader>
            <CardTitle>Tu suscripción actual</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-lg font-medium">{suscripcion.plan_nombre}</p>
                <p className="text-sm text-muted-foreground">
                  {suscripcion.fecha_inicio && <>Inicio: {new Date(suscripcion.fecha_inicio).toLocaleDateString("es-MX")}</>}
                  {suscripcion.fecha_fin && <> · Renovación: {new Date(suscripcion.fecha_fin).toLocaleDateString("es-MX")}</>}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  El primer pago domicilia los siguientes meses automáticamente hasta que canceles.
                </p>
              </div>
              <Button variant="outline" onClick={cancelar}>Cancelar suscripción</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {cupo && (
        <section className="space-y-6" aria-label="Uso de constancias">
          <CupoCard cupo={cupo} sinBoton />
          <UsoConstancias
            cupo={cupo}
            onElegirPlan={(codigo) => {
              setDestacado(codigo)
              document.getElementById(`plan-${codigo}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
            }}
          />
        </section>
      )}

      <div id="planes" className="scroll-mt-24">
        <h2 className="text-lg font-medium mb-1">Planes</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Precios que tienen sentido. Sin límites absurdos de constancias. Paga por lo que usas.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando planes…
        </div>
      ) : (
        <div className="grid-cards">
          {planes.map((plan) => {
            const features = FEATURES_BY_PLAN[plan.codigo] || []
            const esActual = suscripcion?.plan_codigo === plan.codigo && suscripcion.estatus !== "cancelada"
            return (
              <Card
                key={plan.id}
                id={`plan-${plan.codigo}`}
                className={`scroll-mt-24 transition-shadow duration-500 ${(recomendado ? recomendado === plan.codigo : plan.codigo === "profesional") ? "border-orange-500 border-2" : ""} ${destacado === plan.codigo ? "shadow-xl shadow-orange-500/20 ring-4 ring-orange-500/20" : ""}`}
              >
                <CardHeader>
                  {recomendado === plan.codigo ? (
                    <span className="mb-2 inline-block rounded-full bg-orange-500 px-3 py-1 text-xs font-medium text-white w-fit">
                      Recomendado para ti
                    </span>
                  ) : plan.codigo === "profesional" && !recomendado && (
                    <span className="mb-2 inline-block rounded-full bg-orange-500 px-3 py-1 text-xs font-medium text-white w-fit">
                      Más popular
                    </span>
                  )}
                  <CardTitle>{plan.nombre}</CardTitle>
                  <p className="text-sm text-muted-foreground">{plan.descripcion}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <span className="text-3xl font-bold">${plan.precio_mensual}</span>
                    <span className="text-muted-foreground">/mes</span>
                  </div>
                  <ul className="space-y-2 text-sm">
                    {features.map((f) => (
                      <li key={f} className="flex items-center gap-2">
                        <CheckIcon className="h-4 w-4 text-green-600" /> {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    variant={plan.codigo === "profesional" ? "default" : "outline"}
                    disabled={procesando === plan.codigo || esActual}
                    onClick={() => elegirPlan(plan)}
                  >
                    {procesando === plan.codigo ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Procesando…</>
                    ) : esActual ? (
                      "Plan actual"
                    ) : plan.precio_mensual === 0 ? (
                      "Comenzar"
                    ) : (
                      <><CreditCardIcon className="h-4 w-4 mr-2" /> Elegir plan</>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Pagos procesados por Stripe. Al elegir un plan de pago, el primer cargo domicilia los siguientes meses automáticamente.
      </p>
    </div>
  )
}
