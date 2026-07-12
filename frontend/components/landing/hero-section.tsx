"use client"
import React from "react"
import { QrCode, SendHorizonal } from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
 

type Props = {
  value: string
  onChange: (v: string) => void
  onSubmit: (e: React.FormEvent) => void
  loading: boolean
  attemptsLeft: number
}

export default function HeroSection({ value, onChange, onSubmit, loading, attemptsLeft }: Props) {
  return (
    <>
      <section className="py-24 bg-gradient-to-b from-[var(--background)] to-[var(--card)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative mx-auto max-w-6xl pb-20 pt-10 lg:pt-24">
            <div className="relative z-10 mx-auto max-w-4xl text-center">
              <h1 className="text-balance text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-medium">Validación de <span className="text-orange-500">Certificados</span></h1>
              <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg">Verifique la autenticidad ingresando el código de validación.</p>
              <div className="mt-12">
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
              <div className="relative mx-auto mt-8 md:mt-24 max-w-lg">
                <div className="relative rounded-2xl border border-border/50 overflow-hidden shadow-xl bg-white">
                  <Image
                    src="/hero-preview.png"
                    alt="Panel de control AACES"
                    width={800}
                    height={640}
                    className="w-full h-auto"
                    priority
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
