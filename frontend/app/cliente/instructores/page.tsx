"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { BadgeCheck, Check, GraduationCap, Info, Loader2, Pencil, Plus, Trash2, UserRoundX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field } from "@/components/ui/field"
import { FormStep } from "@/components/forms/form-bits"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { apiRequest } from "@/app/services/api"
import { SubirFirma } from "@/components/firmas/subir-firma"

type CursoCat = { id: string; nombre: string; stps_registrado: boolean }
type Instructor = { id: string; nombre: string; curp: string | null; correo: string | null; activo: boolean; tiene_firma?: boolean; cursos: CursoCat[]; grupos: number }
type Form = { id?: string; nombre: string; curp: string; correo: string; activo: boolean; cursos: Set<string> }

const vacio = (): Form => ({ nombre: "", curp: "", correo: "", activo: true, cursos: new Set() })

export default function InstructoresPage() {
  const reduce = useReducedMotion()
  const [lista, setLista] = useState<Instructor[] | null>(null)
  const [catalogo, setCatalogo] = useState<CursoCat[]>([])
  const [form, setForm] = useState<Form | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")

  const cargar = useCallback(async () => {
    const [ins, cat] = await Promise.all([
      apiRequest<Instructor[]>("/instructores").catch(() => []),
      apiRequest<CursoCat[]>("/catalogo/cursos").catch(() => []),
    ])
    setLista(ins)
    setCatalogo(cat)
  }, [])
  useEffect(() => { cargar() }, [cargar])

  const abrir = (i?: Instructor) => {
    setError("")
    setForm(i ? { id: i.id, nombre: i.nombre, curp: i.curp || "", correo: i.correo || "", activo: i.activo, cursos: new Set(i.cursos.map((c) => c.id)) } : vacio())
  }

  const guardar = async () => {
    if (!form) return
    if (form.nombre.trim().length < 2) { setError("Escribe el nombre completo"); return }
    if (form.curp && form.curp.length !== 18) { setError("La CURP debe tener 18 caracteres"); return }
    setGuardando(true)
    try {
      const body = JSON.stringify({ nombre: form.nombre, curp: form.curp || null, correo: form.correo || null, activo: form.activo, cursos: Array.from(form.cursos) })
      await apiRequest(form.id ? `/instructores/${form.id}` : "/instructores", { method: form.id ? "PUT" : "POST", body })
      toast.success(form.id ? "Instructor actualizado" : "Instructor agregado a tu plantilla")
      setForm(null)
      await cargar()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async (i: Instructor) => {
    if (!confirm(i.grupos ? `${i.nombre} ya impartió grupos: se dará de baja, no se borrará. ¿Continuar?` : `¿Quitar a ${i.nombre} de tu plantilla?`)) return
    try {
      await apiRequest(`/instructores/${i.id}`, { method: "DELETE" })
      toast.success(i.grupos ? "Instructor dado de baja" : "Instructor eliminado")
      await cargar()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const toggleCurso = (id: string) => setForm((f) => {
    if (!f) return f
    const n = new Set(f.cursos)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    return { ...f, cursos: n }
  })

  const registrados = useMemo(() => catalogo.filter((c) => c.stps_registrado).length, [catalogo])

  return (
    <div className="space-y-6 px-4 py-4 lg:px-6 lg:py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Instructores</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {lista === null ? "Cargando…" : `${lista.filter((i) => i.activo).length} en tu plantilla`}
          </p>
        </div>
        <Button onClick={() => abrir()} className="transition-transform active:scale-[0.98]"><Plus className="h-4 w-4" /> Agregar instructor</Button>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border bg-card p-4 text-sm shadow-sm">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-orange-500" />
        <p className="text-muted-foreground">
          Registra aquí a los instructores que tienes <strong className="text-foreground">dados de alta ante la STPS</strong> y los cursos que cada uno puede impartir.
          Así el DC-3 lleva el nombre de quien realmente impartió el curso, y AACES te avisa si algo no coincide antes de generar folios.
          {catalogo.length > 0 && registrados === 0 && (
            <> Marca también en tu <Link href="/cliente/catalogo" className="font-medium text-orange-500 hover:underline">catálogo</Link> qué cursos tienes registrados.</>
          )}
        </p>
      </div>

      {lista === null ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-40 animate-pulse rounded-2xl border bg-muted/40" />)}</div>
      ) : lista.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card px-6 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500"><GraduationCap className="h-6 w-6" /></span>
          <p className="font-medium">Aún no tienes instructores</p>
          <p className="max-w-md text-sm text-muted-foreground">Agrega tu plantilla tal como está registrada ante la STPS.</p>
          <Button onClick={() => abrir()}><Plus className="h-4 w-4" /> Agregar el primero</Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence>
            {lista.map((i, n) => (
              <motion.article
                key={i.id}
                layout={!reduce}
                initial={reduce ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(n, 9) * 0.04 }}
                className={`flex flex-col rounded-2xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md ${i.activo ? "" : "opacity-60"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold">{i.nombre}</h2>
                    <p className="font-mono text-xs text-muted-foreground">{i.curp || "Sin CURP"}</p>
                  </div>
                  {!i.activo && <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium"><UserRoundX className="h-3 w-3" /> De baja</span>}
                </div>
                <div className="mt-3 flex-1">
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">Puede impartir</p>
                  {i.cursos.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {i.cursos.map((c) => (
                        <span key={c.id} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${c.stps_registrado ? "bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-400" : "bg-muted text-muted-foreground"}`} title={c.stps_registrado ? "Registrado ante la STPS" : "No marcado como registrado"}>
                          {c.stps_registrado && <BadgeCheck className="h-3 w-3" />}{c.nombre}
                        </span>
                      ))}
                    </div>
                  ) : <p className="text-xs text-amber-700 dark:text-amber-400">Sin cursos asignados</p>}
                </div>
                <div className="mt-4 flex items-center justify-between border-t pt-3">
                  <span className="text-xs text-muted-foreground">
                    {i.grupos} {i.grupos === 1 ? "grupo" : "grupos"} · {i.tiene_firma ? <span className="text-green-700 dark:text-green-400">con firma</span> : "sin firma"}
                  </span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => abrir(i)}><Pencil className="h-4 w-4" /> Editar</Button>
                    <Button size="icon" variant="ghost" className="h-9 w-9 text-muted-foreground hover:bg-red-50 hover:text-red-600" onClick={() => eliminar(i)} aria-label={`Quitar a ${i.nombre}`}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </motion.article>
            ))}
          </AnimatePresence>
        </div>
      )}

      <Sheet open={!!form} onOpenChange={(o) => { if (!o) setForm(null) }}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
          {form && (
            <form noValidate className="flex h-full flex-col" onSubmit={(e) => { e.preventDefault(); if (!guardando) guardar() }}>
              <SheetHeader className="border-b px-6 py-5 text-left">
                <SheetTitle>{form.id ? "Editar instructor" : "Agregar instructor"}</SheetTitle>
                <SheetDescription>Como aparece en tu plantilla de instructores ante la STPS.</SheetDescription>
              </SheetHeader>
              <div className="flex-1 space-y-8 overflow-y-auto px-6 py-6">
                <FormStep n={1} title="Datos del instructor">
                  <div className="grid gap-4">
                    <Field label="Nombre completo" htmlFor="i_nombre" required error={error && form.nombre.trim().length < 2 ? error : undefined}>
                      <Input id="i_nombre" autoFocus value={form.nombre} onChange={(e) => { setForm({ ...form, nombre: e.target.value }); setError("") }} placeholder="Tal como está en la STPS" />
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="CURP" htmlFor="i_curp" hint={form.curp ? `${form.curp.length}/18` : "Opcional"}>
                        <Input id="i_curp" maxLength={18} spellCheck={false} className="font-mono uppercase tracking-wider" value={form.curp} onChange={(e) => { setForm({ ...form, curp: e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase() }); setError("") }} />
                      </Field>
                      <Field label="Correo" htmlFor="i_correo" hint="Opcional">
                        <Input id="i_correo" type="email" value={form.correo} onChange={(e) => setForm({ ...form, correo: e.target.value })} />
                      </Field>
                    </div>
                  </div>
                </FormStep>

                <FormStep n={2} title="Cursos que puede impartir" desc="Los que tiene autorizados en tu registro ante la STPS.">
                  {catalogo.length === 0 ? (
                    <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Primero agrega cursos a tu <Link href="/cliente/catalogo" className="font-medium text-orange-500 hover:underline">catálogo</Link>.</p>
                  ) : (
                    <ul className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
                      {catalogo.map((c) => {
                        const on = form.cursos.has(c.id)
                        return (
                          <li key={c.id}>
                            <button type="button" role="checkbox" aria-checked={on} onClick={() => toggleCurso(c.id)}
                              className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all ${on ? "border-orange-500/50 bg-orange-50/70 dark:bg-orange-500/5" : "hover:bg-muted/50"}`}>
                              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${on ? "border-orange-500 bg-orange-500 text-white" : "border-input"}`}>{on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}</span>
                              <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.nombre}</span>
                              {c.stps_registrado
                                ? <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700 dark:bg-green-500/15 dark:text-green-400"><BadgeCheck className="h-3 w-3" /> Registrado STPS</span>
                                : <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">Sin marcar</span>}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </FormStep>

                {form.id && (
                  <FormStep n={3} title="Firma" desc="Se imprime en el DC-3 en “Instructor o tutor”.">
                    <SubirFirma
                      etiqueta="Firma del instructor"
                      urlImagen={`/api/v1/instructores/${form.id}/firma`}
                      urlSubir={`/api/v1/instructores/${form.id}/firma`}
                      urlQuitar={`/api/v1/instructores/${form.id}/firma`}
                      tieneFirma={!!lista?.find((x) => x.id === form.id)?.tiene_firma}
                      onCambio={cargar}
                    />
                  </FormStep>
                )}
                {form.id && (
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input type="checkbox" className="h-4 w-4 accent-orange-500" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} />
                    Activo en mi plantilla
                  </label>
                )}
                {error && form.nombre.trim().length >= 2 && <p role="alert" className="text-sm text-red-600">{error}</p>}
              </div>
              <SheetFooter className="flex-row gap-2 border-t px-6 py-4 sm:justify-end">
                <Button type="button" variant="outline" className="flex-1 sm:flex-none" onClick={() => setForm(null)}>Cancelar</Button>
                <Button type="submit" className="flex-1 sm:flex-none" disabled={guardando}>
                  {guardando ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando…</> : "Guardar"}
                </Button>
              </SheetFooter>
            </form>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
