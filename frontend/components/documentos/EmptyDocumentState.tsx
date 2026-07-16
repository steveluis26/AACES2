import { FileQuestion } from "lucide-react"
import { Button } from "@/components/ui/button"

interface EmptyDocumentStateProps {
  titulo: string
  descripcion: string
  accion?: {
    label: string
    onClick: () => void
  }
}

export function EmptyDocumentState({
  titulo,
  descripcion,
  accion,
}: EmptyDocumentStateProps) {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <div className="text-center space-y-4 max-w-sm">
        <FileQuestion className="h-12 w-12 text-muted-foreground/40 mx-auto" />
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{titulo}</h2>
          <p className="text-sm text-muted-foreground">{descripcion}</p>
        </div>
        {accion && (
          <Button variant="default" onClick={accion.onClick}>
            {accion.label}
          </Button>
        )}
      </div>
    </div>
  )
}
