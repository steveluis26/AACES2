"use client"

import { useEffect, useState } from "react"
import { ModeToggle } from "@/components/mode-toggle"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import Image from "next/image"

export function SiteHeader() {
  const [role, setRole] = useState<string | undefined>(undefined)
  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("aaces_user") : null
      if (!raw) return
      const u = JSON.parse(raw)
      setRole((u.rol || u.role) as string | undefined)
    } catch {}
  }, [])
  const href = role === "admin" ? "/admin/dashboard" : "/cliente/dashboard"
  return (
    <header className="group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <a href={href} aria-label="Ir al dashboard">
          <Image src="/logo.png" alt="AACES" width={28} height={28} className="h-7 w-auto" />
        </a>
        <div className="ml-auto flex items-center gap-2">
          <ModeToggle />
        </div>
      </div>
    </header>
  )
}
