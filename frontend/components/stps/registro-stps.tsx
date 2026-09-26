"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { AlertTriangle, BadgeCheck, ExternalLink, Loader2, RefreshCw, SearchX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { apiRequest } from "@/app/services/api"

type EstadoStps = {
  rfc: string | null
  validado: boolean
  validado_en: string | null
  origen: "automatica" | "manual" | null
  estatus: string | null
  razon_social: string | null
  cursos: number | null
  instructores: number | null
  consultado_en: string | null
  fuente: string
  aviso?: string
}

const fecha = (v: string | null) => (v ? new Date(v).toLocaleString("es-MX", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "")

/** Estado del agente en el registro público de la STPS, con opción de volver a consultar. */
export function RegistroStps() {
  const [e, setE] = useState<EstadoStps | null>(null)
  const [consultando, setConsultando] = useState(false)

  useEffect(() => { apiRequest<EstadoStps>("/organizaciones/stps").then(setE).catch(() => setE(null)) }, [])

  const verificar = async () => {
    setConsultando(true)
    try {
      const r = await apiRequest<EstadoStps>("/organizaciones/stps/verificar", { method: "POST" })
      setE(r)
      if (r.aviso) toast.info(r.aviso)
      else if (r.validado) toast.success("Registro STPS verificado")
      else toast.warning("No encontramos tu RFC en el registro de la STPS")
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setConsultando(false)
    }
  }

  if (!e) return <div className="flex items-center gap-2 rounded-2xl border bg-card p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>

  const noEncontrado = !e.validado && e.consultado_en
  const nombreDistinto = !e.validado && e.estatus === "Nombre distinto"
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6" aria-labelledby="stps-titulo">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white ${e.validado ? "bg-green-600" : noEncontrado ? "bg-amber-500" : "bg-muted-foreground/60"}`}>
          {e.validado ? <BadgeCheck className="h-5 w-5" /> : noEncontrado ? <SearchX className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="stps-titulo" className="text-base font-semibold">
            {e.validado ? "Agente capacitador registrado ante la STPS" : nombreDistinto ? "Tu RFC aparece en la STPS con otro nombre" : noEncontrado ? "No encontramos tu registro en la STPS" : "Registro STPS sin verificar"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {e.validado
              ? e.origen === "automatica"
                ? "Lo comprobamos en el registro público de agentes capacitadores externos. Tus DC-3 y la página de su QR lo muestran como verificado."
                : "Validado por AACES. Tus DC-3 y la página de su QR lo muestran como verificado."
              : nombreDistinto
                ? `En la STPS ese RFC está registrado como “${e.razon_social}”. Para proteger a las agencias de suplantaciones no lo validamos en automático: lo revisaremos manualmente. Si es tu empresa, verifica que tu razón social en AACES sea la misma.`
                : noEncontrado
                ? `Buscamos el RFC ${e.rfc || ""} en el registro público y no aparece. Revisa que sea el RFC con el que te registraste ante la STPS. Si tu registro es reciente o está en trámite, puede tardar en aparecer.`
                : "Consultamos el registro público de la STPS con tu RFC para mostrar a las empresas que eres un agente registrado."}
          </p>

          {e.validado && (e.razon_social || e.cursos !== null) && (
            <dl className="mt-4 grid gap-3 border-t pt-4 text-sm sm:grid-cols-3">
              {e.razon_social && <div className="sm:col-span-3"><dt className="text-xs text-muted-foreground">Nombre en la STPS</dt><dd className="font-medium">{e.razon_social}</dd></div>}
              <div><dt className="text-xs text-muted-foreground">RFC</dt><dd className="font-mono">{e.rfc}</dd></div>
              {e.cursos !== null && <div><dt className="text-xs text-muted-foreground">Cursos registrados</dt><dd className="font-semibold tabular-nums">{e.cursos}</dd></div>}
              {e.instructores !== null && <div><dt className="text-xs text-muted-foreground">Instructores registrados</dt><dd className="font-semibold tabular-nums">{e.instructores}</dd></div>}
            </dl>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button variant={e.validado ? "outline" : "default"} size="sm" onClick={verificar} disabled={consultando}>
              {consultando ? <><Loader2 className="h-4 w-4 animate-spin" /> Consultando la STPS…</> : <><RefreshCw className="h-4 w-4" /> Verificar ahora</>}
            </Button>
            <a href={e.fuente} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-orange-500 hover:underline">
              Ver el registro oficial <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
          {e.consultado_en && <p className="mt-2 text-xs text-muted-foreground">Última consulta: {fecha(e.consultado_en)} · se vuelve a revisar cada semana.</p>}
        </div>
      </div>
    </section>
  )
}
