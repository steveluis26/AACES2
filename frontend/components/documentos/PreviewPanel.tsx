"use client"

import { useState } from "react"
import { FileText, AlertCircle, Loader2 } from "lucide-react"

interface PreviewPanelProps {
  pdfUrl: string
  height?: string
}

export function PreviewPanel({ pdfUrl, height = "600px" }: PreviewPanelProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  if (error) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-destructive/50 bg-destructive/5 text-center"
        style={{ height }}
      >
        <div className="space-y-2">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
          <p className="text-sm text-destructive font-medium">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative rounded-lg border overflow-hidden" style={{ height }}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <div className="text-center space-y-2">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
            <p className="text-xs text-muted-foreground">Cargando PDF...</p>
          </div>
        </div>
      )}
      <iframe
        src={pdfUrl}
        className="w-full h-full border-0"
        title="Vista previa del documento"
        onLoad={() => setLoading(false)}
        onError={() => {
          setLoading(false)
          setError("No se pudo cargar la vista previa del PDF")
        }}
      />
    </div>
  )
}
