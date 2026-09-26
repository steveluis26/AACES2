"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { CheckCircle2, PenLine } from "lucide-react"
import { Input } from "@/components/ui/input"
import { apiRequest } from "@/app/services/api"
import { SubirFirma } from "@/components/firmas/subir-firma"

type Firma = { nombre: string | null; tiene_firma: boolean }
type Firmas = { patron: Firma; trabajadores: Firma; instructor: Firma | null }

const TIPOS = [
  { tipo: "patron" as const, titulo: "Patrón o representante legal" },
  { tipo: "trabajadores" as const, titulo: "Representante de los trabajadores" },
]

/** Firmas del DC-3 de la empresa cliente para este grupo (la del instructor vive en su ficha). */
export function FirmasGrupo({ cursoId }: { cursoId: string }) {
  const [f, setF] = useState<Firmas | null>(null)
  const [nombres, setNombres] = useState({ patron: "", trabajadores: "" })

  const cargar = useCallback(async () => {
    const r = await apiRequest<Firmas>(`/clientes/cursos/${cursoId}/firmas`).catch(() => null)
    setF(r)
    if (r) setNombres({ patron: r.patron.nombre || "", trabajadores: r.trabajadores.nombre || "" })
  }, [cursoId])
  useEffect(() => { cargar() }, [cargar])

  const guardarNombre = async (tipo: "patron" | "trabajadores") => {
    if (!f || (f[tipo].nombre || "") === nombres[tipo].trim()) return
    const fd = new FormData()
    fd.append("nombre", nombres[tipo])
    const token = localStorage.getItem("aaces_token") || ""
    const r = await fetch(`/api/v1/clientes/cursos/${cursoId}/firmas/${tipo}`, { method: "PUT", body: fd, headers: { Authorization: `Bearer ${token}` } })
    if (r.ok) { setF(await r.json()); toast.success("Nombre guardado") }
    else toast.error("No se pudo guardar el nombre")
  }

  if (!f) return null
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm" aria-labelledby="fg-titulo">
      <h3 id="fg-titulo" className="flex items-center gap-2 font-semibold"><PenLine className="h-4 w-4 text-orange-500" /> Firmas del DC-3</h3>
      <p className="mt-0.5 text-sm text-muted-foreground">De la empresa que contrató este grupo. Si las dejas vacías, se firman a mano después de imprimir.</p>

      <p className="mt-4 flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
        {f.instructor?.tiene_firma
          ? <><CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" /> Instructor: {f.instructor.nombre} — su firma se imprime automáticamente.</>
          : f.instructor
            ? <>Instructor: {f.instructor.nombre} — sin firma. <Link href="/cliente/instructores" className="font-medium text-orange-500 hover:underline">Subirla en Instructores</Link></>
            : <>Asigna un instructor en “DC-3 congruente” para imprimir su nombre y firma.</>}
      </p>

      <div className="mt-4 grid gap-6 md:grid-cols-2">
        {TIPOS.map(({ tipo, titulo }) => (
          <div key={tipo} className="grid content-start gap-3 rounded-xl border p-4">
            <p className="text-sm font-semibold">{titulo}</p>
            <label className="grid gap-1.5 text-sm font-medium">
              Nombre
              <Input value={nombres[tipo]} placeholder="Como aparecerá en el DC-3" onChange={(e) => setNombres((n) => ({ ...n, [tipo]: e.target.value }))} onBlur={() => guardarNombre(tipo)} />
            </label>
            <SubirFirma
              etiqueta="Firma"
              urlImagen={`/api/v1/clientes/cursos/${cursoId}/firmas/${tipo}/imagen`}
              urlSubir={`/api/v1/clientes/cursos/${cursoId}/firmas/${tipo}`}
              urlQuitar={`/api/v1/clientes/cursos/${cursoId}/firmas/${tipo}`}
              tieneFirma={f[tipo].tiene_firma}
              onCambio={cargar}
            />
          </div>
        ))}
      </div>
    </section>
  )
}
