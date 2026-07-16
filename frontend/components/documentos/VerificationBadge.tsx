import { VerificationResult } from "@/viewmodels/document"
import { cn } from "@/lib/utils"

interface VerificationBadgeProps {
  resultado: VerificationResult
  size?: "sm" | "md"
}

const VARIANTS: Record<VerificationResult, { label: string; class: string }> = {
  VALIDA: {
    label: "Válida",
    class: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  },
  REVOCADA: {
    label: "Revocada",
    class: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  },
  EXPIRADA: {
    label: "Expirada",
    class: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  },
  NO_EXISTE: {
    label: "No existe",
    class: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400",
  },
}

const SIZE_MAP = {
  sm: "px-1.5 py-0.5 text-[10px]",
  md: "px-2 py-0.5 text-xs",
}

export function VerificationBadge({
  resultado,
  size = "md",
}: VerificationBadgeProps) {
  const v = VARIANTS[resultado]
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
