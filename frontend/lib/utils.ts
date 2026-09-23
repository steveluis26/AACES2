import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Convierte "YYYY-MM-DD" a Date en hora local.
 * new Date("2026-10-05") se interpreta como UTC y en México se muestra el día anterior.
 */
export function parseFecha(v?: string | null): Date | null {
  if (!v) return null
  const s = String(v)
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + 'T00:00:00') : new Date(s)
  return isNaN(d.getTime()) ? null : d
}
