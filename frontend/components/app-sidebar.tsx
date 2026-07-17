"use client"
import * as React from "react"
import {
  ArrowUpCircleIcon,
  BarChartIcon,
  DatabaseIcon,
  FileTextIcon,
  FolderIcon,
  HelpCircleIcon,
  LayoutDashboardIcon,
  ListIcon,
  ScrollTextIcon,
  SettingsIcon,
  CalendarIcon,
  CreditCardIcon,
  MailIcon,
  StampIcon,
  UsersIcon,
} from "lucide-react"

import { NavDocuments } from "@/components/nav-documents"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

// Menu definitions by user type.
// SuperAdmin = platform admin that manages the SaaS (no org_id).
// Organization admin = admin of a specific org (has org_id) — uses client experience.
const MENU_SUPERADMIN = [
  { title: "Dashboard",      url: "/admin/dashboard",       icon: LayoutDashboardIcon },
  { title: "Clientes",       url: "/admin/clientes",        icon: ListIcon },
  { title: "Organizaciones", url: "/admin/organizaciones",  icon: FolderIcon },
  { title: "Mensajes",       url: "/admin/contacto",        icon: MailIcon },
  { title: "Reportes",       url: "/analytics",              icon: BarChartIcon },
]

const MENU_CLIENTE = [
  { title: "Dashboard",  url: "/cliente/dashboard",   icon: LayoutDashboardIcon },
  { title: "Cursos",        url: "/cliente/cursos",          icon: ListIcon },
  { title: "Participantes", url: "/cliente/participantes",    icon: UsersIcon },
  { title: "Plantillas", url: "/cliente/templates",    icon: StampIcon },
  { title: "Constancias",url: "/cliente/constancias",  icon: ScrollTextIcon },
  { title: "Pagos",      url: "/cliente/pagos",        icon: CreditCardIcon },
  { title: "Reportes",   url: "/analytics",            icon: BarChartIcon },
  { title: "Gestión",    url: "/cliente/gestion",      icon: FolderIcon },
  { title: "Calendario", url: "/cliente/cursos?view=calendar", icon: CalendarIcon },
]

const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  navSecondary: [
    {
      title: "Ajustes",
      url: "#",
      icon: SettingsIcon,
    },
    {
      title: "Ayuda",
      url: "#",
      icon: HelpCircleIcon,
    },
  ],
  documents: [
    {
      name: "Organización",
      url: "#",
      icon: DatabaseIcon,
    },
    {
      name: "Reportes",
      url: "#",
      icon: BarChartIcon,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const getIsSuperAdmin = () => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("aaces_user") : null
      if (!raw) return false
      const u = JSON.parse(raw)
      return u.isSuperAdmin === true
    } catch {
      return false
    }
  }

  const [navMain, setNavMain] = React.useState(MENU_CLIENTE)

  React.useEffect(() => {
    const isSuperAdmin = getIsSuperAdmin()
    setNavMain(isSuperAdmin ? MENU_SUPERADMIN : MENU_CLIENTE)
  }, [])

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <a href="#">
                <ArrowUpCircleIcon className="h-5 w-5" />
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
        <NavDocuments items={data.documents} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      </Sidebar>
  )
}
