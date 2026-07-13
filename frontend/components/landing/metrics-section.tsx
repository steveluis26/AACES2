export default function MetricsSection() {
  const metrics = [
    { label: "Certificados verificables", desc: "Cada constancia emitida en AACES puede validarse al instante." },
    { label: "Validación inmediata", desc: "Con solo ingresar el código único, cualquier empresa puede verificar la autenticidad." },
    { label: "Historial permanente", desc: "Todo el historial de cursos y certificaciones siempre accesible." }
  ]
  return (
    <section className="py-12 md:py-16 bg-muted/30">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-8 md:grid-cols-3">
          {metrics.map((m, i) => (
            <div key={i} className="text-center">
              <p className="text-xl font-bold text-orange-500">{m.label}</p>
              <p className="mt-2 text-sm text-muted-foreground">{m.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}