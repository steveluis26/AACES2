'use client'

import { LoginForm } from '@/components/login-form'

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background text-foreground pt-24 pb-12">
      <div className="max-w-md md:max-w-3xl mx-auto px-4">
        <LoginForm />
      </div>
    </div>
  )
}
