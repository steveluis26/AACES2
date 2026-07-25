'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Dialog, DialogHeader, DialogTitle, DialogContent } from '@/components/ui'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { ErrorBeacon } from '@/components/error-beacon'
import { api } from '../lib/api'

type CursoAgenda = {
  id: string
  codigo_curso: string
  nombre: string
  ciudad: string
  fecha_inicio: string
  fecha_fin: string
  estado: string
  empresa_contratante: string
}

export default function CalendarioPage() {
  const [cursos, setCursos] = useState<CursoAgenda[]>([])
  const [loading, setLoading] = useState(true)
  const [currentMonth, setCurrentMonth] = useState<number>(new Date().getMonth())
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear())
  const [selected, setSelected] = useState<CursoAgenda | null>(null)
  const [openEvent, setOpenEvent] = useState(false)

  const loadMonth = useCallback(async (y: number, m: number) => {
    setLoading(true)
    try {
      const data = await api<CursoAgenda[]>(`/clientes/agenda/mes?year=${y}&month=${m + 1}`)
      setCursos(Array.isArray(data) ? data : [])
    } catch {
      setCursos([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadMonth(currentYear, currentMonth) }, [loadMonth, currentMonth, currentYear])

  const parseLocalDate = (s: string): Date | null => {
    const parts = String(s || '').slice(0, 10).split('-')
    if (parts.length !== 3) return null
    const y = Number(parts[0]); const m = Number(parts[1]); const d = Number(parts[2])
    if (!y || !m || !d) return null
    return new Date(y, m - 1, d)
  }
  const sameDate = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

  const calendarCells = useMemo(() => {
    const first = new Date(currentYear, currentMonth, 1)
    const startIdx = first.getDay()
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
    const cells: Array<{ date: Date | null; items: CursoAgenda[] }> = []
    const byKey: Record<string, CursoAgenda[]> = {}
    const keyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    for (const c of cursos) {
      const start = parseLocalDate(c.fecha_inicio)
      const end = parseLocalDate(c.fecha_fin ?? c.fecha_inicio)
      if (start && end) {
        let dcur = new Date(start.getFullYear(), start.getMonth(), start.getDate())
        while (dcur <= end) {
          const k = keyOf(dcur)
          if (!byKey[k]) byKey[k] = []
          byKey[k].push(c)
          dcur = new Date(dcur.getFullYear(), dcur.getMonth(), dcur.getDate() + 1)
        }
      }
    }
    for (let i = 0; i < startIdx; i++) cells.push({ date: null, items: [] })
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(currentYear, currentMonth, d)
      cells.push({ date, items: byKey[keyOf(date)] || [] })
    }
    while (cells.length % 7 !== 0) cells.push({ date: null, items: [] })
    return cells
  }, [currentMonth, currentYear, cursos])

  const monthLabel = new Date(currentYear, currentMonth, 1).toLocaleString('es-MX', { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-6 px-4 lg:px-6">
      <ErrorBeacon />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-6 w-6 text-[var(--accent)]" />
          <h1 className="text-2xl font-semibold">Calendario de cursos</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { const m = currentMonth - 1; if (m < 0) { setCurrentMonth(11); setCurrentYear(y => y - 1) } else setCurrentMonth(m) }}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="self-center font-semibold capitalize">{monthLabel}</span>
          <Button variant="outline" size="sm" onClick={() => { const m = currentMonth + 1; if (m > 11) { setCurrentMonth(0); setCurrentYear(y => y + 1) } else setCurrentMonth(m) }}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Agenda</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2 text-xs font-medium">
            {['D', 'L', 'M', 'X', 'J', 'V', 'S'].map((d) => (<div key={d} className="text-center">{d}</div>))}
          </div>
          <div className="grid grid-cols-7 gap-2 mt-2">
            {calendarCells.map((c, idx) => (
              <div key={idx} className="min-h-[120px] border rounded-md p-2">
                {c.date ? (
                  <div className="text-xs font-semibold">{c.date.getDate()}</div>
                ) : (
                  <div className="text-xs opacity-50">·</div>
                )}
                <div className="mt-1 space-y-1">
                  {c.items.slice(0, 3).map((ev, iidx) => {
                    const start = parseLocalDate(ev.fecha_inicio)
                    const end = parseLocalDate(ev.fecha_fin ?? ev.fecha_inicio)
                    const day = c.date as Date
                    const isStart = !!(start && day && sameDate(start, day))
                    const isEnd = !!(end && day && sameDate(end, day))
                    const isMiddle = !!(start && end && day && day > start && day < end)
                    const isSingle = !!(start && end && sameDate(start, end))
                    const ribbon = isSingle
                      ? 'rounded-md'
                      : isStart
                        ? 'rounded-l-md -mr-2'
                        : isEnd
                          ? 'rounded-r-md -ml-2'
                          : isMiddle
                            ? 'rounded-none -mx-2 border-l-2 border-r-2 border-[var(--accent)] bg-[var(--accent)]/10'
                            : ''
                    return (
                      <div
                        key={`${ev.id}-${String(ev.fecha_inicio).slice(0, 10)}-${iidx}`}
                        className={`text-xs truncate cursor-pointer px-2 py-0.5 w-full bg-[var(--accent)]/20 ${ribbon}`}
                        onClick={() => { setSelected(ev); setOpenEvent(true) }}
                      >
                        <Badge variant="secondary" className="mr-1">{String(ev.ciudad || '').slice(0, 10)}</Badge>
                        {ev.nombre}
                      </div>
                    )
                  })}
                  {c.items.length > 3 && (
                    <div className="text-[11px] text-muted-foreground">+{c.items.length - 3} más</div>
                  )}
                </div>
              </div>
            ))}
          </div>
          {loading && <div className="text-center text-sm text-muted-foreground py-4">Cargando agenda…</div>}
        </CardContent>
      </Card>

      <Dialog open={openEvent} onClose={() => setOpenEvent(false)}>
        <DialogHeader><DialogTitle>Detalle del curso</DialogTitle></DialogHeader>
        {selected && (
          <DialogContent className="space-y-2">
            <p className="font-semibold text-lg">{selected.nombre}</p>
            <p className="text-sm text-muted-foreground">Código: <span className="font-mono">{selected.codigo_curso}</span></p>
            <p className="text-sm">Ciudad: {selected.ciudad || '-'}</p>
            <p className="text-sm">Inicio: {String(selected.fecha_inicio).slice(0, 10)}</p>
            <p className="text-sm">Fin: {String(selected.fecha_fin ?? selected.fecha_inicio).slice(0, 10)}</p>
            <p className="text-sm">Empresa: {selected.empresa_contratante || '-'}</p>
            <p className="text-sm">Estado: {selected.estado}</p>
          </DialogContent>
        )}
        <div className="flex justify-end px-4 pb-4">
          <Button onClick={() => setOpenEvent(false)}>Cerrar</Button>
        </div>
      </Dialog>
    </div>
  )
}
