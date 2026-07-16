"use client"

import { useState } from "react"
import { Download, Copy, XCircle, RotateCcw, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DocumentCapabilities } from "@/viewmodels/document"
import { verificationUrl } from "@/adapters/constancia.adapter"
import { toast } from "sonner"

interface DocumentActionsProps {
  documentoId: string
  pdfUrl: string
  codigoValidacion: string
  capabilities: DocumentCapabilities
  onReemitir?: () => void
  onCancelar?: () => void
}

export function DocumentActions({
  documentoId,
  pdfUrl,
  codigoValidacion,
  capabilities,
  onReemitir,
  onCancelar,
}: DocumentActionsProps) {
  const [copied, setCopied] = useState(false)

  const handleCopyLink = async () => {
    const url = verificationUrl(codigoValidacion)
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success("Enlace copiado al portapapeles")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("No se pudo copiar el enlace")
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {capabilities.descargar && (
        <Button variant="default" size="sm" onClick={() => window.open(pdfUrl, "_blank")}>
          <Download className="h-4 w-4 mr-1.5" />
          Descargar PDF
        </Button>
      )}
      {capabilities.compartir && (
        <Button variant="outline" size="sm" onClick={handleCopyLink}>
          {copied ? (
            <Check className="h-4 w-4 mr-1.5 text-green-600" />
          ) : (
            <Copy className="h-4 w-4 mr-1.5" />
          )}
          {copied ? "Copiado" : "Copiar enlace"}
        </Button>
      )}
      {capabilities.reemitir && (
        <Button variant="outline" size="sm" onClick={onReemitir}>
          <RotateCcw className="h-4 w-4 mr-1.5" />
          Reemitir
        </Button>
      )}
      {capabilities.cancelar && (
        <Button
          variant="outline"
          size="sm"
          className="text-red-600 hover:text-red-700 hover:border-red-300"
          onClick={onCancelar}
        >
          <XCircle className="h-4 w-4 mr-1.5" />
          Cancelar
        </Button>
      )}
    </div>
  )
}
