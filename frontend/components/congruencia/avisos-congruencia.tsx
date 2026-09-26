"use client"

import { AlertTriangle } from "lucide-react"
import type { Aviso } from "@/lib/congruencia"

/** Avisos de congruencia antes de dar folios. No bloquea: pide confirmar y queda registrado. */
export function AvisosCongruencia({ avisos, confirmado, onConfirmar }: {
  avisos: Aviso[]
  confirmado: boolean
  onConfirmar: (v: boolean) => void
}) {
  if (!avisos.length) return null
  return (
    <div role="alert" className="rounded-xl border border-amber-500/40 bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
      <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" /> Revisa antes de generar folios</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {avisos.map((a) => <li key={a.clave}>{a.texto}</li>)}
      </ul>
      <p className="mt-2 text-xs opacity-90">El DC-3 debe llevar al agente capacitador y al instructor que realmente impartió el curso. Corrígelo en el grupo o, si es un caso legítimo, continúa: quedará registrado quién lo decidió.</p>
      <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm font-medium">
        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-orange-500" checked={confirmado} onChange={(e) => onConfirmar(e.target.checked)} />
        Entiendo y quiero continuar
      </label>
    </div>
  )
}
