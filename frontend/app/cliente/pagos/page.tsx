"use client"

import { Suspense, useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { AlertTriangle, CheckIcon, Clock, CreditCard, Loader2, Package, ShieldCheck } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field } from "@/components/ui/field"
import { Segmented } from "@/components/forms/form-bits"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { apiRequest } from "@/app/services/api"
import { CupoCard } from "@/components/dashboard/CupoCard"
import { UsoConstancias } from "@/components/cupo/uso-constancias"
import { fechaCorta, type Cupo } from "@/lib/cupo"

type Plan = {
  codigo: string
  nombre: string
  descripcion: string
  precio_mensual: number
  precio_anual: number
  constancias: number | null
  marketplace: boolean
  beneficios: string[]
}

type Actual = {
  id: string
  plan_codigo: string
  plan_nombre: string
  estatus: "activa" | "cancelada"
  periodo: "mensual" | "anual" | "prueba" | null
  vence: string | null
  pagado_hasta: string | null
  renovacion_automatica: boolean
  precio: number
}

type Mia = {
  actual: Actual | null
  pendiente: { id: string; plan_nombre: string; periodo: string } | null
  pagos_configurados: boolean
  paquete: { cantidad: number; precio: number }
}

type Periodo = "mensual" | "anual"

const mxn = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 })

export default function PagosPage() {
  return (
    <Suspense fallback={<div className="flex items-center gap-2 px-6 py-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>}>
      <Pagos />
    </Suspense>
  )
}

function Pagos() {
  const router = useRouter()
  const params = useSearchParams()
  const [planes, setPlanes] = useState<Plan[]>([])
  const [mia, setMia] = useState<Mia | null>(null)
  const [cupo, setCupo] = useState<Cupo | null>(null)
  const [stpsVerificado, setStpsVerificado] = useState<boolean | null>(null)
  const [cargando, setCargando] = useState(true)
  const [periodo, setPeriodo] = useState<Periodo>("mensual")
  const [destacado, setDestacado] = useState<string | null>(null)
  const [elegido, setElegido] = useState<Plan | null>(null)
  const [correo, setCorreo] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [cancelarAbierto, setCancelarAbierto] = useState(false)
  const inicial = useRef<{ plan?: string; extra?: number } | null>(null)

  const cargar = useCallback(async () => {
    const [ps, m, cu, st] = await Promise.all([
      apiRequest<Plan[]>("/suscripciones/planes"),
      apiRequest<Mia>("/suscripciones/mia").catch(() => null),
      apiRequest<Cupo>("/cupo").catch(() => null),
      apiRequest<{ validado: boolean }>("/organizaciones/stps").catch(() => null),
    ])
    setStpsVerificado(st ? st.validado : null)
    setPlanes(ps)
    setMia(m)
    setCupo(cu)
    return { m, cu }
  }, [])

  useEffect(() => {
    cargar().catch(() => toast.error("No pudimos cargar tu suscripción")).finally(() => setCargando(false))
    try { setCorreo(JSON.parse(localStorage.getItem("aaces_user") || "{}").email || "") } catch {}
  }, [cargar])

  // Al registrarse con un plan de pago llega con ?plan=profesional
  useEffect(() => {
    const p = params.get("plan")
    if (p && planes.length && !elegido) {
      const plan = planes.find((x) => x.codigo === p && x.precio_mensual > 0)
      if (plan) setElegido(plan)
    }
  }, [params, planes, elegido])

  // Regreso de Mercado Pago: esperamos a que llegue la confirmación (webhook)
  useEffect(() => {
    const pago = params.get("pago")
    if (!pago || cargando) return
    if (params.get("estado") === "rechazado") {
      toast.error("Mercado Pago no aprobó el pago. Puedes intentarlo de nuevo.")
      router.replace("/cliente/pagos")
      return
    }
    inicial.current = { plan: mia?.actual?.plan_codigo, extra: cupo?.extra }
    setConfirmando(true)
    let vueltas = 0
    const t = setInterval(async () => {
      vueltas++
      const { m, cu } = await cargar().catch(() => ({ m: null, cu: null }))
      const cambioPlan = m?.actual && m.actual.plan_codigo !== "trial" && !m.pendiente
      const cambioExtra = pago === "paquete" && cu && (cu.extra ?? 0) > (inicial.current?.extra ?? 0)
      if ((pago !== "paquete" && cambioPlan) || cambioExtra) {
        clearInterval(t)
        setConfirmando(false)
        toast.success(pago === "paquete" ? "¡Listo! Se agregaron tus constancias extra." : `¡Listo! Tu plan ${m!.actual!.plan_nombre} está activo.`)
        router.replace("/cliente/pagos")
      } else if (vueltas >= 15) {
        clearInterval(t)
        setConfirmando(false)
        router.replace("/cliente/pagos")
      }
    }, 4000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, cargando])

  const actual = mia?.actual
  const esPrueba = !actual || actual.plan_codigo === "trial"
  const recomendado = cupo?.recomendacion?.plan_sugerido?.codigo ?? null
  const pagados = planes.filter((p) => p.precio_mensual > 0)

  const pagar = async () => {
    if (!elegido) return
    setEnviando(true)
    try {
      const r = await apiRequest<{ url_pago: string }>("/suscripciones/pagar", {
        method: "POST",
        body: JSON.stringify({ plan_codigo: elegido.codigo, periodo, correo: correo.trim() || undefined }),
      })
      window.location.href = r.url_pago
    } catch (e) {
      toast.error((e as Error).message)
      setEnviando(false)
    }
  }

  const comprarPaquete = async () => {
    setEnviando(true)
    try {
      const r = await apiRequest<{ url_pago: string }>("/suscripciones/paquete", { method: "POST", body: JSON.stringify({ correo: correo.trim() || undefined }) })
      window.location.href = r.url_pago
    } catch (e) {
      toast.error((e as Error).message)
      setEnviando(false)
    }
  }

  const cancelar = async () => {
    setEnviando(true)
    try {
      const r = await apiRequest<{ acceso_hasta: string | null }>("/suscripciones/cancelar", { method: "POST" })
      toast.success("Suscripción cancelada", { description: r.acceso_hasta ? `Conservas tu plan hasta el ${fechaCorta(r.acceso_hasta)}.` : undefined })
      setCancelarAbierto(false)
      await cargar()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  const estadoTexto = !actual
    ? "Sin plan activo"
    : actual.estatus === "cancelada"
      ? `Cancelada · activa hasta el ${fechaCorta(actual.vence)}`
      : actual.periodo === "prueba"
        ? actual.vence ? `Prueba gratuita · termina el ${fechaCorta(actual.vence)}` : "Prueba gratuita · 50 constancias"
        : actual.periodo === "mensual"
          ? `Mensual · se cobra solo cada mes${actual.pagado_hasta ? ` · pagado hasta el ${fechaCorta(actual.pagado_hasta)}` : ""}`
          : actual.periodo === "anual"
            ? `Anual · pagado hasta el ${fechaCorta(actual.pagado_hasta)}`
            : actual.vence ? `Activa hasta el ${fechaCorta(actual.vence)}` : "Activa"

  return (
    <div className="space-y-6 px-4 py-4 lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Suscripción a AACES</h1>
        {actual && (
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${actual.estatus === "activa" ? "bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-400" : "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"}`}>
            {actual.estatus === "activa" ? "Activa" : "Cancelada"}
          </span>
        )}
      </div>

      {confirmando && (
        <div role="status" className="flex items-center gap-3 rounded-2xl border border-orange-500/40 bg-orange-50 p-4 text-sm dark:bg-orange-500/10">
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-orange-500" />
          <div>
            <p className="font-semibold">Estamos confirmando tu pago con Mercado Pago…</p>
            <p className="text-muted-foreground">Suele tardar unos segundos. Si pagaste en OXXO o por transferencia, se activa cuando se acredite.</p>
          </div>
        </div>
      )}

      {mia?.pendiente && !confirmando && (
        <div role="status" className="flex items-start gap-3 rounded-2xl border bg-card p-4 text-sm">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <p>
            Tienes un pago en proceso del plan <strong>{mia.pendiente.plan_nombre}</strong> ({mia.pendiente.periodo}).
            Si pagaste en OXXO o por transferencia, tu plan se activa en cuanto Mercado Pago lo acredite.
          </p>
        </div>
      )}

      {cargando ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
      ) : (
        <>
          <Card>
            <CardHeader><CardTitle>Tu plan</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-lg font-medium">{actual?.plan_nombre || "Sin plan"}</p>
                  <p className="text-sm text-muted-foreground">{estadoTexto}</p>
                  {actual && !esPrueba && actual.precio > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">{mxn(actual.precio)} {actual.periodo === "anual" ? "al año" : "al mes"} · IVA incluido · Mercado Pago</p>
                  )}
                </div>
                {actual && !esPrueba && actual.estatus === "activa" && (
                  <Button variant="outline" onClick={() => setCancelarAbierto(true)}>Cancelar suscripción</Button>
                )}
              </div>
            </CardContent>
          </Card>

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

          {cupo?.activa && !esPrueba && mia && (
            <section className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:p-6">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500"><Package className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold">¿Un mes con muchos grupos?</h2>
                <p className="text-sm text-muted-foreground">
                  Agrega {mia.paquete.cantidad} constancias por {mxn(mia.paquete.precio)}. Se usan cuando se acaba tu plan del mes y no caducan.
                </p>
              </div>
              <Button onClick={comprarPaquete} disabled={enviando || !mia.pagos_configurados} className="shrink-0">
                {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />} Comprar paquete
              </Button>
            </section>
          )}

          {stpsVerificado === false && <AvisoStps />}

          <div id="planes" className="flex scroll-mt-24 flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-medium">Planes</h2>
              <p className="text-sm text-muted-foreground">Precios con IVA incluido. Paga con tarjeta, OXXO o transferencia.</p>
            </div>
            <Segmented<Periodo>
              ariaLabel="Periodo de pago"
              value={periodo}
              onChange={setPeriodo}
              options={[{ value: "mensual", label: "Mensual" }, { value: "anual", label: <>Anual <span className="ml-1 rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">1 mes gratis</span></> }]}
            />
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {pagados.map((plan) => {
              const esActual = actual?.plan_codigo === plan.codigo && actual.estatus === "activa" && (actual.periodo === periodo)
              const marcado = recomendado ? recomendado === plan.codigo : plan.codigo === "profesional"
              const precio = periodo === "anual" ? plan.precio_anual : plan.precio_mensual
              return (
                <Card
                  key={plan.codigo}
                  id={`plan-${plan.codigo}`}
                  className={`scroll-mt-24 transition-shadow duration-500 ${marcado ? "border-2 border-orange-500" : ""} ${destacado === plan.codigo ? "shadow-xl shadow-orange-500/20 ring-4 ring-orange-500/20" : ""}`}
                >
                  <CardHeader>
                    {marcado && (
                      <span className="mb-2 inline-block w-fit rounded-full bg-orange-500 px-3 py-1 text-xs font-medium text-white">
                        {recomendado ? "Recomendado para ti" : "Más popular"}
                      </span>
                    )}
                    <CardTitle>{plan.nombre}</CardTitle>
                    <p className="text-sm text-muted-foreground">{plan.descripcion}</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <span className="text-3xl font-bold tabular-nums">{mxn(precio)}</span>
                      <span className="text-muted-foreground">{periodo === "anual" ? "/año" : "/mes"}</span>
                      {periodo === "anual" && (
                        <p className="text-xs font-medium text-orange-600 dark:text-orange-400">Equivale a {mxn(plan.precio_anual / 12)} al mes · ahorras {mxn(plan.precio_mensual * 12 - plan.precio_anual)}</p>
                      )}
                    </div>
                    <ul className="space-y-2 text-sm">
                      {plan.beneficios.map((f) => (
                        <li key={f} className="flex items-center gap-2"><CheckIcon className="h-4 w-4 shrink-0 text-green-600" /> {f}</li>
                      ))}
                    </ul>
                    {mia?.pagos_configurados ? (
                      <Button className="w-full" variant={marcado ? "default" : "outline"} disabled={esActual} onClick={() => setElegido(plan)}>
                        {esActual ? "Tu plan actual" : <><CreditCard className="h-4 w-4" /> {esPrueba ? "Elegir plan" : "Cambiar a este plan"}</>}
                      </Button>
                    ) : (
                      <Button className="w-full" variant="outline" asChild>
                        <Link href={`/contacto?asunto=${encodeURIComponent(`Quiero el plan ${plan.nombre} (${periodo})`)}`}>Solicitar este plan</Link>
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" /> Pagos procesados por Mercado Pago. AACES no guarda los datos de tu tarjeta.
          </p>
        </>
      )}

      {/* Confirmar y pagar */}
      <Sheet open={!!elegido} onOpenChange={(o) => { if (!o) { setElegido(null); if (params.get("plan")) router.replace("/cliente/pagos") } }}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          {elegido && (
            <>
              <SheetHeader className="border-b px-6 py-5 text-left">
                <SheetTitle>Plan {elegido.nombre}</SheetTitle>
                <SheetDescription>Revisa y paga de forma segura en Mercado Pago.</SheetDescription>
              </SheetHeader>
              <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
                <Segmented<Periodo>
                  ariaLabel="Periodo de pago"
                  value={periodo}
                  onChange={setPeriodo}
                  options={[{ value: "mensual", label: "Mensual" }, { value: "anual", label: "Anual · 1 mes gratis" }]}
                />
                <div className="rounded-xl border bg-muted/40 p-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-muted-foreground">Total {periodo === "anual" ? "por un año" : "cada mes"}</span>
                    <span className="text-2xl font-bold tabular-nums">{mxn(periodo === "anual" ? elegido.precio_anual : elegido.precio_mensual)}</span>
                  </div>
                  <p className="mt-1 text-right text-xs text-muted-foreground">IVA incluido</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  {periodo === "mensual"
                    ? "Se cobra solo cada mes a tu tarjeta o saldo de Mercado Pago. Puedes cancelar cuando quieras y conservas el plan hasta el final del mes pagado."
                    : "Pago único con tarjeta, OXXO o transferencia SPEI. Te avisamos antes de que venza para renovarlo."}
                </p>
                {!esPrueba && actual?.plan_codigo !== elegido.codigo && (
                  <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                    Al confirmarse el pago, este plan reemplaza al actual{actual?.periodo === "mensual" ? " y dejamos de cobrarte el anterior" : ""}.
                  </p>
                )}
                {stpsVerificado === false && <AvisoStps compacto />}
                <Field label={periodo === "mensual" ? "Correo de tu cuenta de Mercado Pago" : "Correo para el recibo"} htmlFor="mp_correo" hint={periodo === "mensual" ? "Debe ser el mismo con el que entrarás a Mercado Pago." : undefined}>
                  <Input id="mp_correo" type="email" inputMode="email" autoComplete="email" value={correo} onChange={(e) => setCorreo(e.target.value)} />
                </Field>
              </div>
              <SheetFooter className="flex-row gap-2 border-t px-6 py-4 sm:justify-end">
                <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => setElegido(null)}>Cancelar</Button>
                <Button className="flex-1 sm:flex-none" onClick={pagar} disabled={enviando || !correo.trim()}>
                  {enviando ? <><Loader2 className="h-4 w-4 animate-spin" /> Abriendo…</> : <>Pagar con Mercado Pago</>}
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Confirmar cancelación */}
      <Sheet open={cancelarAbierto} onOpenChange={setCancelarAbierto}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b px-6 py-5 text-left">
            <SheetTitle>¿Cancelar tu suscripción?</SheetTitle>
            <SheetDescription>Ya no se te cobrará de nuevo.</SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-3 px-6 py-6 text-sm">
            <p>Conservas tu plan <strong>{actual?.plan_nombre}</strong> hasta el <strong>{fechaCorta(actual?.pagado_hasta || actual?.vence || null)}</strong>, que es lo que ya pagaste.</p>
            <p className="text-muted-foreground">Después tu cuenta queda en solo lectura: puedes consultar y reimprimir tus DC-3, y siguen siendo válidos, pero no crear ni editar. Tus cursos salen del Marketplace.</p>
          </div>
          <SheetFooter className="flex-row gap-2 border-t px-6 py-4 sm:justify-end">
            <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => setCancelarAbierto(false)}>Conservar mi plan</Button>
            <Button variant="destructive" className="flex-1 sm:flex-none" onClick={cancelar} disabled={enviando}>
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Sí, cancelar
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}

/** Antes de pagar: que nadie pague creyendo que tendrá el sello de agente verificado. */
function AvisoStps({ compacto = false }: { compacto?: boolean }) {
  return (
    <div role="note" className={`flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200 ${compacto ? "p-3 text-xs" : "p-4 text-sm"}`}>
      <AlertTriangle className={`mt-0.5 shrink-0 text-amber-600 ${compacto ? "h-4 w-4" : "h-5 w-5"}`} />
      <div>
        <p className="font-semibold">Tu registro ante la STPS no está verificado</p>
        <p className="mt-0.5">
          Puedes usar AACES y emitir tus DC-3, pero no llevarán el sello de agente verificado, la página de su QR dirá
          “Registro STPS: no verificado” y tus cursos no aparecerán en el Marketplace.{" "}
          <Link href="/cliente/ajustes?tab=stps" className="font-semibold underline">Revisar mi registro</Link>
        </p>
      </div>
    </div>
  )
}
