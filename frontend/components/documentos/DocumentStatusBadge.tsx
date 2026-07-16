import { DocumentStatus } from "@/viewmodels/document"
import { cn } from "@/lib/utils"

interface DocumentStatusBadgeProps {
  estado: DocumentStatus
  size?: "sm" | "md" | "lg"
}

const VARIANTS: Record<DocumentStatus, { label: string; class: string }> = {
  emitido: {
    label: "Emitido",
    class: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  },
  cancelado: {
    label: "Cancelado",
    class: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  },
  reemitido: {
    label: "Reemitido",
    class: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  },
}

const SIZE_MAP = {
  sm: "px-1.5 py-0.5 text-[10px]",
  md: "px-2 py-0.5 text-xs",
  lg: "px-2.5 py-1 text-sm",
}

export function DocumentStatusBadge({
  estado,
  size = "md",
}: DocumentStatusBadgeProps) {
  const v = VARIANTS[estado] ?? {
    label: estado,
    class: "bg-gray-100 text-gray-800",
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium",
        SIZE_MAP[size],
        v.class
      )}
    >
      {v.label}
    </span>
  )
}
