"use client"
import { ScrollText, QrCode, Users, Clock, BarChart3, Compass } from "lucide-react"

const features = [
  {
    icon: ScrollText,
    title: "Constancias DC-3 oficiales",
    description: "Genera constancias con formato oficial STPS en segundos, con QR y folio único."
  },
  {
    icon: QrCode,
    title: "QR de verificación",
    description: "Cada constancia incluye código QR para que empresas verifiquen su autenticidad."
  },
  {
    icon: Users,
    title: "Gestión de participantes",
    description: "Administra grupos, inscripciones, pagos y expedientes de cada trabajador."
  },
  {
    icon: Clock,
    title: "Vigencia automática",
    description: "Seguimiento de vencimientos por curso. Alertas cuando una constancia está por expirar."
  },
  {
    icon: BarChart3,
    title: "Dashboard y reportes",
    description: "Métricas de tus cursos, ingresos y participantes en tiempo real."
  },
  {
    icon: Compass,
    title: "Trazabilidad completa",
    description: "Cada certificado conserva el historial desde su emisión hasta su validación."
  }
]

export default function FeaturesSection() {
  return (
    <section className="py-12 md:py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center">
          <h2 className="text-3xl font-semibold">Todo lo que necesitas para capacitar</h2>
          <p className="mt-4 text-muted-foreground">Herramientas diseñadas para capacitadores que buscan profesionalizar su servicio.</p>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <div key={i} className="group rounded-2xl border border-border/50 bg-card p-6 transition-shadow hover:shadow-md">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-orange-600 text-black dark:bg-orange-500 dark:text-black">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold">{f.title}</h3>

              <p className="mt-2 text-sm text-muted-foreground">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}