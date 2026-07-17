'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from '@/components/ui'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from '@/components/ui/table'
import { apiRequest } from '@/app/services/api'

type Renovable = {
  participante_id: string
  pax_id: string
  nombre: string
  correo: string | null
  telefono: string | null
  empresa: string | null
  curso_nombre: string
  codigo_curso: string
  fecha_expiracion: string | null
  estado_vigencia: string
  curso_id: string
}

const ESTADO_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  por_vencer: { label: 'Por vencer', variant: 'secondary' },
  vencido: { label: 'Vencido', variant: 'destructive' },
  vigente: { label: 'Vigente', variant: 'default' },
}

export default function RenovacionesPage() {
  const [items, setItems] = useState<Renovable[]>([])
  const [empresa, setEmpresa] = useState('')
  const [dias, setDias] = useState('60')
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ dias })
      if (empresa.trim()) params.set('empresa', empresa.trim())
      const data = await apiRequest<Renovable[]>(`/participantes/proximos-a-vencer?${params}`)
      setItems(Array.isArray(data) ? data : [])
    } catch { setItems([]) }
    finally { setLoading(false) }
  }, [dias, empresa])

  useEffect(() => { load() }, [load])

  const stats = {
    por_vencer: items.filter(i => i.estado_vigencia === 'por_vencer').length,
    vencidos: items.filter(i => i.estado_vigencia === 'vencido').length,
    total: items.length,
  }

  return (
    <div className="space-y-6 px-4 lg:px-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Renovaciones</h1>
        <div className="flex gap-2 items-center text-sm">
          <span className="text-muted-foreground">{stats.total} participantes</span>
        </div>
      </div>

      <div className="flex gap-2">
        <Card className="flex-1">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600">{stats.por_vencer}</div>
            <div className="text-xs text-muted-foreground">Por vencer</div>
          </CardContent>
        </Card>
        <Card className="flex-1">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{stats.vencidos}</div>
            <div className="text-xs text-muted-foreground">Vencidos</div>
          </CardContent>
        </Card>
        <Card className="flex-1">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total a atender</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Filtros</CardTitle></CardHeader>
        <CardContent className="flex gap-2">
          <Input
            placeholder="Filtrar por empresa"
            value={empresa}
            onChange={e => setEmpresa(e.target.value)}
            className="max-w-xs"
          />
          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder="Días"
              value={dias}
              onChange={e => setDias(e.target.value)}
              className="w-20"
            />
            <span className="text-xs text-muted-foreground">días</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Participante</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Curso</TableHead>
                <TableHead>Vence</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Contacto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(i => {
                const badge = ESTADO_BADGE[i.estado_vigencia] || ESTADO_BADGE.vigente
                const waLink = i.telefono
                  ? `https://wa.me/52${i.telefono.replace(/\D/g, '')}?text=Hola%20${encodeURIComponent(i.nombre)}.%20Te%20contactamos%20de%20la%20capacitadora%20para%20informarte%20que%20tu%20curso%20de%20${encodeURIComponent(i.curso_nombre)}%20${i.estado_vigencia === 'vencido' ? 'ha%20vencido' : 'está%20próximo%20a%20vencer'}.%20Comunícate%20con%20nosotros%20para%20renovar.`
                  : null
                const mailLink = i.correo
                  ? `mailto:${i.correo}?subject=Renovación%20${i.curso_nombre}&body=Hola%20${encodeURIComponent(i.nombre)}.%20Te%20contactamos%20para%20informarte%20sobre%20tu%20curso%20de%20${encodeURIComponent(i.curso_nombre)}.`
                  : null

                return (
                  <TableRow key={`${i.participante_id}-${i.curso_id}`}>
                    <TableCell>
                      <a href={`/cliente/participantes/${i.participante_id}`} className="hover:underline font-medium">
                        {i.nombre}
                      </a>
                      <div className="text-xs text-muted-foreground font-mono">{i.pax_id}</div>
                    </TableCell>
                    <TableCell>{i.empresa || '-'}</TableCell>
                    <TableCell>
                      {i.curso_nombre}
                      <div className="text-xs text-muted-foreground">{i.codigo_curso}</div>
                    </TableCell>
                    <TableCell>{i.fecha_expiracion?.slice(0, 10) || '-'}</TableCell>
                    <TableCell><Badge variant={badge.variant}>{badge.label}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {waLink && (
                          <a href={waLink} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="outline" className="text-xs">WhatsApp</Button>
                          </a>
                        )}
                        {mailLink && (
                          <a href={mailLink}>
                            <Button size="sm" variant="outline" className="text-xs">Correo</Button>
                          </a>
                        )}
                        {!waLink && !mailLink && (
                          <span className="text-xs text-muted-foreground">Sin contacto</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
              {items.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-sm text-muted-foreground text-center py-8">
                    Todos los cursos están vigentes. No hay participantes próximos a vencer.
                  </TableCell>
                </TableRow>
              )}
              {loading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-sm text-muted-foreground text-center py-8">
                    Cargando...
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
