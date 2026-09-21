"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ConstanciaResumenVM } from "@/viewmodels/document"
import { FileText, Download, ExternalLink } from "lucide-react"
import { DocumentStatusBadge } from "./DocumentStatusBadge"

interface DataTableProps {
  items: ConstanciaResumenVM[]
  loading: boolean
  onView: (id: string) => void
  onDownload: (id: string) => void
}

export function DataTable({ items, loading, onView, onDownload }: DataTableProps) {
  if (loading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Participante</TableHead>
              <TableHead>Curso</TableHead>
              <TableHead className="hidden md:table-cell">Código</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="hidden md:table-cell">Verif.</TableHead>
              <TableHead className="hidden lg:table-cell">Emisión</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 7 }).map((_, j) => (
                  <TableCell key={j}>
                    <div className="h-4 w-full animate-pulse rounded bg-muted" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <FileText className="h-12 w-12 text-muted-foreground/40" />
        <p className="text-lg font-medium">Sin resultados</p>
        <p className="text-sm text-muted-foreground">
          No se encontraron constancias con los filtros aplicados.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="hidden rounded-md border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Participante</TableHead>
              <TableHead>Curso</TableHead>
              <TableHead className="hidden md:table-cell">Código</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="hidden md:table-cell">Verif.</TableHead>
              <TableHead className="hidden lg:table-cell">Emisión</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow
                key={item.id}
                className="cursor-pointer"
                onClick={() => onView(item.id)}
              >
                <TableCell className="font-medium">
                  {item.participante_nombre || "—"}
                </TableCell>
                <TableCell className="max-w-[200px] truncate">
                  {item.curso_nombre || "—"}
                </TableCell>
                <TableCell className="font-mono text-xs hidden md:table-cell">
                  {(item.codigo_validacion || "").slice(0, 8)}...
                </TableCell>
                <TableCell>
                  <DocumentStatusBadge estado={item.estatus} />
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {item.verificaciones_count > 0 ? (
                    <Badge variant="default" className="bg-green-600">
                      {item.verificaciones_count}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground hidden lg:table-cell">
                  {item.fecha_emision
                    ? new Date(item.fecha_emision).toLocaleDateString("es-MX")
                    : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation()
                        onView(item.id)
                      }}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDownload(item.id)
                      }}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-3 md:hidden">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-lg border p-4"
            onClick={() => onView(item.id)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{item.participante_nombre || "—"}</p>
                <p className="text-sm text-muted-foreground truncate">
                  {item.curso_nombre || "—"}
                </p>
              </div>
              <div className="shrink-0">
                <DocumentStatusBadge estado={item.estatus} />
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-mono">
                {(item.codigo_validacion || "").slice(0, 8)}...
              </span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.stopPropagation()
                    onView(item.id)
                  }}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDownload(item.id)
                  }}
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
