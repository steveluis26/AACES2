"use client"
import React from "react"
import { Mail, SendHorizonal } from "lucide-react"
import { Button } from "@/components/ui/button"
 

type Props = {
  value: string
  onChange: (v: string) => void
  onSubmit: (e: React.FormEvent) => void
  loading: boolean
  attemptsLeft: number
}

const AppComponent = () => {
  return (
    <div className="relative space-y-3 rounded-[1rem] bg-white/5 p-4">
      <div className="flex items-center gap-1.5 text-orange-400">
        <svg
          className="size-5"
          xmlns="http://www.w3.org/2000/svg"
          width="1em"
          height="1em"
          viewBox="0 0 32 32"
        >
          <g fill="none">
            <path
              fill="#ff6723"
              d="M26 19.34c0 6.1-5.05 11.005-11.15 10.641c-6.269-.374-10.56-6.403-9.752-12.705c.489-3.833 2.286-7.12 4.242-9.67c.34-.445.689 3.136 1.038 2.742c.35-.405 3.594-6.019 4.722-7.991a.694.694 0 0 1 1.028-.213C18.394 3.854 26 10.277 26 19.34"
            ></path>
            <path
              fill="#ffb02e"
              d="M23 21.851c0 4.042-3.519 7.291-7.799 7.144c-4.62-.156-7.788-4.384-7.11-8.739C9.07 14.012 15.48 10 15.48 10S23 14.707 23 21.851"
            ></path>
          </g>
        </svg>
        <div className="text-sm font-medium">Steps</div>
      </div>
      <div className="space-y-3">
        <div className="text-foreground border-b border-white/10 pb-3 text-sm font-medium">
          This year, you&apos;re walking more on average than you did in 2023.
        </div>
        <div className="space-y-3">
          <div className="space-y-1">
            <div className="space-x-1">
              <span className="text-foreground align-baseline text-xl font-medium">8,081</span>
              <span className="text-muted-foreground text-xs">Steps/day</span>
            </div>
            <div className="flex h-5 items-center rounded bg-gradient-to-l from-emerald-400 to-indigo-600 px-2 text-xs text-white">2024</div>
          </div>
          <div className="space-y-1">
            <div className="space-x-1">
              <span className="text-foreground align-baseline text-xl font-medium">5,412</span>
              <span className="text-muted-foreground text-xs">Steps/day</span>
            </div>
            <div className="text-foreground bg-muted flex h-5 w-2/3 items-center rounded px-2 text-xs dark:bg-white/20">2023</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function HeroSection({ value, onChange, onSubmit, loading, attemptsLeft }: Props) {
  return (
    <>
      <section className="py-24 bg-gradient-to-b from-[var(--background)] to-[var(--card)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative mx-auto max-w-6xl pb-20 pt-10 lg:pt-24">
            <div className="relative z-10 mx-auto max-w-4xl text-center">
              <h1 className="text-balance text-5xl font-medium md:text-6xl">Validación de <span className="text-orange-500">Certificados</span></h1>
              <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg">Verifique la autenticidad ingresando el código de validación.</p>
              <div className="mt-12">
                <form onSubmit={onSubmit} className="mx-auto max-w-sm">
                  <div className="bg-background relative grid grid-cols-[1fr_auto] items-center rounded-[1.5rem] border pr-2 shadow-[0_8px_30px_rgba(0,0,0,0.08)] focus-within:ring-2 focus-within:ring-muted">
                    <Mail className="pointer-events-none absolute inset-y-0 left-4 my-auto h-4 w-4" />
                    <input
                      placeholder="Ingrese código de validación o ID CERT-XXXXXX"
                      className="h-12 w-full bg-transparent pl-12 focus:outline-none font-mono tracking-wider"
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
              <div className="relative mx-auto mt-24 max-w-2xl text-left h-[28rem]">
                <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] mix-blend-overlay [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)] dark:opacity-5" />
                <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-8 w-80 rounded-[2rem] border border-border/50 p-2">
                  <div className="relative h-96 overflow-hidden rounded-[1.5rem] border p-2 pb-12 before:absolute before:inset-0 before:bg-[repeating-linear-gradient(-45deg,var(--color-border),var(--color-border)_1px,transparent_1px,transparent_6px)] before:opacity-50" />
                </div>
                <div className="absolute left-1/2 top-6 -translate-x-1/2 w-80 rounded-[2rem] border border-border/50 p-2 backdrop-blur-3xl">
                  <div className="space-y-2 overflow-hidden rounded-[1.5rem] border p-2 shadow-xl bg-background/80 dark:bg-white/5 dark:shadow-black dark:backdrop-blur-3xl">
                    <AppComponent />
                    <div className="rounded-[1rem] p-4 pb-16 bg-muted/40 dark:bg-white/5" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
