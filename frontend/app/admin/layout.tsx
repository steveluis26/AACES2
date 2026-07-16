'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppSidebar } from '@/components/app-sidebar'
import { SiteHeader } from '@/components/site-header'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    try {
      const token = localStorage.getItem('aaces_token')
      if (!token) {
        router.replace('/login')
        return
      }
      const parts = token.split('.')
      if (parts.length !== 3) {
        router.replace('/login')
        return
      }
      const payload = JSON.parse(atob(parts[1]))
      if (payload.role !== 'admin') {
        router.replace('/cliente/dashboard')
        return
      }
      setAuthorized(true)
    } catch {
      router.replace('/login')
    }
  }, [router])

  if (!authorized) {
    return null
  }

  return (
    <SidebarProvider
      defaultOpen={false}
      style={{
        '--sidebar-width': 'calc(var(--spacing) * 72)',
        '--header-height': 'calc(var(--spacing) * 12)',
      } as React.CSSProperties}
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
