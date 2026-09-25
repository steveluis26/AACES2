"use client"

import { useEffect, useMemo, useState } from "react"
import {
  FolderIcon,
  MoreHorizontalIcon,
  ShareIcon,
  type LucideIcon,
} from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { apiService } from "@/lib/api"

export function NavDocuments({
  items,
}: {
  items: {
    name: string
    url: string
    icon: LucideIcon
  }[]
}) {
  const { isMobile } = useSidebar()
  const [openReports, setOpenReports] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any[]>([])

  useEffect(() => {
    if (!openReports) return
    let mounted = true
    setLoading(true)
    ;(async () => {
      try {
        const res = await apiService.getConstanciasCliente()
        const json = res.data
        if (mounted) setData(Array.isArray(json) ? json : [])
      } catch {
        if (mounted) setData([])
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [openReports])

  const groups = useMemo(() => {
    const map = new Map<string, any[]>()
    for (const it of data) {
      const d = it.fecha_emision_certificado ? new Date(it.fecha_emision_certificado) : null
      const key = d ? d.toISOString().slice(0, 10) : "Sin fecha"
      const arr = map.get(key) || []
      arr.push(it)
      map.set(key, arr)
    }
    return Array.from(map.entries()).sort((a, b) => {
      const pa = a[0] === "Sin fecha" ? 1 : 0
      const pb = b[0] === "Sin fecha" ? 1 : 0
      if (pa !== pb) return pa - pb
      const da = new Date(a[0])
      const db = new Date(b[0])
      return db.getTime() - da.getTime()
    })
  }, [data])

  const printCert = (item: any) => {
    const w = window.open("", "_blank")
    if (!w) return
    const emision = item.fecha_emision_certificado ? new Date(item.fecha_emision_certificado).toLocaleDateString() : ""
    const expiracion = item.fecha_expiracion ? new Date(item.fecha_expiracion).toLocaleDateString() : ""
    const fechaCurso = item.fecha_curso ? new Date(item.fecha_curso).toLocaleDateString() : ""
    const estadoTxt = typeof item.estado_acreditacion === "boolean" ? (item.estado_acreditacion ? "Acreditado" : "No acreditado") : ""
    const constancias = item.constancias_asociadas || ""
    const origin = typeof window !== "undefined" ? window.location.origin : ""
    // El QR debe llevar a la página de verificación, no al PDF
    const validationUrl = item.codigo_validacion ? `${origin}/v/${encodeURIComponent(String(item.codigo_validacion))}` : ""
    const qrUrl = validationUrl ? `https://quickchart.io/qr?text=${encodeURIComponent(validationUrl)}&size=180` : `https://quickchart.io/qr?text=${encodeURIComponent(String(item.codigo_validacion || ""))}&size=180`
    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Certificación ${item.id_certificado || ""}</title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    @page { size: A4; margin: 20mm }
    html,body{height:100%}
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;margin:0;background:#f5f6f8;color:#111}
    .sheet{max-width:850px;margin:24px auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.08)}
    .hdr{display:flex;align-items:center;justify-content:space-between;padding:24px 28px;border-bottom:1px solid #e5e7eb}
    .brand{font-weight:700;font-size:18px;letter-spacing:.2px}
    .badge{font-size:12px;padding:6px 10px;border-radius:999px;background:#0ea5e9;color:#fff}
    .title{padding:22px 28px 0;font-size:22px;font-weight:700}
    .sub{padding:0 28px 8px;font-size:12px;color:#6b7280}
    .grid{display:grid;grid-template-columns:1.2fr .8fr;gap:0}
    .left{padding:18px 28px}
    .row{display:grid;grid-template-columns:160px 1fr;gap:12px;padding:10px 0;border-bottom:1px dashed #e5e7eb}
    .label{font-size:12px;color:#6b7280}
    .value{font-size:14px;font-weight:600}
    .right{padding:18px 28px;border-left:1px solid #e5e7eb;display:flex;align-items:center;justify-content:center}
    .qrwrap{display:flex;flex-direction:column;align-items:center;gap:10px}
    .qrwrap img{width:180px;height:180px;border:1px solid #e5e7eb;border-radius:8px}
    .verify{font-size:12px;color:#374151;text-align:center}
    .status{display:inline-flex;align-items:center;gap:8px;margin-top:8px;font-size:13px}
    .dot{width:8px;height:8px;border-radius:50%}
    .ok{background:#16a34a}
    .bad{background:#ef4444}
    .footer{padding:16px 28px;border-top:1px solid #e5e7eb;font-size:11px;color:#6b7280;display:flex;justify-content:space-between;align-items:center}
    .foot-brand{font-weight:600;color:#111}
    @media print { body{background:#fff} .sheet{box-shadow:none;border:0} }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="hdr">
      <div class="brand">AACES</div>
      <div class="badge">Certificación verificada</div>
    </div>
    <div class="title">${item.participante_nombre || ""}</div>
    <div class="sub">ID certificado ${item.id_certificado || ""}${item.codigo_validacion ? ` · Código ${item.codigo_validacion}` : ""}</div>
    <div class="grid">
      <div class="left">
        <div class="row"><div class="label">Curso</div><div class="value">${item.curso_nombre || ""}</div></div>
        <div class="row"><div class="label">Fecha del curso</div><div class="value">${fechaCurso}</div></div>
        <div class="row"><div class="label">Fecha de emisión</div><div class="value">${emision}</div></div>
        <div class="row"><div class="label">Fecha de expiración</div><div class="value">${expiracion}</div></div>
        <div class="row"><div class="label">Ciudad</div><div class="value">${item.ciudad || ""}</div></div>
        <div class="row"><div class="label">Capacitador</div><div class="value">${item.capacitador_nombre || ""}</div></div>
        <div class="row"><div class="label">Constancias asociadas</div><div class="value">${constancias || ""}</div></div>
        <div class="status"><div class="dot ${item.estado_acreditacion ? "ok" : "bad"}"></div><div>${estadoTxt}</div></div>
      </div>
      <div class="right">
        <div class="qrwrap">
          <img src="${qrUrl}" alt="QR" />
          <div class="verify">Verificación en línea${validationUrl ? ` · ${validationUrl}` : ""}</div>
        </div>
      </div>
    </div>
    <div class="footer">
      <div class="foot-brand">AACES</div>
      <div>Emitido por ${item.curso_nombre || ""}</div>
    </div>
  </div>
  <script>window.onload=function(){setTimeout(function(){window.print()},300)}</script>
</body>
</html>`
    w.document.write(html)
    w.document.close()
  }

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Configuración</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem key={item.name}>
            {item.name === "Reportes" ? (
              <SidebarMenuButton onClick={() => setOpenReports(true)}>
                <item.icon />
                <span>{item.name}</span>
              </SidebarMenuButton>
            ) : (
              <SidebarMenuButton asChild>
                <a href={item.url}>
                  <item.icon />
                  <span>{item.name}</span>
                </a>
              </SidebarMenuButton>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuAction
                  showOnHover
                  className="rounded-sm data-[state=open]:bg-accent"
                >
                  <MoreHorizontalIcon />
                  <span className="sr-only">More</span>
                </SidebarMenuAction>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-24 rounded-lg"
                side={isMobile ? "bottom" : "right"}
                align={isMobile ? "end" : "start"}
              >
                <DropdownMenuItem>
                  <FolderIcon />
                  <span>Open</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <ShareIcon />
                  <span>Share</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
      <Dialog open={openReports} onClose={() => setOpenReports(false)}>
        <DialogHeader>
          <DialogTitle>Constancias por fecha</DialogTitle>
        </DialogHeader>
        <DialogContent>
          {loading ? (
            <div className="py-8 text-center">Cargando…</div>
          ) : groups.length === 0 ? (
            <div className="py-8 text-center">Sin constancias</div>
          ) : (
            <div className="space-y-6">
              {groups.map(([fecha, items]) => (
                <div key={fecha} className="space-y-2">
                  <div className="text-sm font-semibold">{fecha === "Sin fecha" ? fecha : new Date(fecha).toLocaleDateString()}</div>
                  <div className="divide-y rounded-md border">
                    {(items as any[]).map((it) => (
                      <div key={it.id} className="flex items-center justify-between gap-3 px-3 py-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{it.participante_nombre}</div>
                          <div className="truncate text-xs text-muted-foreground">{it.curso_nombre} · {it.codigo_validacion || it.id_certificado || ""}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          {it.certificado_url ? (
                            <Button variant="outline" onClick={() => window.open(it.certificado_url, "_blank")}>Descargar</Button>
                          ) : (
                            <Button variant="outline" onClick={() => printCert(it)}>Imprimir</Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpenReports(false)}>Cerrar</Button>
        </DialogFooter>
      </Dialog>
    </SidebarGroup>
  )
}
