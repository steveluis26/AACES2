"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { BadgeCheck, ExternalLink, Loader2, RefreshCw, ShieldOff, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"

type Estado = {
  rfc: string | null; validado: boolean; origen: string | null; estatus: string | null; razon_social: string | null
  cursos: number | null; instructores: number | null; consultado_en: string | null; fuente: string
}

/** Panel del admin: estado STPS de una organización, verificar ahora o validar a mano. */
export function AdminStps({ orgId, headers }: { orgId: string; headers: Record<string, string> }) {
  const [e, setE] = useState<Estado | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    const r = await fetch(`/api/v1/admin/organizaciones/${orgId}/stps`, { headers })
    if (r.ok) setE(await r.json())
  }, [orgId, headers])
  useEffect(() => { cargar() }, [cargar])

  const accion = async (tipo: "verificar" | "validar" | "revocar") => {
    setOcupado(tipo)
    try {
      const r = tipo === "verificar"
        ? await fetch(`/api/v1/admin/organizaciones/${orgId}/verificar-stps`, { method: "POST", headers })
        : await fetch(`/api/v1/admin/organizaciones/${orgId}/validar-stps`, {
            method: "PUT", headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({ validado: tipo === "validar", stps_registro: e?.rfc || undefined, notas_admin: tipo === "validar" ? "Validado manualmente por AACES" : "Validación STPS revocada" }),
          })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(data.detail || `Error ${r.status}`)
      toast.success(tipo === "verificar" ? (data.validado ? "Encontrado y activo en la STPS" : "No aparece en el registro de la STPS") : tipo === "validar" ? "Validado manualmente" : "Validación revocada")
      await cargar()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setOcupado(null)
    }
  }

  if (!e) return null
  return (
    <div className="rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {e.validado ? <BadgeCheck className="h-5 w-5 text-green-600" /> : <ShieldOff className="h-5 w-5 text-amber-500" />}
          <div>
            <p className="text-sm font-semibold">
              {e.validado ? `Registro STPS validado (${e.origen === "manual" ? "manual" : "automático"})` : e.consultado_en ? "No aparece en el registro STPS" : "Registro STPS sin verificar"}
            </p>
            <p className="text-xs text-muted-foreground">
              RFC {e.rfc || "—"}{e.estatus ? ` · estatus STPS: ${e.estatus}` : ""}{e.cursos !== null ? ` · ${e.cursos} cursos · ${e.instructores} instructores` : ""}
              {e.consultado_en ? ` · consultado ${new Date(e.consultado_en).toLocaleString("es-MX")}` : ""}
            </p>
            {e.razon_social && <p className="text-xs text-muted-foreground">Nombre en la STPS: {e.razon_social}</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => accion("verificar")} disabled={!!ocupado}>
            {ocupado === "verificar" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Verificar en la STPS
          </Button>
          {e.validado
            ? <Button size="sm" variant="outline" onClick={() => accion("revocar")} disabled={!!ocupado}><ShieldOff className="h-4 w-4" /> Revocar</Button>
            : <Button size="sm" onClick={() => accion("validar")} disabled={!!ocupado}><ShieldCheck className="h-4 w-4" /> Validar a mano</Button>}
          <a href={e.fuente} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 self-center text-xs font-medium text-orange-500 hover:underline">Registro oficial <ExternalLink className="h-3 w-3" /></a>
        </div>
      </div>
    </div>
  )
}
