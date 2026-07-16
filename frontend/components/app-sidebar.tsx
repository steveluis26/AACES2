"use client"
import * as React from "react"
import {
  ArrowUpCircleIcon,
  BarChartIcon,
  CameraIcon,
  ClipboardListIcon,
  DatabaseIcon,
  FileCodeIcon,
  FileTextIcon,
  FolderIcon,
  HelpCircleIcon,
  LayoutDashboardIcon,
  ListIcon,
  SettingsIcon,
  UsersIcon,
  CalendarIcon,
  CreditCardIcon,
  MailIcon,
  StampIcon,
} from "lucide-react"

import { NavDocuments } from "@/components/nav-documents"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
// NavUser removido
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  navClouds: [
    {
      title: "Capture",
      icon: CameraIcon,
      isActive: true,
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
    {
      title: "Proposal",
      icon: FileTextIcon,
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
    {
      title: "Prompts",
      icon: FileCodeIcon,
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
  ],
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
      name: "Datos",
      url: "#",
      icon: DatabaseIcon,
    },
    {
      name: "Reportes",
      url: "#",
      icon: ClipboardListIcon,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const getRole = () => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("aaces_user") : null
      if (!raw) return undefined
      const u = JSON.parse(raw)
      return (u.rol || u.role) as string | undefined
    } catch {
      return undefined
    }
  }

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

  const [role, setRole] = React.useState<string | undefined>(undefined)
  const [isSuperAdmin, setIsSuperAdmin] = React.useState(false)
  React.useEffect(() => {
    setRole(getRole())
    setIsSuperAdmin(getIsSuperAdmin())
  }, [])

  const navMain = [
    {
      title: "Dashboard",
      url: role === "admin" ? "/admin/dashboard" : "/cliente/dashboard",
      icon: LayoutDashboardIcon,
    },
    {
      title: "Cursos",
      url: role === "admin" ? "/admin/clientes" : "/cliente/cursos",
      icon: ListIcon,
    },
    {
      title: "Plantillas",
      url: role === "admin" ? "/admin/templates" : "/cliente/templates",
      icon: StampIcon,
    },
    {
      title: "Analítica",
      url: "/analytics",
      icon: BarChartIcon,
    },
    {
      title: "Pagos",
      url: role === "admin" ? "/admin/dashboard" : "/cliente/pagos",
      icon: CreditCardIcon,
    },
    ...(role === "admin"
      ? []
      : [
          {
            title: "Gestión",
            url: "/cliente/gestion",
            icon: FolderIcon,
          },
        ]),
    ...(isSuperAdmin
      ? [
          {
            title: "Organizaciones",
            url: "/admin/organizaciones",
            icon: FolderIcon,
          },
          {
            title: "Mensajes",
            url: "/admin/contacto",
            icon: MailIcon,
          },
        ]
      : [
          {
            title: "Calendario",
            url: "/cliente/cursos?view=calendar",
            icon: CalendarIcon,
          },
        ]),
    {
      title: "Perfil",
      url: role === "admin" ? "/admin/perfil" : "/cliente/perfil",
      icon: UsersIcon,
    },
  ]

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
      {/* SidebarFooter removido */}
      </Sidebar>
  )
}
