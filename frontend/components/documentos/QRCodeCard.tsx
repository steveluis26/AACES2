"use client"

import { QrCode } from "lucide-react"

interface QRCodeCardProps {
  codigo: string
  verificationUrl: string
  qrImageUrl?: string
}

export function QRCodeCard({ codigo, verificationUrl: url, qrImageUrl }: QRCodeCardProps) {
  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center gap-2">
        <QrCode className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Código QR</span>
      </div>
      <div className="flex justify-center">
        {qrImageUrl ? (
          <img
            src={qrImageUrl}
            alt="QR de verificación"
            className="h-40 w-40"
          />
        ) : (
          <div className="h-40 w-40 bg-muted rounded-lg flex items-center justify-center">
            <QrCode className="h-12 w-12 text-muted-foreground/40" />
          </div>
        )}
      </div>
      <div className="text-center">
        <p className="text-xs font-mono text-muted-foreground break-all">{codigo}</p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline mt-1 inline-block"
        >
          Verificar en línea
        </a>
      </div>
    </div>
  )
}
