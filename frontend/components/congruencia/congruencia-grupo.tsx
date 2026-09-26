"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { AlertTriangle, BadgeCheck, CheckCircle2, Loader2, ShieldCheck } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { apiRequest } from "@/app/services/api"
import type { Congruencia } from "@/lib/congruencia"

type Opcion = { id: string; nombre: string; stps_registrado?: boolean; activo?: boolean; cursos?: { id: string }[] }
const NINGUNO = "__ninguno__"

/** Curso del catálogo e instructor del grupo, con los avisos de congruencia del DC-3. */
export function CongruenciaGrupo({ cursoId }: { cursoId: string }) {
  const [c, setC] = useState<Congruencia | null>(null)
  const [catalogo, setCatalogo] = useState<Opcion[]>([])
  const [instructores, setInstructores] = useState<Opcion[]>([])
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    const [cg, cat, ins] = await Promise.all([
      apiRequest<Congruencia>(`/clientes/cursos/${cursoId}/congruencia`).catch(() => null),
      apiRequest<Opcion[]>("/catalogo/cursos").catch(() => []),
      apiRequest<Opcion[]>("/instructores").catch(() => []),
    ])
    setC(cg)
    setCatalogo(cat)
    setInstructores(ins.filter((i) => i.activo !== false))
  }, [cursoId])
  useEffect(() => { cargar() }, [cargar])

  const guardar = async (cambio: { catalogo_curso_id?: string | null; instructor_id?: string | null }) => {
    setGuardando(true)
    try {
      setC(await apiRequest<Congruencia>(`/clientes/cursos/${cursoId}/congruencia`, { method: "PUT", body: JSON.stringify(cambio) }))
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  if (!c) return null
  const puede = (i: Opcion) => !c.catalogo_curso_id || !!i.cursos?.some((x) => x.id === c.catalogo_curso_id)

  return (
    <section className={`rounded-2xl border p-5 shadow-sm ${c.congruente ? "bg-card" : "border-amber-500/40 bg-amber-50/50 dark:bg-amber-500/5"}`} aria-labelledby="cg-titulo">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id="cg-titulo" className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4 text-orange-500" /> DC-3 congruente</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">El DC-3 debe llevar el curso registrado ante la STPS y al instructor que lo impartió.</p>
        </div>
        {guardando && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-orange-500" />}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-medium">
          Curso del catálogo
          <Select value={c.catalogo_curso_id || NINGUNO} onValueChange={(v) => guardar({ catalogo_curso_id: v === NINGUNO ? null : v })}>
            <SelectTrigger><SelectValue placeholder="Elige el curso" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NINGUNO}>Sin ligar</SelectItem>
              {catalogo.map((o) => <SelectItem key={o.id} value={o.id}>{o.nombre}{o.stps_registrado ? " · STPS ✓" : ""}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Instructor que lo imparte
          <Select value={c.instructor_id || NINGUNO} onValueChange={(v) => guardar({ instructor_id: v === NINGUNO ? null : v })}>
            <SelectTrigger><SelectValue placeholder="Elige al instructor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NINGUNO}>Sin asignar</SelectItem>
              {instructores.map((o) => <SelectItem key={o.id} value={o.id}>{o.nombre}{puede(o) ? "" : " · no autorizado"}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>
      </div>
      {instructores.length === 0 && (
        <p className="mt-2 text-xs text-muted-foreground">Aún no tienes instructores. <Link href="/cliente/instructores" className="font-medium text-orange-500 hover:underline">Agrega tu plantilla</Link>.</p>
      )}

      {c.congruente ? (
        <p className="mt-4 flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4" /> Todo coincide: curso registrado e instructor de tu plantilla.
          {c.curso?.registrado && <BadgeCheck className="h-4 w-4" />}
        </p>
      ) : (
        <ul className="mt-4 space-y-1.5 text-sm text-amber-900 dark:text-amber-200">
          {c.avisos.map((a) => (
            <li key={a.clave} className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <span>
                {a.texto}
                {a.clave === "curso_no_registrado" && <> <Link href="/cliente/catalogo" className="font-medium underline">Marcarlo en el catálogo</Link></>}
                {a.clave === "instructor_no_autorizado" && <> <Link href="/cliente/instructores" className="font-medium underline">Editar su plantilla</Link></>}
                {a.clave === "agente" && <> <Link href="/cliente/ajustes?tab=stps" className="font-medium underline">Ver mi registro</Link></>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
