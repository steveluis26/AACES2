"use client"
import { Shield, ArrowDown, UserCheck, Scan, BadgeCheck } from "lucide-react"

const steps = [
  { icon: Shield, label: "La agencia emite la constancia" },
  { icon: BadgeCheck, label: "AACES genera un identificador único" },
  { icon: UserCheck, label: "El participante recibe su certificado" },
  { icon: Scan, label: "La empresa escanea el QR" },
  { icon: BadgeCheck, label: "La autenticidad se verifica al instante" },
]

export default function TrustSection() {
  return (
    <section className="py-12 md:py-20 bg-muted/30">
      <div className="mx-auto max-w-6xl px-6 text-center">
        <h2 className="text-3xl font-semibold">Así funciona la confianza en AACES</h2>
        <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">Cada certificado conserva la trazabilidad completa desde su emisión hasta su validación.</p>
        <div className="mt-10 flex flex-col items-center gap-4 md:flex-row md:justify-center md:gap-2">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="flex flex-col items-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
                  <s.icon className="h-6 w-6" />
                </div>
                <p className="mt-2 text-xs font-medium max-w-24">{s.label}</p>
              </div>
              {i < steps.length - 1 && (
                <ArrowDown className="hidden md:block h-6 w-6 shrink-0 text-muted-foreground mx-2" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}