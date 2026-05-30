"use client"

import * as React from "react"
import { LucideIcon } from "lucide-react"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { authService } from "@/lib/auth"

export function NavSecondary({
  items,
  ...props
}: {
  items: {
    title: string
    url: string
    icon: LucideIcon
  }[]
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  const [openSettings, setOpenSettings] = React.useState(false)
  const [openHelp, setOpenHelp] = React.useState(false)
  const [subject, setSubject] = React.useState("")
  const [message, setMessage] = React.useState("")
  const onLogout = async () => {
    await authService.logout()
    if (typeof window !== "undefined") {
      window.location.href = "/login"
    }
  }
  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              {item.title.toLowerCase() === "ajustes" ? (
                <SidebarMenuButton onClick={() => setOpenSettings(true)}>
                  <item.icon />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              ) : item.title.toLowerCase() === "ayuda" ? (
                <SidebarMenuButton onClick={() => setOpenHelp(true)}>
                  <item.icon />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              ) : (
                <SidebarMenuButton asChild>
                  <a href={item.url}>
                    <item.icon />
                    <span>{item.title}</span>
                  </a>
                </SidebarMenuButton>
              )}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
      <Dialog open={openSettings} onClose={() => setOpenSettings(false)}>
        <DialogHeader>
          <DialogTitle>Ajustes</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Seleccione una acción</div>
          </div>
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpenSettings(false)}>Cerrar</Button>
          <Button onClick={onLogout}>Cerrar sesión</Button>
        </DialogFooter>
      </Dialog>
      <Dialog open={openHelp} onClose={() => setOpenHelp(false)}>
        <DialogHeader>
          <DialogTitle>Contacto</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <div className="space-y-3">
            <Input placeholder="Asunto" value={subject} onChange={(e) => setSubject(e.target.value)} />
            <textarea
              className="flex h-32 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="Mensaje"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpenHelp(false)}>Cancelar</Button>
          <Button
            onClick={() => {
              const mail = "admin@aaces.com"
              const url = `mailto:${mail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`
              window.location.href = url
              setOpenHelp(false)
            }}
          >Enviar</Button>
        </DialogFooter>
      </Dialog>
    </SidebarGroup>
  )
}
