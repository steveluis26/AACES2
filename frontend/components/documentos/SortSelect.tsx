"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ConstanciaSortField, OrderDirection } from "@/viewmodels/document"

interface SortSelectProps {
  sort: ConstanciaSortField
  order: OrderDirection
  onChangeSort: (v: ConstanciaSortField) => void
  onChangeOrder: (v: OrderDirection) => void
}

const SORT_OPTIONS: { value: ConstanciaSortField; label: string }[] = [
  { value: "fecha_emision", label: "Fecha" },
  { value: "participante", label: "Participante" },
  { value: "curso", label: "Curso" },
  { value: "estado", label: "Estado" },
]

export function SortSelect({
  sort,
  order,
  onChangeSort,
  onChangeOrder,
}: SortSelectProps) {
  return (
    <div className="flex items-center gap-2">
      <Select
        value={sort}
        onValueChange={(v) => onChangeSort(v as ConstanciaSortField)}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={order}
        onValueChange={(v) => onChangeOrder(v as OrderDirection)}
      >
        <SelectTrigger className="w-[110px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="desc">Más reciente</SelectItem>
          <SelectItem value="asc">Más antiguo</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
