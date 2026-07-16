import { ReactNode } from "react"
import { DocumentStatusBadge } from "./DocumentStatusBadge"
import { DocumentStatus } from "@/viewmodels/document"

interface DocumentHeaderProps {
  tipo: string
  estado: DocumentStatus
  codigoValidacion: string
  folio?: string
  children?: ReactNode
}

export function DocumentHeader({
  tipo,
  estado,
  codigoValidacion,
  folio,
  children,
}: DocumentHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{tipo}</h1>
          <DocumentStatusBadge estado={estado} />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-mono">{codigoValidacion}</span>
          {folio && (
            <>
              <span className="text-xs">·</span>
              <span>Folio {folio}</span>
            </>
          )}
        </div>
      </div>
      {children && (
        <div className="flex items-center gap-2">{children}</div>
      )}
    </div>
  )
}
