"use client"

import { useEffect, useState } from "react"
import { animate, useReducedMotion } from "motion/react"

/** Número que sube desde 0 hasta su valor al aparecer. */
export function CountUp({ value, suffix = "", decimals = 0 }: { value: number; suffix?: string; decimals?: number }) {
  const reduce = useReducedMotion()
  const [n, setN] = useState(reduce ? value : 0)
  useEffect(() => {
    if (reduce) { setN(value); return }
    const c = animate(0, value, { duration: 1, ease: [0.22, 1, 0.36, 1], onUpdate: setN })
    return () => c.stop()
  }, [value, reduce])
  return <>{n.toLocaleString("es-MX", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</>
}
