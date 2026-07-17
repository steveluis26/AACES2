"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from "@/components/ui"
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from "@/components/ui/table"
import { apiRequest } from "@/app/services/api"

type Pago = {
  id: string
  monto: number
  metodo_pago: string
  fecha_pago: string
  estado_pago: string
  comprobante_url?: string
}

export default function ClientePagosPage() {
  const [participanteId, setParticipanteId] = useState("")
  const [pagos, setPagos] = useState<Pago[]>([])
  const [montoPago, setMontoPago] = useState("")
  const [loading, setLoading] = useState(false)
  const [stripeLoading, setStripeLoading] = useState(false)

  const cargarPagos = useCallback(async () => {
    if (!participanteId.trim()) return
    setLoading(true)
    try {
      const data = await apiRequest<Pago[]>(`/clientes/curso-participante/${participanteId}/pagos`)
      setPagos(Array.isArray(data) ? data : [])
    } catch { setPagos([]) }
    finally { setLoading(false) }
  }, [participanteId])

  const pagarConStripe = async () => {
    if (!participanteId.trim() || !montoPago) return
    setStripeLoading(true)
    try {
      const intent = await apiRequest<{ client_secret: string; payment_intent_id: string }>("/stripe/create-payment-intent", {
        method: "POST",
        body: JSON.stringify({ curso_participante_id: participanteId, monto: parseFloat(montoPago) }),
      })
      alert(`PaymentIntent creado: ${intent.payment_intent_id}\nClient Secret: ${intent.client_secret}\n\n(Integración de frontend Stripe Elements pendiente)`)
      await cargarPagos()
    } catch (e) {
      alert((e as Error)?.message || "Error al procesar pago")
    } finally { setStripeLoading(false) }
  }

  return (
    <div className="space-y-6 px-4 lg:px-6">
      <h1 className="text-2xl font-semibold">Pagos</h1>

      <Card>
        <CardHeader><CardTitle>Consultar pagos</CardTitle></CardHeader>
        <CardContent className="flex gap-2">
          <Input placeholder="ID de curso-participante" value={participanteId} onChange={e => setParticipanteId(e.target.value)} />
          <Button onClick={cargarPagos} disabled={loading || !participanteId.trim()}>Buscar</Button>
        </CardContent>
      </Card>

      {pagos.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Pagos registrados</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Monto</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagos.map(p => (
                  <TableRow key={p.id}>
                    <TableCell>${p.monto.toFixed(2)}</TableCell>
                    <TableCell>{p.metodo_pago || "-"}</TableCell>
                    <TableCell>{p.fecha_pago ? new Date(p.fecha_pago).toLocaleDateString("es-MX") : "-"}</TableCell>
                    <TableCell>{p.estado_pago}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {participanteId.trim() && (
        <Card>
          <CardHeader><CardTitle>Nuevo pago con Stripe</CardTitle></CardHeader>
          <CardContent className="flex gap-2 items-end">
            <Input type="number" step="0.01" placeholder="Monto" value={montoPago} onChange={e => setMontoPago(e.target.value)} />
            <Button onClick={pagarConStripe} disabled={stripeLoading || !montoPago}>
              {stripeLoading ? "Procesando..." : "Pagar con tarjeta"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
