"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DocumentStatus } from "@/viewmodels/document"

interface FilterBarProps {
  estado: string
  onChangeEstado: (v: string) => void
  verificada: string
  onChangeVerificada: (v: string) => void
  fechaDesde: string
  onChangeFechaDesde: (v: string) => void
  fechaHasta: string
  onChangeFechaHasta: (v: string) => void
}

const STATUSES: { value: string; label: string }[] = [
  { value: "", label: "Todos los estados" },
  { value: "emitido", label: "Emitido" },
  { value: "cancelado", label: "Cancelado" },
  { value: "reemitido", label: "Reemitido" },
]

const VERIFIED_OPTS: { value: string; label: string }[] = [
  { value: "", label: "Todas" },
  { value: "true", label: "Verificadas" },
  { value: "false", label: "No verificadas" },
]

export function FilterBar({
  estado,
  onChangeEstado,
  verificada,
  onChangeVerificada,
  fechaDesde,
  onChangeFechaDesde,
  fechaHasta,
  onChangeFechaHasta,
}: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={estado} onValueChange={onChangeEstado}>
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          {STATUSES.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={verificada} onValueChange={onChangeVerificada}>
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Verificación" />
        </SelectTrigger>
        <SelectContent>
          {VERIFIED_OPTS.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <input
        type="date"
        value={fechaDesde}
        onChange={(e) => onChangeFechaDesde(e.target.value)}
        className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
        placeholder="Desde"
      />
      <input
        type="date"
        value={fechaHasta}
        onChange={(e) => onChangeFechaHasta(e.target.value)}
        className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
        placeholder="Hasta"
      />
    </div>
  )
}
