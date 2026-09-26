"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { AlertCircle, BadgeCheck, Check, CheckCircle2, FileDown, Info, Loader2, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { apiRequest } from "@/app/services/api"
import type { Cupo } from "@/lib/cupo"
import { avisosDeError, type Aviso } from "@/lib/congruencia"
import { AvisosCongruencia } from "@/components/congruencia/avisos-congruencia"

export type ParticipanteGrupo = {
  id: string
  nombre: string
  apellido?: string | null
  apellido_paterno?: string | null
  apellido_materno?: string | null
  estado_pago?: string
  codigo_validacion?: string | null
  estado_acreditacion?: boolean
}

const nombreDe = (p: ParticipanteGrupo) =>
  [p.nombre, [p.apellido_paterno, p.apellido_materno].filter(Boolean).join(" ") || p.apellido].filter(Boolean).join(" ")

const PAGO: Record<string, { t: string; c: string }> = {
  pagado: { t: "Pagado", c: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400" },
  anticipo: { t: "Anticipo", c: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" },
  pendiente: { t: "Sin pago", c: "bg-muted text-muted-foreground" },
  cancelado: { t: "Cancelado", c: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400" },
}

/** El cliente marca quiénes sí tomaron el curso: solo ellos reciben folio y QR. */
export function AcreditarGrupo({ abierto, onCerrar, cursoId, cursoNombre, participantes, onListo }: {
  abierto: boolean
  onCerrar: () => void
  cursoId: string
  cursoNombre: string
  participantes: ParticipanteGrupo[]
  onListo: () => void
}) {
  const reduce = useReducedMotion()
  const [marcados, setMarcados] = useState<Set<string>>(new Set())
  const [cupo, setCupo] = useState<Cupo | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [listo, setListo] = useState<number | null>(null)
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const [confirmado, setConfirmado] = useState(false)

  const pendientes = useMemo(() => participantes.filter((p) => !p.codigo_validacion), [participantes])
  const conFolio = participantes.length - pendientes.length
  // Primero quienes faltan por acreditar, que es lo que hay que revisar
  const ordenados = useMemo(() => [...pendientes, ...participantes.filter((p) => p.codigo_validacion)], [participantes, pendientes])

  useEffect(() => {
    if (!abierto) return
    setMarcados(new Set())
    setListo(null)
    setAvisos([])
    setConfirmado(false)
    apiRequest<Cupo>("/cupo").then(setCupo).catch(() => setCupo(null))
  }, [abierto])

  const toggle = (id: string) => setMarcados((s) => {
    const n = new Set(s)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    return n
  })
  const todos = pendientes.length > 0 && marcados.size === pendientes.length
  const disponibles = cupo ? cupo.disponibles : null
  const sinCupo = !!cupo && (!cupo.activa || (disponibles !== null && marcados.size > disponibles))

  const acreditar = async () => {
    setEnviando(true)
    try {
      const r = await apiRequest<{ acreditados: number; folios_nuevos: number }>(`/clientes/cursos/${cursoId}/acreditar`, {
        method: "POST",
        body: JSON.stringify({ curso_participante_ids: Array.from(marcados), confirmar_avisos: confirmado }),
      })
      setListo(r.folios_nuevos)
      toast.success(`${r.folios_nuevos} ${r.folios_nuevos === 1 ? "participante acreditado" : "participantes acreditados"}`, { description: "Ya tienen folio y QR verificable." })
      onListo()
    } catch (e) {
      const av = avisosDeError(e)
      if (av) { setAvisos(av); setConfirmado(false) } // se muestran abajo para confirmar
      else toast.error((e as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Sheet open={abierto} onOpenChange={(o) => { if (!o) onCerrar() }}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b px-6 py-5 text-left">
          <SheetTitle>Acreditar y generar folios</SheetTitle>
          <SheetDescription>{cursoNombre}. Marca a quienes sí tomaron el curso: solo ellos reciben folio y QR, y solo ellos cuentan para tu plan.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
          <AnimatePresence mode="wait">
            {listo !== null ? (
              <motion.div key="ok" initial={reduce ? false : { opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center py-10 text-center">
                <motion.span initial={reduce ? false : { scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 15 }} className="flex h-16 w-16 items-center justify-center rounded-full bg-green-600 text-white shadow-lg shadow-green-600/30">
                  <CheckCircle2 className="h-8 w-8" />
                </motion.span>
                <h3 className="mt-5 text-lg font-semibold">¡Listo! {listo} {listo === 1 ? "folio generado" : "folios generados"}</h3>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">Sus QR ya se pueden verificar. Ahora genera sus DC-3 con tu formato para imprimirlos.</p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  <Button variant="outline" onClick={onCerrar}>Cerrar</Button>
                  <Button asChild><Link href="/cliente/templates"><FileDown className="h-4 w-4" /> Generar DC-3</Link></Button>
                </div>
              </motion.div>
            ) : (
              <motion.div key="form" initial={false} className="space-y-4">
                <p className="flex items-start gap-2 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  Inscribir o registrar un anticipo no gasta constancias. Si alguien no se presentó, simplemente no lo marques.
                </p>

                {participantes.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-8 text-center">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Este curso aún no tiene participantes.</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">
                        {pendientes.length} {pendientes.length === 1 ? "pendiente" : "pendientes"}
                        {conFolio > 0 && <span className="font-normal text-muted-foreground"> · {conFolio} ya con folio</span>}
                      </p>
                      {pendientes.length > 0 && (
                        <button type="button" onClick={() => setMarcados(todos ? new Set() : new Set(pendientes.map((p) => p.id)))} className="text-xs font-medium text-orange-500 hover:underline">
                          {todos ? "Quitar todos" : "Marcar todos"}
                        </button>
                      )}
                    </div>

                    <AvisosCongruencia avisos={avisos} confirmado={confirmado} onConfirmar={setConfirmado} />

                    {sinCupo && (
                      <div role="alert" className="rounded-xl border border-red-500/30 bg-red-50 p-3 text-sm text-red-800 dark:bg-red-500/10 dark:text-red-300">
                        <p className="flex items-start gap-2 font-medium">
                          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                          {!cupo?.activa
                            ? "Tu suscripción no está activa, no puedes generar folios nuevos."
                            : `Marcaste ${marcados.size} y ${!disponibles ? "ya no te quedan constancias disponibles" : `te ${disponibles === 1 ? "queda" : "quedan"} ${disponibles}`}.`}
                        </p>
                        <p className="mt-1 pl-6 text-xs">
                          {cupo?.activa && "Marca menos participantes, "}compra un paquete extra o <Link href="/cliente/pagos" className="font-semibold underline">mejora tu plan</Link>.
                        </p>
                      </div>
                    )}

                    <ul className="space-y-1.5">
                      {ordenados.map((p) => {
                        const tiene = !!p.codigo_validacion
                        const on = tiene || marcados.has(p.id)
                        const pago = PAGO[String(p.estado_pago || "").toLowerCase()]
                        return (
                          <li key={p.id}>
                            <button type="button" disabled={tiene} role="checkbox" aria-checked={on} onClick={() => toggle(p.id)}
                              className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all disabled:cursor-default ${tiene ? "bg-muted/40" : on ? "border-orange-500/50 bg-orange-50/70 dark:bg-orange-500/5" : "hover:bg-muted/50"}`}>
                              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${tiene ? "border-green-600 bg-green-600 text-white" : on ? "border-orange-500 bg-orange-500 text-white" : "border-input"}`}>
                                {on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                              </span>
                              <span className={`min-w-0 flex-1 truncate text-sm font-medium ${tiene ? "text-muted-foreground" : ""}`}>{nombreDe(p)}</span>
                              {tiene ? (
                                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700 dark:bg-green-500/15 dark:text-green-400"><BadgeCheck className="h-3 w-3" /> Con folio</span>
                              ) : pago ? (
                                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${pago.c}`}>{pago.t}</span>
                              ) : null}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {listo === null && (
          <SheetFooter className="flex-row items-center gap-2 border-t bg-background px-6 py-4 sm:justify-between">
            <span className="hidden text-sm text-muted-foreground sm:block">
              {marcados.size} {marcados.size === 1 ? "marcado" : "marcados"}
              {cupo && disponibles !== null && cupo.activa && <span className="block text-xs">Te {disponibles === 1 ? "queda" : "quedan"} {disponibles} en tu plan</span>}
            </span>
            <Button onClick={acreditar} disabled={marcados.size === 0 || enviando || sinCupo || (avisos.length > 0 && !confirmado)} className="flex-1 sm:flex-none">
              {enviando ? <><Loader2 className="h-4 w-4 animate-spin" /> Acreditando…</> : <><BadgeCheck className="h-4 w-4" /> Acreditar {marcados.size || ""} y generar folios</>}
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  )
}
