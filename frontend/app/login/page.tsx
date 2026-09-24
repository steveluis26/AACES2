'use client'

import { LoginForm } from '@/components/login-form'

export default function LoginPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background pb-12 pt-24 text-foreground">
      {/* Mismo fondo que el inicio de la landing */}
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-20 h-[420px] w-[760px] -translate-x-1/2 rounded-full bg-orange-500/10 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.06)_1px,transparent_0)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_35%,black,transparent)] dark:bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.06)_1px,transparent_0)]" />
      <div className="relative mx-auto max-w-md px-4 md:max-w-4xl">
        <LoginForm />
      </div>
    </div>
  )
}
