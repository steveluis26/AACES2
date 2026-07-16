"use client"

import { useState } from "react"
import { Copy, Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface HashViewerProps {
  hash: string
  label?: string
  copyable?: boolean
}

export function HashViewer({
  hash,
  label = "SHA-256",
  copyable = true,
}: HashViewerProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (!copyable) return
    try {
      await navigator.clipboard.writeText(hash)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // silent
    }
  }

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div
        className={cn(
          "flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2",
          copyable && "cursor-pointer hover:bg-muted/50 transition-colors"
        )}
        onClick={handleCopy}
        title={copyable ? "Copiar hash" : undefined}
      >
        <code className="flex-1 text-xs font-mono break-all select-all">
          {hash}
        </code>
        {copyable && (
          <span className="shrink-0 text-muted-foreground">
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-600" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </span>
        )}
      </div>
    </div>
  )
}
