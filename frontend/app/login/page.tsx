'use client'

import { LoginForm } from '@/components/login-form'

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] py-12">
      <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8">
        <LoginForm />
      </div>
    </div>
  )
}

