"use client"
import { QrCode, SendHorizonal } from "lucide-react"
import { Button } from "@/components/ui/button"

type Props = {
  value: string
  onChange: (v: string) => void
  onSubmit: (e: React.FormEvent) => void
  loading: boolean
  attemptsLeft: number
}

export default function ValidatorSection({ value, onChange, onSubmit, loading, attemptsLeft }: Props) {
  return (
    <section className="py-12 md:py-20 bg-gradient-to-b from-background to-muted/20">
      <div className="mx-auto max-w-6xl px-6 text-center">
        <h2 className="text-2xl font-semibold">¿Ya tienes un código de validación?</h2>
        <p className="mt-2 text-muted-foreground">Ingresa el código de tu constancia para verificar su autenticidad.</p>
        <div className="mt-8">
          <form onSubmit={onSubmit} className="mx-auto max-w-sm">
            <div className="bg-background relative grid grid-cols-[1fr_auto] items-center rounded-[1.5rem] border pr-2 shadow-[0_8px_30px_rgba(0,0,0,0.08)] focus-within:ring-2 focus-within:ring-muted">
              <QrCode className="pointer-events-none absolute inset-y-0 left-4 my-auto h-4 w-4" />
              <input
                placeholder="Código de validación"
                className="h-12 w-full bg-transparent pl-12 focus:outline-none font-mono tracking-wider text-sm"
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                maxLength={20}
                disabled={loading || attemptsLeft <= 0}
              />
              <div className="md:pr-1.5 lg:pr-0">
                <Button aria-label="submit" size="sm" className="rounded-[1.5rem] bg-black text-white dark:bg-white dark:text-black" disabled={loading || attemptsLeft <= 0}>
                  <span className="hidden md:block">Validar</span>
                  <SendHorizonal className="relative mx-auto h-5 w-5 md:hidden" strokeWidth={2} />
                </Button>
              </div>
            </div>
          </form>
          {attemptsLeft <= 3 && attemptsLeft > 0 && (
            <p className="text-sm opacity-80 mt-2">Intentos restantes: {attemptsLeft}</p>
          )}
          {attemptsLeft <= 0 && (
            <p className="text-sm mt-2 text-[var(--destructive)]">Has excedido el número de intentos. Por favor, intenta más tarde.</p>
          )}
        </div>
      </div>
    </section>
  )
}