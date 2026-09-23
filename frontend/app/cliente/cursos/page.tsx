"use client"

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useMemo, Fragment, Suspense } from 'react'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Alert } from '@/components/ui'
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { apiRequest } from '@/app/services/api'
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ColumnDef, SortingState, flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table'
import { Checkbox } from '@/components/ui/checkbox'
import { ChevronDownIcon, ChevronUpIcon, ChevronLeftIcon, ChevronRightIcon, Loader2 } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { parseFecha } from '@/lib/utils'
import { Field } from '@/components/ui/field'
import { FormStep, Segmented } from '@/components/forms/form-bits'
import { UserPlus as UserPlusIcon } from 'lucide-react'

const fechaCorta = (v?: string | null) => { const d = parseFecha(v ? String(v).slice(0, 10) : null); return d ? d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '-' }

type SubCurso = { id: string; codigo_curso: string; nombre: string; ciudad: string; fecha_inicio: string; fecha_fin: string; estado: string; empresa_contratante: string }
type CursoProximo = { id: string; codigo_curso: string; nombre: string; ciudad: string; fecha_inicio: string; fecha_fin: string; estado: string; empresa_contratante: string; grupo_id?: string; precio_base?: number; precio_promocional?: number | null; subcursos?: (SubCurso & { precio_base?: number; precio_promocional?: number | null })[] }
type GrupoCurso = { id: string; nombre: string; precio_base: number; precio_promocional?: number | null }
type CursoParticipante = { id: string; participante_id: string; nombre: string; apellido: string; nombres?: string; apellido_paterno?: string; apellido_materno?: string; correo: string; ciudad_origen: string; telefono?: string; empresa?: string; cargo?: string; profesion?: string; estado_pago: string; valor_pagado: number; costo_asignado: number; descuento: number; id_certificado?: string; codigo_validacion?: string; estado_acreditacion?: boolean; fecha_emision_certificado?: string; fecha_inicio_vigencia?: string; fecha_expiracion?: string; habilitar_validacion?: boolean }
type NuevoParticipante = { nombre?: string; apellido?: string; nombres?: string; apellido_paterno?: string; apellido_materno?: string; correo: string; ciudad_origen?: string; telefono?: string; empresa?: string; cargo?: string; profesion?: string; id_certificado?: string; codigo_validacion?: string; estado_acreditacion?: boolean; fecha_emision_certificado?: string; fecha_expiracion?: string; precio_modo?: 'normal' | 'descuento' }
type ConstanciaCurso = { id: string; nombre: string; norma?: string }
type ConstanciaAsignada = { id: string; constancia_id: string; constancia_nombre: string; participante_id: string; participante_nombre: string; id_certificado?: string; codigo_validacion?: string; estado_acreditacion?: boolean; fecha_emision_certificado?: string; fecha_expiracion?: string }

export default function CursosClientePage() {
  const [proximos, setProximos] = useState<CursoProximo[]>([])
  const [selected, setSelected] = useState<CursoProximo | null>(null)
  const [participantes, setParticipantes] = useState<CursoParticipante[]>([])
  const [grupos, setGrupos] = useState<GrupoCurso[]>([])
  const [nuevoPart, setNuevoPart] = useState<NuevoParticipante>({ nombres: '', apellido_paterno: '', apellido_materno: '', correo: '', ciudad_origen: '', telefono: '', empresa: '', cargo: '', profesion: '', precio_modo: 'normal' })
  const [nuevoPago, setNuevoPago] = useState<Record<string, { monto: number; metodo: string; ref: string }>>({})
  const [pagosByCp, setPagosByCp] = useState<Record<string, Array<{ id: string; monto: number; metodo_pago: string; fecha_pago: string; estado_pago: string; comprobante_url?: string }>>>({})
  const [openPagos, setOpenPagos] = useState<Record<string, boolean>>({})
  const [viewMode, setViewMode] = useState<'tabla' | 'tarjetas'>('tabla')
  const [agendaView, setAgendaView] = useState<'lista' | 'calendario'>('lista')
  const [currentMonth, setCurrentMonth] = useState<number>(new Date().getMonth())
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear())
  const [calendarCursos, setCalendarCursos] = useState<CursoProximo[]>([])
  const [openDetails, setOpenDetails] = useState<Record<string, boolean>>({})
  const [openEventDialog, setOpenEventDialog] = useState(false)
  const [estadoFilter, setEstadoFilter] = useState<'todos' | 'pendiente' | 'anticipo' | 'pagado' | 'cancelado'>('todos')
  const [estadoCursoFilter, setEstadoCursoFilter] = useState<'todos' | 'activo' | 'pendiente' | 'cancelado'>('todos')
  const [estadoEditar, setEstadoEditar] = useState<'activo' | 'pendiente' | 'cancelado'>('pendiente')
  const [sorting, setSorting] = useState<SortingState>([])
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 })
  const [rowSelection, setRowSelection] = useState({})
  const token = typeof window !== 'undefined' ? localStorage.getItem('aaces_token') : null
  const headers = useMemo(() => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) h['Authorization'] = `Bearer ${token}`
    return h
  }, [token])
  const fmtMXN = typeof window !== 'undefined' ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }) : { format: (n: number) => `MX$ ${Number(n || 0).toFixed(2)}` }
  const [constanciasCurso, setConstanciasCurso] = useState<ConstanciaCurso[]>([])
  const [constanciasAsignadas, setConstanciasAsignadas] = useState<ConstanciaAsignada[]>([])
  const [nuevoConstanciaNombre, setNuevoConstanciaNombre] = useState('')
  const [nuevoConstanciaNorma, setNuevoConstanciaNorma] = useState('')
  const [nuevoAsignacion, setNuevoAsignacion] = useState<Record<string, { constancia_id?: string; id_certificado?: string; codigo_validacion?: string; fecha_emision_certificado?: string; fecha_expiracion?: string; estado_acreditacion?: boolean }>>({})
  const [detalleError, setDetalleError] = useState<string>('')
  const [csvError, setCsvError] = useState<string>('')
  const [participanteError, setParticipanteError] = useState<string>('')
  const [agregando, setAgregando] = useState(false)
  const [precioGrupoError, setPrecioGrupoError] = useState<string>('')
  const [constanciaError, setConstanciaError] = useState<string>('')
  const [filaError, setFilaError] = useState<Record<string, string>>({})

  const reload = useCallback(async () => {
    try {
      const data = await apiRequest<CursoProximo[] | { data?: CursoProximo[] }>('/clientes/agenda/proximos')
      const proximosData: CursoProximo[] = Array.isArray(data) ? data : Array.isArray((data as { data?: CursoProximo[] }).data) ? (data as { data?: CursoProximo[] }).data || [] : []
      setProximos(proximosData)
      setSelected(null)
    } catch {
      setProximos([])
      setSelected(null)
    }
  }, [])

  const loadCalendarMonth = useCallback(async (y: number, m: number) => {
    try {
      const data = await apiRequest<CursoProximo[]>(`/clientes/agenda/mes?year=${y}&month=${m + 1}`)
      const list: CursoProximo[] = Array.isArray(data) ? data : []
      setCalendarCursos(list)
    } catch {
      setCalendarCursos([])
    }
  }, [])

  const loadGrupos = useCallback(async () => {
    try {
      const data = await apiRequest<GrupoCurso[] | { data?: GrupoCurso[] }>('/clientes/grupos-curso')
      const list: GrupoCurso[] = Array.isArray(data) ? (data as GrupoCurso[]) : Array.isArray((data as { data?: GrupoCurso[] }).data) ? (data as { data?: GrupoCurso[] }).data || [] : []
      setGrupos(list.map((g) => ({ id: String(g.id ?? ''), nombre: String(g.nombre ?? ''), precio_base: Number(g.precio_base || 0), precio_promocional: g.precio_promocional != null ? Number(g.precio_promocional || 0) : null })))
    } catch {
      setGrupos([])
    }
  }, [])

  const searchParams = useSearchParams()
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!cancelled) await reload()
    }
    run()
    return () => { cancelled = true }
  }, [reload])

  useEffect(() => { loadGrupos() }, [loadGrupos])

  const saveSelected = async () => {
    if (!selected) return
    setDetalleError('')
    const norm = (s: unknown) => {
      const v = String(s ?? '').trim()
      if (!v) return ''
      const base = v.includes('T') ? v.split('T')[0] : v
      return base.length > 10 ? base.slice(0,10) : base
    }
    const payload: Record<string, unknown> = {}
    if (selected.ciudad && selected.ciudad.trim()) payload.ciudad = selected.ciudad.trim()
    if (selected.empresa_contratante && selected.empresa_contratante.trim()) payload.empresa_contratante = selected.empresa_contratante.trim()
    const fi = norm(selected.fecha_inicio)
    const ff = norm(selected.fecha_fin)
    if (estadoEditar === 'activo') {
      if (!fi) { setDetalleError('Para estado Activo, debes asignar al menos la fecha de inicio'); return }
      payload.fecha_inicio = fi
      if (ff) payload.fecha_fin = ff
    } else {
      if (fi) payload.fecha_inicio = fi
      if (ff) payload.fecha_fin = ff
    }
    payload.estado = (estadoEditar === 'pendiente' ? 'en_espera' : estadoEditar)
    if (typeof selected.precio_base !== 'undefined') {
      const n = Number(selected.precio_base)
      if (Number.isFinite(n) && n >= 0) payload.precio_base = n
    }
    if (selected.precio_promocional !== undefined) {
      const n = Number(selected.precio_promocional)
      if (Number.isFinite(n) && n >= 0) payload.precio_promocional = n
      else if (selected.precio_promocional === null) payload.precio_promocional = null
    }
    if (selected.grupo_id && String(selected.grupo_id).trim()) payload.grupo_id = String(selected.grupo_id).trim()
    if (estadoEditar === 'pendiente' || estadoEditar === 'cancelado') {
      // El backend de cliente no permite modificar estado directamente.
      // En 'pendiente' se agenda sin fecha durante la creación; en edición se requiere soporte backend.
      // Aquí guardamos cambios de fecha si los hay, y avisamos si se intentó cambiar solo estado.
      if (!fi && !ff) {
        // No hay fechas, no se enviarán al servidor. El estado no cambiará.
      }
    }
    await apiRequest(`/clientes/cursos/${selected.id}`, { method: 'PUT', body: JSON.stringify(payload) })
    await reload()
  }

  const loadParticipantes = useCallback(async () => {
    if (!selected) { setParticipantes([]); return }
    try {
      const data = await apiRequest<CursoParticipante[] | { data?: CursoParticipante[] }>(`/clientes/cursos/${selected.id}/participantes`)
      const list: CursoParticipante[] = Array.isArray(data) ? data : Array.isArray((data as { data?: CursoParticipante[] }).data) ? (data as { data?: CursoParticipante[] }).data || [] : []
      setParticipantes(list)
    } catch {
      setParticipantes([])
    }
  }, [selected])

  const exportarCSV = useCallback(async () => {
    if (!selected) return
    setCsvError('')
    try {
      const res = await fetch(`/api/v1/clientes/cursos/${selected.id}/participantes/export?format=csv`, { headers })
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const disp = res.headers.get('Content-Disposition') || ''
      const name = disp.includes('filename=') ? disp.split('filename=')[1] : `participantes_${selected.id}.csv`
      const a = document.createElement('a')
      a.href = url
      a.download = String(name || `participantes_${selected.id}.csv`).replace(/"/g, '')
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      setCsvError((e as Error)?.message || 'No se pudo exportar')
    }
  }, [selected, headers])

  const loadConstanciasCurso = useCallback(async () => {
    if (!selected) { setConstanciasCurso([]); return }
    try {
      const data = await apiRequest<ConstanciaCurso[] | { data?: ConstanciaCurso[] }>(`/clientes/cursos/${selected.id}/constancias`)
      const list: ConstanciaCurso[] = Array.isArray(data) ? data : Array.isArray((data as { data?: ConstanciaCurso[] }).data) ? (data as { data?: ConstanciaCurso[] }).data || [] : []
      setConstanciasCurso(list.map(c => ({ id: String(c.id), nombre: String(c.nombre), norma: c.norma ? String(c.norma) : undefined })))
    } catch { setConstanciasCurso([]) }
  }, [selected])

  const loadConstanciasAsignadas = useCallback(async () => {
    if (!selected) { setConstanciasAsignadas([]); return }
    try {
      const data = await apiRequest<ConstanciaAsignada[] | { data?: ConstanciaAsignada[] }>(`/clientes/cursos/${selected.id}/constancias/asignadas`)
      const list: ConstanciaAsignada[] = Array.isArray(data) ? data : Array.isArray((data as { data?: ConstanciaAsignada[] }).data) ? (data as { data?: ConstanciaAsignada[] }).data || [] : []
      setConstanciasAsignadas(list.map(r => ({
        id: String(r.id), constancia_id: String(r.constancia_id), constancia_nombre: String(r.constancia_nombre), participante_id: String(r.participante_id), participante_nombre: String(r.participante_nombre || ''),
        id_certificado: r.id_certificado ? String(r.id_certificado) : undefined,
        codigo_validacion: r.codigo_validacion ? String(r.codigo_validacion) : undefined,
        estado_acreditacion: typeof r.estado_acreditacion !== 'undefined' ? !!r.estado_acreditacion : undefined,
        fecha_emision_certificado: r.fecha_emision_certificado ? String(r.fecha_emision_certificado) : undefined,
        fecha_expiracion: r.fecha_expiracion ? String(r.fecha_expiracion) : undefined
      })))
    } catch { setConstanciasAsignadas([]) }
  }, [selected])

  useEffect(() => { loadConstanciasCurso(); loadConstanciasAsignadas() }, [loadConstanciasCurso, loadConstanciasAsignadas])

  useEffect(() => { loadParticipantes() }, [loadParticipantes])

  useEffect(() => {
    if (!selected) { setEstadoEditar('pendiente'); return }
    const e = String(selected.estado || '').toLowerCase()
    if (e === 'en_espera') setEstadoEditar('pendiente')
    else if (e === 'activo') setEstadoEditar('activo')
    else setEstadoEditar('cancelado')
  }, [selected])

  const stats = useMemo(() => {
    const total = participantes.length
    let pagados = 0, pendientes = 0, anticipos = 0, cancelados = 0
    for (const p of participantes) {
      const e = String(p.estado_pago || '').toLowerCase()
      if (e === 'pagado') pagados++
      else if (e === 'pendiente') pendientes++
      else if (e === 'anticipo') anticipos++
      else if (e === 'cancelado') cancelados++
    }
    return { total, pagados, pendientes, anticipos, cancelados }
  }, [participantes])

  const displayed = useMemo(() => {
    if (estadoFilter === 'todos') return participantes
    return participantes.filter(p => String(p.estado_pago || '').toLowerCase() === estadoFilter)
  }, [participantes, estadoFilter])

  const proximosFiltered = useMemo(() => {
    if (estadoCursoFilter === 'todos') return proximos
    const normalize = (s: unknown) => {
      const v = String(s || '').toLowerCase()
      return v === 'en_espera' ? 'pendiente' : v
    }
    return proximos.filter(c => normalize(c.estado) === estadoCursoFilter)
  }, [proximos, estadoCursoFilter])

  useEffect(() => {
    try {
      const v = typeof window !== 'undefined' ? localStorage.getItem('agenda_view') : null
      if (v === 'lista' || v === 'calendario') setAgendaView(v as 'lista' | 'calendario')
    } catch {}
  }, [])

  useEffect(() => {
    const v = searchParams?.get('view')
    if (v === 'calendar') setAgendaView('calendario')
  }, [searchParams])

  useEffect(() => {
    if (agendaView === 'calendario') {
      loadCalendarMonth(currentYear, currentMonth)
    }
  }, [agendaView, currentMonth, currentYear, loadCalendarMonth])

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') localStorage.setItem('agenda_view', agendaView)
    } catch {}
  }, [agendaView])

  useEffect(() => {
    const cid = searchParams?.get('curso')
    if (cid) {
      const c = proximos.find(x => String(x.id) === cid)
      if (c) setSelected(c)
    }
  }, [proximos, searchParams])

  const parseLocalDate = (s: string): Date | null => {
    const parts = String(s || '').slice(0, 10).split('-')
    if (parts.length !== 3) return null
    const y = Number(parts[0])
    const m = Number(parts[1])
    const d = Number(parts[2])
    if (!y || !m || !d) return null
    return new Date(y, m - 1, d)
  }
  const sameDate = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

  const calendarCells: Array<{ date: Date | null; items: CursoProximo[] }> = useMemo(() => {
    const first = new Date(currentYear, currentMonth, 1)
    const startIdx = first.getDay()
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
    const cells: Array<{ date: Date | null; items: CursoProximo[] }> = []
    const byKey: Record<string, CursoProximo[]> = {}
    const keyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const source = calendarCursos
    for (const c of source) {
      const start = parseLocalDate(c.fecha_inicio as string)
      const end = parseLocalDate((c.fecha_fin ?? c.fecha_inicio) as string)
      if (start && end) {
        let dcur = new Date(start.getFullYear(), start.getMonth(), start.getDate())
        while (dcur <= end) {
          const k = keyOf(dcur)
          if (!byKey[k]) byKey[k] = []
          byKey[k].push(c)
          dcur = new Date(dcur.getFullYear(), dcur.getMonth(), dcur.getDate() + 1)
        }
      }
      for (const sc of c.subcursos || []) {
        const ssc = parseLocalDate(sc.fecha_inicio as string)
        const sec = parseLocalDate((sc.fecha_fin ?? sc.fecha_inicio) as string)
        if (ssc && sec) {
          let dcur = new Date(ssc.getFullYear(), ssc.getMonth(), ssc.getDate())
          while (dcur <= sec) {
            const k = keyOf(dcur)
            if (!byKey[k]) byKey[k] = []
            byKey[k].push({ ...c, nombre: sc.nombre, ciudad: sc.ciudad, fecha_inicio: sc.fecha_inicio, fecha_fin: sc.fecha_fin })
            dcur = new Date(dcur.getFullYear(), dcur.getMonth(), dcur.getDate() + 1)
          }
        }
      }
    }
    for (let i = 0; i < startIdx; i++) cells.push({ date: null, items: [] })
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(currentYear, currentMonth, d)
      const k = keyOf(date)
      cells.push({ date, items: byKey[k] || [] })
    }
    while (cells.length % 7 !== 0) cells.push({ date: null, items: [] })
    return cells
  }, [currentMonth, currentYear, calendarCursos])

  useEffect(() => {
    try {
      const v = typeof window !== 'undefined' ? localStorage.getItem('participants_view') : null
      if (v === 'tabla' || v === 'tarjetas') setViewMode(v as 'tabla' | 'tarjetas')
    } catch {}
  }, [])

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') localStorage.setItem('participants_view', viewMode)
    } catch {}
  }, [viewMode])

  const columns: ColumnDef<CursoParticipante>[] = [
    {
      id: 'select',
      header: ({ table }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && 'indeterminate')}
            onCheckedChange={(val) => table.toggleAllPageRowsSelected(!!val)}
            aria-label="Seleccionar todo"
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(val) => row.toggleSelected(!!val)}
            aria-label="Seleccionar fila"
          />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      id: 'nombre',
      accessorFn: (row) => {
        const n = String(row.nombres ?? row.nombre ?? '').trim()
        const ap = String(row.apellido_paterno ?? row.apellido ?? '').trim()
        const am = String(row.apellido_materno ?? '').trim()
        return `${n} ${ap} ${am}`.trim()
      },
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Nombre {column.getIsSorted() === 'asc' ? <ChevronUpIcon className="inline size-4" /> : column.getIsSorted() === 'desc' ? <ChevronDownIcon className="inline size-4" /> : null}
        </Button>
      ),
      cell: ({ row }) => {
        const p = row.original
        const pid = p.id
        return (
          <div className="space-y-1">
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">Nombres<Input placeholder="Nombres" value={String(p.nombres ?? p.nombre ?? '')} onChange={(e) => setParticipantes(arr => { const a = [...arr]; const i = a.findIndex(x => x.id === pid); if (i !== -1) { a[i] = { ...a[i], nombres: e.target.value } } return a })} /></label>
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">Apellido paterno<Input placeholder="Apellido paterno" value={String(p.apellido_paterno ?? p.apellido ?? '')} onChange={(e) => setParticipantes(arr => { const a = [...arr]; const i = a.findIndex(x => x.id === pid); if (i !== -1) { a[i] = { ...a[i], apellido_paterno: e.target.value } } return a })} /></label>
          </div>
        )
      }
    },
    
    {
      accessorKey: 'correo',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Correo {column.getIsSorted() === 'asc' ? <ChevronUpIcon className="inline size-4" /> : column.getIsSorted() === 'desc' ? <ChevronDownIcon className="inline size-4" /> : null}
        </Button>
      ),
      cell: ({ row }) => {
        const p = row.original
        const pid = p.id
        return (
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">Correo<Input placeholder="Correo" value={p.correo || ''} onChange={(e) => setParticipantes(arr => { const a = [...arr]; const i = a.findIndex(x => x.id === pid); if (i !== -1) { a[i] = { ...a[i], correo: e.target.value } } return a })} /></label>
        )
      }
    },
    {
      id: 'id_certificado',
      accessorKey: 'id_certificado',
      header: 'ID Certificado',
      cell: ({ row }) => {
        const p = row.original
        return (
          <div className="font-mono text-sm">{String(p.id_certificado || '-')}</div>
        )
      }
    },
    {
      accessorKey: 'estado_pago',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Estado pago {column.getIsSorted() === 'asc' ? <ChevronUpIcon className="inline size-4" /> : column.getIsSorted() === 'desc' ? <ChevronDownIcon className="inline size-4" /> : null}
        </Button>
      ),
      cell: ({ row }) => {
        const p = row.original
        const pid = p.id
        return (
          <Select value={p.estado_pago || 'pendiente'} onValueChange={(val) => setParticipantes(arr => { const a = [...arr]; const i = a.findIndex(x => x.id === pid); if (i !== -1) { a[i] = { ...a[i], estado_pago: val } } return a })}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Estado pago" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pendiente">pendiente</SelectItem>
              <SelectItem value="anticipo">anticipo</SelectItem>
              <SelectItem value="pagado">pagado</SelectItem>
              <SelectItem value="cancelado">cancelado</SelectItem>
            </SelectContent>
          </Select>
        )
      }
    },
    {
      id: 'costo',
      accessorFn: (row) => Number(row.costo_asignado || 0),
      header: ({ column }) => (
        <div className="text-right"><Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Costo {column.getIsSorted() === 'asc' ? <ChevronUpIcon className="inline size-4" /> : column.getIsSorted() === 'desc' ? <ChevronDownIcon className="inline size-4" /> : null}
        </Button></div>
      ),
      meta: { className: 'text-right' },
      cell: ({ row }) => {
        const p = row.original
        const pid = p.id
        return (
          <div className="space-y-1">
            <ToggleGroup type="single" value={(() => { const vb = Number(selected?.precio_base ?? 0); const vp = selected?.precio_promocional != null ? Number(selected?.precio_promocional ?? 0) : null; const cur = Number(p.costo_asignado || 0); if (vp != null && cur === vp) return 'descuento'; if (cur === vb) return 'normal'; return 'normal' })()} onValueChange={(val) => val && setParticipantes(arr => { const a = [...arr]; const i = a.findIndex(x => x.id === pid); if (i !== -1) { a[i] = { ...a[i], costo_asignado: val === 'descuento' ? Number(selected?.precio_promocional ?? selected?.precio_base ?? 0) : Number(selected?.precio_base ?? selected?.precio_promocional ?? 0), descuento: 0 } } return a })}>
              <ToggleGroupItem value="normal">Normal {fmtMXN.format(Number(selected?.precio_base || 0))}</ToggleGroupItem>
              <ToggleGroupItem value="descuento" disabled={selected?.precio_promocional == null}>Descuento {fmtMXN.format(Number(selected?.precio_promocional ?? selected?.precio_base ?? 0))}</ToggleGroupItem>
            </ToggleGroup>
            <Input type="number" step="0.01" value={String(p.costo_asignado ?? '')} onChange={(e) => setParticipantes(arr => { const a = [...arr]; const i = a.findIndex(x => x.id === pid); if (i !== -1) { a[i] = { ...a[i], costo_asignado: Number(e.target.value || 0) } } return a })} />
          </div>
        )
      }
    },
    {
      id: 'pagado',
      accessorFn: (row) => Number(row.valor_pagado || 0),
      header: ({ column }) => (
        <div className="text-right"><Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Pagado {column.getIsSorted() === 'asc' ? <ChevronUpIcon className="inline size-4" /> : column.getIsSorted() === 'desc' ? <ChevronDownIcon className="inline size-4" /> : null}
        </Button></div>
      ),
      meta: { className: 'text-right' },
      cell: ({ row }) => {
        const p = row.original
        return (
          <div className="text-right">{fmtMXN.format(Number(p.valor_pagado || 0))}</div>
        )
      }
    },
    {
      id: 'saldo',
      accessorFn: (row) => (Number(row.costo_asignado || 0) - Number(row.valor_pagado || 0)) || 0,
      header: ({ column }) => (
        <div className="text-right"><Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Saldo {column.getIsSorted() === 'asc' ? <ChevronUpIcon className="inline size-4" /> : column.getIsSorted() === 'desc' ? <ChevronDownIcon className="inline size-4" /> : null}
        </Button></div>
      ),
      meta: { className: 'text-right' },
      cell: ({ row }) => {
        const p = row.original
        const saldo = (Number(p.costo_asignado || 0) - Number(p.valor_pagado || 0)) || 0
        return (
          <div className="text-right text-sm">{fmtMXN.format(saldo)}</div>
        )
      }
    },
    {
      id: 'acciones',
      header: 'Acciones',
      cell: ({ row }) => {
        const p = row.original
        return (
          <div className="flex flex-col gap-2">
            <Button className="w-full" onClick={() => saveParticipante(p)}>Guardar</Button>
            <Button className="w-full" variant="destructive" onClick={() => deleteParticipante(p)}>Eliminar</Button>
            {filaError[p.id] && (<Alert className="alert-error">{filaError[p.id]}</Alert>)}
            <Button className="w-full" variant="secondary" onClick={() => setOpenDetails(prev => ({ ...prev, [p.id]: !prev[p.id] }))}>{openDetails[p.id] ? 'Ocultar detalles' : 'Detalles'}</Button>
          </div>
        )
      }
    }
  ]

  const table = useReactTable({
    data: displayed,
    columns,
    state: { sorting, pagination, rowSelection },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => row.id,
    enableRowSelection: true,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel()
  })
  const columnsCount = columns.length

  const crearParticipante = async () => {
    if (!selected) return
    const payload: Record<string, string | boolean> = {
      nombres: String(nuevoPart.nombres || '').trim(),
      apellido_paterno: String(nuevoPart.apellido_paterno || '').trim(),
      apellido_materno: String(nuevoPart.apellido_materno || '').trim(),
      correo: String(nuevoPart.correo || '').trim(),
      ciudad_origen: String(nuevoPart.ciudad_origen || '').trim(),
      telefono: String(nuevoPart.telefono || '').trim(),
      empresa: String(nuevoPart.empresa || '').trim(),
      cargo: String(nuevoPart.cargo || '').trim(),
      profesion: String(nuevoPart.profesion || '').trim(),
    }
    const idCert = String(nuevoPart.id_certificado || '').trim()
    const codVal = String(nuevoPart.codigo_validacion || '').trim()
    const emision = String(nuevoPart.fecha_emision_certificado || '').trim()
    const expiracion = String(nuevoPart.fecha_expiracion || '').trim()
    if (idCert) (payload as any).id_certificado = idCert
    if (codVal) (payload as any).codigo_validacion = codVal.toUpperCase()
    if (typeof nuevoPart.estado_acreditacion !== 'undefined') (payload as any).acreditado = !!nuevoPart.estado_acreditacion
    if (emision) (payload as any).fecha_emision_certificado = emision
    if (expiracion) (payload as any).fecha_expiracion_certificado = expiracion
    
    // Antes regresaba sin avisar si faltaba nombre o correo.
    if (!payload.nombres) { setParticipanteError('Escribe el nombre del participante'); return }
    if (!payload.correo) { setParticipanteError('Escribe el correo del participante'); return }
    setAgregando(true)
    try {
      const res = await apiRequest<{ id: string; participante_id: string }>(`/clientes/cursos/${selected.id}/participantes`, { method: 'POST', body: JSON.stringify(payload) })
      const cpId = String(res?.id || '')
      if (cpId) {
        const mode = String(nuevoPart.precio_modo || 'normal') as 'normal' | 'descuento'
        const precio = mode === 'descuento' ? Number(selected?.precio_promocional ?? selected?.precio_base ?? 0) : Number(selected?.precio_base ?? selected?.precio_promocional ?? 0)
        await apiRequest(`/clientes/curso-participante/${cpId}/precio`, { method: 'PUT', body: JSON.stringify({ costo_asignado: Number(precio || 0), descuento: 0 }) })
      }
    } catch (e) {
      setParticipanteError((e as Error)?.message || 'No se pudo agregar')
      setAgregando(false)
      return
    }
    setAgregando(false)
    toast.success('Participante agregado al curso', { description: [payload.nombres, payload.apellido_paterno].filter(Boolean).join(' ') })
    setParticipanteError('')
    setNuevoPart({ nombres: '', apellido_paterno: '', apellido_materno: '', correo: '', ciudad_origen: '', telefono: '', empresa: '', cargo: '', profesion: '', id_certificado: '', codigo_validacion: '', estado_acreditacion: false, fecha_emision_certificado: '', fecha_expiracion: '', precio_modo: 'normal' })
    await loadParticipantes()
  }

  const saveParticipante = async (p: CursoParticipante) => {
    if (!selected) return
    const payload: Record<string, unknown> = {
      nombres: String(p.nombres || '').trim(),
      apellido_paterno: String(p.apellido_paterno || '').trim(),
      apellido_materno: String(p.apellido_materno || '').trim(),
      correo: (p.correo || '').trim(),
      ciudad_origen: (p.ciudad_origen || '').trim(),
      telefono: String(p.telefono || '').trim(),
      empresa: String(p.empresa || '').trim(),
      cargo: String(p.cargo || '').trim(),
      profesion: String(p.profesion || '').trim(),
      estado_pago: (p.estado_pago || 'pendiente')
    }
    const idCert = String(p.id_certificado || '').trim()
    const codVal = String(p.codigo_validacion || '').trim()
    const emision = String(p.fecha_emision_certificado || '').trim()
    const expiracion = String(p.fecha_expiracion || '').trim()
    if (idCert) (payload as any).id_certificado = idCert
    if (codVal) (payload as any).codigo_validacion = codVal.toUpperCase()
    if (typeof p.estado_acreditacion !== 'undefined') (payload as any).acreditado = !!p.estado_acreditacion
    if (emision) (payload as any).fecha_emision_certificado = emision
    if (expiracion) (payload as any).fecha_expiracion_certificado = expiracion
    if ((p as any).habilitar_validacion) (payload as any).habilitar_validacion = true
    // Eliminada validación de documento
    try {
      await apiRequest(`/clientes/cursos/${selected.id}/participantes/${p.id}`, { method: 'PUT', body: JSON.stringify(payload) })
    } catch (e) {
      setFilaError(prev => ({ ...prev, [p.id]: (e as Error)?.message || 'No se pudo guardar' }))
      return
    }
    setFilaError(prev => { const nx = { ...prev }; delete nx[p.id]; return nx })
    await loadParticipantes()
  }

  const registrarPago = async (p: CursoParticipante) => {
    const cfg = nuevoPago[p.id] || { monto: 0, metodo: 'efectivo', ref: '' }
    if (!cfg.monto || cfg.monto <= 0) { setFilaError(prev => ({ ...prev, [p.id]: 'Ingresa un monto válido' })); return }
    const payload = {
      monto: Number(cfg.monto || 0),
      metodo_pago: cfg.metodo || 'efectivo',
      referencia_pago: cfg.ref || '',
      estado_pago: 'completado'
    }
    try {
      await apiRequest(`/clientes/curso-participante/${p.id}/pagos`, { method: 'POST', body: JSON.stringify(payload) })
    } catch (e) {
      setFilaError(prev => ({ ...prev, [p.id]: (e as Error)?.message || 'No se pudo registrar el pago' }))
      return
    }
    setNuevoPago(prev => { const nx = { ...prev }; delete nx[p.id]; return nx })
    setFilaError(prev => { const nx = { ...prev }; delete nx[p.id]; return nx })
    await loadParticipantes()
  }


  const savePrecio = async (p: CursoParticipante) => {
    const payload = {
      costo_asignado: Number(p.costo_asignado || 0),
      descuento: 0
    }
    try {
      await apiRequest(`/clientes/curso-participante/${p.id}/precio`, { method: 'PUT', body: JSON.stringify(payload) })
    } catch (e) {
      setFilaError(prev => ({ ...prev, [p.id]: (e as Error)?.message || 'No se pudo guardar el precio' }))
      return
    }
    setFilaError(prev => { const nx = { ...prev }; delete nx[p.id]; return nx })
    await loadParticipantes()
  }

  const aplicarPrecioGrupo = async (mode: 'solo_vacios' | 'todos') => {
    if (!selected) return
    setPrecioGrupoError('')
    try {
      await apiRequest(`/clientes/cursos/${selected.id}/aplicar-precio-grupo`, { method: 'POST', body: JSON.stringify({ mode }) })
    } catch (e) {
      setPrecioGrupoError((e as Error)?.message || 'No se pudo aplicar el precio de grupo')
      return
    }
    setPrecioGrupoError('')
    await loadParticipantes()
  }

  type Payment = { id: string; monto: number; metodo_pago: string; fecha_pago: string; estado_pago: string; comprobante_url?: string }
  const verPagos = async (p: CursoParticipante) => {
    try {
      const data = await apiRequest<Payment[] | { data?: Payment[] }>(`/clientes/curso-participante/${p.id}/pagos`)
      const list: Payment[] = Array.isArray(data) ? data : Array.isArray((data as { data?: Payment[] }).data) ? (data as { data?: Payment[] }).data || [] : []
      setPagosByCp(prev => ({ ...prev, [p.id]: list }))
      setOpenPagos(prev => ({ ...prev, [p.id]: !prev[p.id] }))
    } catch {
      setPagosByCp(prev => ({ ...prev, [p.id]: [] }))
      setOpenPagos(prev => ({ ...prev, [p.id]: !prev[p.id] }))
    }
  }

  const deleteParticipante = async (p: CursoParticipante) => {
    if (!selected) return
    try {
      await apiRequest(`/clientes/cursos/${selected.id}/participantes/${p.id}`, { method: 'DELETE' })
    } catch (e) {
      setParticipanteError((e as Error)?.message || 'No se pudo eliminar')
      return
    }
    setParticipanteError('')
    await loadParticipantes()
  }


  return (
    <Suspense fallback={<div className="flex min-h-svh items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" /></div>}>
    <div className="space-y-6 px-4 py-4 lg:px-6 lg:py-6">
      <Dialog open={openEventDialog} onClose={() => setOpenEventDialog(false)}>
        <DialogHeader>
          <DialogTitle>{selected ? `${selected.codigo_curso} · ${selected.nombre}` : 'Evento'}</DialogTitle>
        </DialogHeader>
        <DialogContent>
          {selected ? (
            <div className="space-y-2 text-sm">
              <div><span className="font-medium">Ciudad:</span> {selected.ciudad || '-'}</div>
              <div><span className="font-medium">Inicio:</span> {selected.fecha_inicio ? String(selected.fecha_inicio).slice(0,10) : '-'}</div>
              <div><span className="font-medium">Fin:</span> {selected.fecha_fin ? String(selected.fecha_fin).slice(0,10) : '-'}</div>
              <div><span className="font-medium">Estado:</span> {selected.estado === 'en_espera' ? 'pendiente' : selected.estado}</div>
              <div><span className="font-medium">Precio:</span> {fmtMXN.format(Number((selected.precio_promocional ?? selected.precio_base ?? 0) || 0))}</div>
              
            </div>
          ) : null}
        </DialogContent>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpenEventDialog(false)}>Cerrar</Button>
          <Button onClick={() => { setOpenEventDialog(false); const el = typeof window !== 'undefined' ? document.getElementById('editar-curso') : null; if (el) { el.scrollIntoView({ behavior: 'smooth' }); el.classList.add('scroll-highlight'); setTimeout(() => el.classList.remove('scroll-highlight'), 1500) } }}>Ir a edición</Button>
          <Button variant="outline" onClick={() => { setOpenEventDialog(false); const el = typeof window !== 'undefined' ? document.getElementById('participantes-section') : null; if (el) { el.scrollIntoView({ behavior: 'smooth' }); el.classList.add('scroll-highlight'); setTimeout(() => el.classList.remove('scroll-highlight'), 1500) } }}>Ver participantes</Button>
      </DialogFooter>
      </Dialog>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Próximos cursos</h1>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button className="flex-1 sm:flex-none" variant="default" onClick={() => { window.location.href = '/cliente/gestion' }}>
            Crear curso
          </Button>
          <Button className="flex-1 sm:flex-none" variant="secondary" onClick={() => { window.location.href = '/cliente/dashboard' }}>
            Volver al dashboard
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Agenda</CardTitle>
              <div className="flex items-center gap-2">
                <ToggleGroup type="single" value={agendaView} onValueChange={(val) => val && setAgendaView(val as 'lista' | 'calendario')}>
                  <ToggleGroupItem value="lista">Lista</ToggleGroupItem>
                  <ToggleGroupItem value="calendario">Calendario</ToggleGroupItem>
                </ToggleGroup>
              </div>
            </div>
        </CardHeader>
        <CardContent>
          {agendaView === 'calendario' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-lg font-semibold">
                  {new Date(currentYear, currentMonth, 1).toLocaleString('es-MX', { month: 'long', year: 'numeric' })}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => { const m = currentMonth - 1; if (m < 0) { setCurrentMonth(11); setCurrentYear(y => y - 1) } else setCurrentMonth(m) }}><ChevronLeftIcon className="size-4" /></Button>
                  <Button variant="outline" onClick={() => { const m = currentMonth + 1; if (m > 11) { setCurrentMonth(0); setCurrentYear(y => y + 1) } else setCurrentMonth(m) }}><ChevronRightIcon className="size-4" /></Button>
                </div>
              </div>
              {/* Agenda por día en móvil */}
              <div className="md:hidden space-y-2">
                {calendarCells.filter(c => c.date && c.items.length > 0).map((c, idx) => {
                  const d = c.date as Date
                  return (
                    <div key={idx} className="border rounded-md p-3">
                      <div className="text-sm font-semibold capitalize">
                        {d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
                      </div>
                      <div className="mt-2 space-y-1.5">
                        {c.items.map((ev, iidx) => (
                          <button key={`${ev.id}-${String(ev.fecha_inicio).slice(0,10)}-${iidx}`} type="button"
                            className="w-full text-left text-sm px-2.5 py-1.5 rounded-md bg-[var(--accent)]/20 hover:bg-[var(--accent)]/30 truncate"
                            onClick={() => { setSelected(ev); setOpenEventDialog(true) }}>
                            <Badge variant="secondary" className="mr-1.5 max-w-[130px] truncate align-middle">{ev.ciudad || ''}</Badge>
                            {ev.nombre}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
                {calendarCells.every(c => !c.date || c.items.length === 0) && (
                  <div className="text-sm text-muted-foreground text-center py-6">No hay cursos programados este mes.</div>
                )}
              </div>
              {/* Calendario mensual en escritorio */}
              <div className="hidden md:grid grid-cols-7 gap-2 text-xs font-medium">
                {['D','L','M','X','J','V','S'].map(d => (<div key={d} className="text-center">{d}</div>))}
              </div>
              <div className="hidden md:grid grid-cols-7 gap-2">
                {calendarCells.map((c, idx) => (
                  <div key={idx} className="min-h-[120px] border rounded-md p-2">
                    {c.date ? (
                      <div className="text-xs font-semibold">{c.date.getDate()}</div>
                    ) : (
                      <div className="text-xs opacity-50">·</div>
                    )}
                    <div className="mt-1 space-y-1">
                      {c.items.slice(0,3).map((ev, iidx) => {
                        const start = parseLocalDate(ev.fecha_inicio as string)
                        const end = parseLocalDate((ev.fecha_fin ?? ev.fecha_inicio) as string)
                        const day = c.date as Date
                        const isStart = !!(start && day && sameDate(start, day))
                        const isEnd = !!(end && day && sameDate(end, day))
                        const isMiddle = !!(start && end && day && day > start && day < end)
                        const isSingle = !!(start && end && sameDate(start, end))
                        const base = 'bg-[var(--accent)]/20'
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
                          <div key={`${ev.id}-${String(ev.fecha_inicio).slice(0,10)}-${iidx}`} className={`text-xs truncate cursor-pointer px-2 py-0.5 w-full ${base} ${ribbon}`} onClick={() => { setSelected(ev); setOpenEventDialog(true) }}>
                            <Badge variant="secondary" className="mr-1 max-w-[110px] truncate align-middle">{ev.ciudad || ''}</Badge>
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
            </div>
          ) : null}
          {agendaView === 'lista' && (
          <div className="space-y-2">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-sm">Estado</span>
              <Select value={estadoCursoFilter} onValueChange={(val) => setEstadoCursoFilter(val as 'todos' | 'activo' | 'pendiente' | 'cancelado')}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Estado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {proximosFiltered.map(c => (
              <div key={c.id} className={`flex items-center justify-between gap-2 p-2 border rounded cursor-pointer ${selected?.id === c.id ? 'bg-primary-50 dark:bg-neutral-800' : ''}`} onClick={() => setSelected(c)}>
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{c.codigo_curso} · {c.nombre}</div>
                  <div className="text-sm truncate">{c.ciudad || '-'} · {fechaCorta(c.fecha_inicio)} – {fechaCorta(c.fecha_fin)} · Precio: {fmtMXN.format(Number((c.precio_promocional ?? c.precio_base ?? 0) || 0))}</div>
                  
                </div>
                <Badge variant="outline" className="shrink-0 capitalize">{c.estado === 'en_espera' ? 'pendiente' : c.estado}</Badge>
              </div>
            ))}
            {proximosFiltered.length === 0 && (
              <div className="text-sm">No hay cursos próximos agendados.</div>
            )}
          </div>
          )}
        </CardContent>
      </Card>

      {selected && (
        <Card id="editar-curso">
          <CardHeader><CardTitle>Editar curso</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm">Ciudad</label>
                  <Input value={selected.ciudad || ''} onChange={(e) => setSelected(prev => prev ? { ...prev, ciudad: e.target.value } : prev)} />
                </div>
                <div>
                  <label className="text-sm">Empresa</label>
                  <Input value={selected.empresa_contratante || ''} onChange={(e) => setSelected(prev => prev ? { ...prev, empresa_contratante: e.target.value } : prev)} />
                </div>
                <div>
                  <label className="text-sm">Estado</label>
                  <Select value={estadoEditar} onValueChange={(val) => setEstadoEditar(val as 'activo' | 'pendiente' | 'cancelado')}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Estado" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="activo">Activo</SelectItem>
                      <SelectItem value="pendiente">Pendiente</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm">Grupo (opcional)</label>
                  <Select value={String(selected.grupo_id || '')} onValueChange={(val) => setSelected(prev => prev ? { ...prev, grupo_id: val } : prev)}>
                    <SelectTrigger className="w-full"><SelectValue placeholder={grupos.length ? 'Selecciona grupo' : 'Registra grupos en Gestión'} /></SelectTrigger>
                    <SelectContent>
                      {grupos.map(g => (<SelectItem key={g.id} value={g.id}>{g.nombre}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm">Fecha inicio</label>
                  <Input type="date" value={selected.fecha_inicio ? String(selected.fecha_inicio).slice(0,10) : ''} onChange={(e) => setSelected(prev => prev ? { ...prev, fecha_inicio: e.target.value } : prev)} />
                </div>
                <div>
                  <label className="text-sm">Fecha fin</label>
                  <Input type="date" value={selected.fecha_fin ? String(selected.fecha_fin).slice(0,10) : ''} onChange={(e) => setSelected(prev => prev ? { ...prev, fecha_fin: e.target.value } : prev)} />
                </div>
                <div>
                  <label className="text-sm">Precio normal</label>
                  <Input type="number" step="0.01" value={String(selected.precio_base ?? '')} onChange={(e) => setSelected(prev => prev ? { ...prev, precio_base: e.target.value ? Number(e.target.value) : undefined } : prev)} />
                </div>
                <div>
                  <label className="text-sm">Precio especial (opcional)</label>
                  <Input type="number" step="0.01" value={String(selected.precio_promocional ?? '')} onChange={(e) => setSelected(prev => prev ? { ...prev, precio_promocional: e.target.value ? Number(e.target.value) : null } : prev)} />
                </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={saveSelected}>Guardar</Button>
              <Button variant="outline" onClick={() => setSelected(null)}>Cancelar</Button>
            </div>
            {detalleError && (
              <Alert className="alert-error mt-3">{detalleError}</Alert>
            )}
            <div id="participantes-section" className="mt-8 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-lg font-semibold">Participantes</div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => aplicarPrecioGrupo('solo_vacios')}>Aplicar precio grupo (vacíos)</Button>
                  <Button variant="outline" onClick={() => aplicarPrecioGrupo('todos')}>Aplicar precio grupo (todos)</Button>
                  <Button variant="secondary" onClick={exportarCSV}>Exportar CSV</Button>
                </div>
              </div>
              {csvError && (<Alert className="alert-error mt-2">{csvError}</Alert>)}
              {precioGrupoError && (<Alert className="alert-error mt-2">{precioGrupoError}</Alert>)}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="cursor-pointer" onClick={() => setEstadoFilter('todos')}>Total {stats.total}</Badge>
                  <Badge variant={estadoFilter === 'pagado' ? 'secondary' : 'outline'} className="cursor-pointer" onClick={() => setEstadoFilter('pagado')}>Pagados {stats.pagados}</Badge>
                  <Badge variant={estadoFilter === 'pendiente' ? 'secondary' : 'outline'} className="cursor-pointer" onClick={() => setEstadoFilter('pendiente')}>Pendientes {stats.pendientes}</Badge>
                  <Badge variant={estadoFilter === 'anticipo' ? 'secondary' : 'outline'} className="cursor-pointer" onClick={() => setEstadoFilter('anticipo')}>Anticipos {stats.anticipos}</Badge>
                  <Badge variant={estadoFilter === 'cancelado' ? 'secondary' : 'outline'} className="cursor-pointer" onClick={() => setEstadoFilter('cancelado')}>Cancelados {stats.cancelados}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <ToggleGroup type="single" value={viewMode} onValueChange={(val) => val && setViewMode(val as 'tabla' | 'tarjetas')}>
                    <ToggleGroupItem value="tabla">Tabla</ToggleGroupItem>
                    <ToggleGroupItem value="tarjetas">Tarjetas</ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </div>
              {selected && (
                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle>{selected.nombre} · Constancias</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2 mb-2">
                      <Badge variant="outline">Activas {constanciasAsignadas.filter(a => { const acr = !!a.estado_acreditacion; const exp = a.fecha_expiracion ? new Date(String(a.fecha_expiracion)) : null; const t = new Date(); return acr && (!exp || exp >= new Date(t.getFullYear(), t.getMonth(), t.getDate())) }).length}</Badge>
                      <Badge variant="outline">Vencidas {constanciasAsignadas.filter(a => { const acr = !!a.estado_acreditacion; const exp = a.fecha_expiracion ? new Date(String(a.fecha_expiracion)) : null; const t = new Date(); return acr && (exp && exp < new Date(t.getFullYear(), t.getMonth(), t.getDate())) }).length}</Badge>
                      <Badge variant="outline">Pendientes {constanciasAsignadas.filter(a => !a.estado_acreditacion).length}</Badge>
                    </div>
                    <div className="space-y-3">
                      {constanciasCurso.map(cc => {
                        const asignadas = constanciasAsignadas.filter(a => a.constancia_id === cc.id)
                        const activas = asignadas.filter(a => { const acr = !!a.estado_acreditacion; const exp = a.fecha_expiracion ? new Date(String(a.fecha_expiracion)) : null; const t = new Date(); return acr && (!exp || exp >= new Date(t.getFullYear(), t.getMonth(), t.getDate())) }).length
                        const vencidas = asignadas.filter(a => { const acr = !!a.estado_acreditacion; const exp = a.fecha_expiracion ? new Date(String(a.fecha_expiracion)) : null; const t = new Date(); return acr && (exp && exp < new Date(t.getFullYear(), t.getMonth(), t.getDate())) }).length
                        const pendientes = asignadas.filter(a => !a.estado_acreditacion).length
                        return (
                          <div key={cc.id} className="border rounded p-2">
                            <div className="text-sm font-semibold">{cc.nombre}{cc.norma ? ` (${cc.norma})` : ''}</div>
                            <div className="text-xs mb-1">Activas {activas} · Vencidas {vencidas} · Pendientes {pendientes}</div>
                            {asignadas.map(a => (
                              <div key={a.id} className="text-xs">• {a.participante_nombre || '-'} · ID {String(a.id_certificado || '-')} · Código {String(a.codigo_validacion || '-')} · Emisión {a.fecha_emision_certificado ? String(a.fecha_emision_certificado).slice(0,10) : '-'} · Expira {a.fecha_expiracion ? String(a.fecha_expiracion).slice(0,10) : '-'} · Estatus {(() => { const acr = !!a.estado_acreditacion; const exp = a.fecha_expiracion ? new Date(String(a.fecha_expiracion)) : null; const t = new Date(); if (!acr) return 'pendiente'; if (exp && exp < new Date(t.getFullYear(), t.getMonth(), t.getDate())) return 'vencido'; return 'activo' })()}</div>
                            ))}
                            {asignadas.length === 0 && <div className="text-xs">Sin constancias asignadas</div>}
                          </div>
                        )
                      })}
                      {constanciasCurso.length === 0 && (
                        <div className="text-xs">Sin constancias registradas para el curso</div>
                      )}
                    </div>
                    <div className="mt-4 space-y-2">
                      <div className="text-sm font-semibold">Registrar constancia</div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:items-end">
                        <label className="grid gap-1 text-xs font-medium text-muted-foreground">Nombre de constancia<Input placeholder="Nombre de constancia (ej. Espacios confinados)" value={nuevoConstanciaNombre} onChange={(e) => setNuevoConstanciaNombre(e.target.value)} /></label>
                        <label className="grid gap-1 text-xs font-medium text-muted-foreground">Norma/NOM (opcional)<Input placeholder="Norma/NOM (opcional)" value={nuevoConstanciaNorma} onChange={(e) => setNuevoConstanciaNorma(e.target.value)} /></label>
                        <Button onClick={async () => { if (!selected) return; setConstanciaError(''); const nombre = nuevoConstanciaNombre.trim(); const norma = nuevoConstanciaNorma.trim(); if (!nombre) { setConstanciaError('Ingresa un nombre de constancia'); return } try { await apiRequest(`/clientes/cursos/${selected.id}/constancias`, { method: 'POST', body: JSON.stringify({ nombre, norma: norma || undefined }) }); setNuevoConstanciaNombre(''); setNuevoConstanciaNorma(''); await loadConstanciasCurso(); setConstanciaError(''); } catch (e) { setConstanciaError((e as Error)?.message || 'No se pudo registrar la constancia') } }}>Registrar constancia</Button>
                      </div>
                      {constanciaError && (<Alert className="alert-error">{constanciaError}</Alert>)}
                    </div>
                  </CardContent>
                </Card>
              )}
              <div className="rounded-2xl border bg-muted/20 p-4 sm:p-6">
                <div className="mb-5 flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500 text-white"><UserPlusIcon className="h-4 w-4" /></span>
                  <div>
                    <h3 className="text-sm font-semibold">Agregar participante al curso</h3>
                    <p className="text-xs text-muted-foreground">Se registra y queda inscrito en {selected?.nombre || 'este curso'}.</p>
                  </div>
                </div>
                <form noValidate className="space-y-6" onSubmit={(e) => { e.preventDefault(); if (!agregando) crearParticipante() }}>
                  <FormStep n={1} title="Nombre">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Field label={<>Nombres<span className="ml-0.5 text-orange-500">*</span></>} htmlFor="np_nombres">
                        <Input id="np_nombres" autoComplete="given-name" placeholder="Nombre(s)" value={String(nuevoPart.nombres ?? '')} onChange={(e) => { setNuevoPart(s => ({ ...s, nombres: e.target.value })); if (participanteError) setParticipanteError('') }} />
                      </Field>
                      <Field label={<>Apellido paterno</>} htmlFor="np_apellido_paterno">
                        <Input id="np_apellido_paterno" autoComplete="family-name" placeholder="" value={String(nuevoPart.apellido_paterno ?? '')} onChange={(e) => { setNuevoPart(s => ({ ...s, apellido_paterno: e.target.value })); if (participanteError) setParticipanteError('') }} />
                      </Field>
                      <Field label={<>Apellido materno</>} htmlFor="np_apellido_materno">
                        <Input id="np_apellido_materno" placeholder="" value={String(nuevoPart.apellido_materno ?? '')} onChange={(e) => { setNuevoPart(s => ({ ...s, apellido_materno: e.target.value })); if (participanteError) setParticipanteError('') }} />
                      </Field>
                    </div>
                  </FormStep>
                  <FormStep n={2} title="Contacto">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label={<>Correo<span className="ml-0.5 text-orange-500">*</span></>} htmlFor="np_correo">
                        <Input id="np_correo" type="email" inputMode="email" autoComplete="email" placeholder="nombre@empresa.com" value={String(nuevoPart.correo ?? '')} onChange={(e) => { setNuevoPart(s => ({ ...s, correo: e.target.value })); if (participanteError) setParticipanteError('') }} />
                      </Field>
                      <Field label={<>Teléfono</>} htmlFor="np_telefono">
                        <Input id="np_telefono" type="tel" inputMode="tel" autoComplete="tel" placeholder="10 dígitos" value={String(nuevoPart.telefono ?? '')} onChange={(e) => { setNuevoPart(s => ({ ...s, telefono: e.target.value })); if (participanteError) setParticipanteError('') }} />
                      </Field>
                    </div>
                  </FormStep>
                  <FormStep n={3} title="Trabajo">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <Field label={<>Empresa</>} htmlFor="np_empresa">
                        <Input id="np_empresa" autoComplete="organization" placeholder="" value={String(nuevoPart.empresa ?? '')} onChange={(e) => { setNuevoPart(s => ({ ...s, empresa: e.target.value })); if (participanteError) setParticipanteError('') }} />
                      </Field>
                      <Field label={<>Cargo</>} htmlFor="np_cargo">
                        <Input id="np_cargo" placeholder="" value={String(nuevoPart.cargo ?? '')} onChange={(e) => { setNuevoPart(s => ({ ...s, cargo: e.target.value })); if (participanteError) setParticipanteError('') }} />
                      </Field>
                      <Field label={<>Profesión</>} htmlFor="np_profesion">
                        <Input id="np_profesion" placeholder="" value={String(nuevoPart.profesion ?? '')} onChange={(e) => { setNuevoPart(s => ({ ...s, profesion: e.target.value })); if (participanteError) setParticipanteError('') }} />
                      </Field>
                      <Field label={<>Ciudad</>} htmlFor="np_ciudad_origen">
                        <Input id="np_ciudad_origen" placeholder="" value={String(nuevoPart.ciudad_origen ?? '')} onChange={(e) => { setNuevoPart(s => ({ ...s, ciudad_origen: e.target.value })); if (participanteError) setParticipanteError('') }} />
                      </Field>
                    </div>
                  </FormStep>
                  <FormStep n={4} title="Precio" desc="Se asigna como costo del participante en este curso.">
                    <Segmented
                      ariaLabel="Precio"
                      className="sm:w-fit"
                      value={(String(nuevoPart.precio_modo || 'normal') as 'normal' | 'descuento')}
                      onChange={(val) => { if (val === 'descuento' && selected?.precio_promocional == null) return; setNuevoPart(s => ({ ...s, precio_modo: val })) }}
                      options={[
                        { value: 'normal', label: <span>Normal <strong className="font-semibold">{fmtMXN.format(Number(selected?.precio_base || 0))}</strong></span> },
                        { value: 'descuento', label: <span className={selected?.precio_promocional == null ? 'opacity-50' : ''}>Especial <strong className="font-semibold">{fmtMXN.format(Number(selected?.precio_promocional ?? selected?.precio_base ?? 0))}</strong></span> },
                      ]}
                    />
                    {selected?.precio_promocional == null && <p className="mt-2 text-xs text-muted-foreground">Este curso no tiene precio especial.</p>}
                  </FormStep>
                  <div className="flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-h-5 text-sm" aria-live="polite">
                      {participanteError && <span role="alert" className="text-[var(--destructive)]">{participanteError}</span>}
                    </div>
                    <Button type="submit" disabled={agregando} className="transition-transform active:scale-[0.98]">
                      {agregando ? <><Loader2 className="h-4 w-4 animate-spin" /> Agregando…</> : <><UserPlusIcon className="h-4 w-4" /> Agregar participante</>}
                    </Button>
                  </div>
                </form>
              </div>
              <div className="text-xs text-muted-foreground">Los montos representan: Costo y Pagado. Saldo = Costo − Pagado.</div>
              <div className="space-y-3">
                {displayed.length > 0 ? (
                  viewMode === 'tabla' ? (
                    <>
                    <Table>
                      <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                          <TableRow key={headerGroup.id}>
                              {headerGroup.headers.map((header) => (
                              <TableHead key={header.id} colSpan={header.colSpan} className={(header.column.columnDef.meta && typeof header.column.columnDef.meta === 'object' ? (header.column.columnDef.meta as { className?: string }).className : '') || ''}>
                                {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                              </TableHead>
                            ))}
                          </TableRow>
                        ))}
                      </TableHeader>
                      <TableBody>
                        {table.getRowModel().rows.map((row) => (
                          <Fragment key={row.id}>
                            <TableRow>
                              {row.getVisibleCells().map((cell) => (
                                <TableCell key={cell.id} className={(cell.column.columnDef.meta && typeof cell.column.columnDef.meta === 'object' ? (cell.column.columnDef.meta as { className?: string }).className : '') || ''}>
                                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </TableCell>
                              ))}
                            </TableRow>
                            {openDetails[row.original.id] && (
                              <TableRow>
                                <TableCell colSpan={columnsCount}>
                                  <div className="space-y-2">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                      <label className="grid gap-1 text-xs font-medium text-muted-foreground">Monto (MXN)<Input type="number" step="0.01" placeholder="Monto (MXN)" value={String((nuevoPago[row.original.id]?.monto ?? ''))} onChange={(e) => setNuevoPago(prev => ({ ...prev, [row.original.id]: { ...(prev[row.original.id] || { monto: 0, metodo: 'efectivo', ref: '' }), monto: Number(e.target.value || 0) } }))} /></label>
                                      <Select value={String((nuevoPago[row.original.id]?.metodo ?? 'efectivo'))} onValueChange={(val) => setNuevoPago(prev => ({ ...prev, [row.original.id]: { ...(prev[row.original.id] || { monto: 0, metodo: 'efectivo', ref: '' }), metodo: val } }))}>
                                        <SelectTrigger className="w-full"><SelectValue placeholder="Método" /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="efectivo">efectivo</SelectItem>
                                          <SelectItem value="transferencia">transferencia</SelectItem>
                                          <SelectItem value="tarjeta">tarjeta</SelectItem>
                                          <SelectItem value="paypal">paypal</SelectItem>
                                          <SelectItem value="otro">otro</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <label className="grid gap-1 text-xs font-medium text-muted-foreground">Referencia<Input placeholder="Referencia" value={String((nuevoPago[row.original.id]?.ref ?? ''))} onChange={(e) => setNuevoPago(prev => ({ ...prev, [row.original.id]: { ...(prev[row.original.id] || { monto: 0, metodo: 'efectivo', ref: '' }), ref: e.target.value } }))} /></label>
                                    </div>
                                    <div className="flex gap-2">
                                      <Button variant="outline" onClick={() => savePrecio(row.original)}>Guardar precio</Button>
                                      <Button variant="secondary" onClick={() => registrarPago(row.original)}>Registrar pago</Button>
                                      
                                      <Button variant="ghost" onClick={() => verPagos(row.original)}>{openPagos[row.original.id] ? 'Ocultar pagos' : 'Ver pagos'}</Button>
                                    </div>
                                    {filaError[row.original.id] && (<Alert className="alert-error mt-2">{filaError[row.original.id]}</Alert>)}
                                    {openPagos[row.original.id] && (
                                      <div className="space-y-1">
                                        <div className="text-xs font-semibold">Pagos</div>
                                        {(pagosByCp[row.original.id] || []).map(pay => (
                                          <div key={pay.id} className="flex items-center justify-between text-xs">
                                            <div>{String(pay.fecha_pago).slice(0,10)} · {pay.metodo_pago} · {fmtMXN.format(Number(pay.monto || 0))} · {pay.estado_pago}</div>
                                          </div>
                                        ))}
                                        {(pagosByCp[row.original.id] || []).length === 0 && <div className="text-xs">Sin pagos registrados</div>}
                                      </div>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm">
                        Seleccionadas {table.getSelectedRowModel().rows.length} de {table.getPrePaginationRowModel().rows.length} · Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}>«</Button>
                        <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>‹</Button>
                        <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>›</Button>
                        <Button variant="outline" size="sm" onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()}>»</Button>
                        <Select value={String(table.getState().pagination.pageSize)} onValueChange={(val) => table.setPageSize(Number(val))}>
                          <SelectTrigger className="w-24"><SelectValue placeholder="Tamaño" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="10">10</SelectItem>
                            <SelectItem value="20">20</SelectItem>
                            <SelectItem value="30">30</SelectItem>
                            <SelectItem value="40">40</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    </>
                  ) : (
                    <div className="space-y-4">
                      {(['pendiente','anticipo','pagado','cancelado'] as const).map(gr => {
                        const list = displayed.filter(pp => String(pp.estado_pago || '').toLowerCase() === gr)
                        if (!list.length) return null
                        return (
                          <div key={gr} className="space-y-2">
                            <div className="text-sm font-semibold capitalize">{gr}</div>
                            <div className="grid-cards">
                              {list.map((p, idx) => {
                                const saldo = (Number(p.costo_asignado || 0) - Number(p.valor_pagado || 0)) || 0
                                const nombreCompleto = `${String(p.nombres ?? p.nombre ?? '').trim()} ${String(p.apellido_paterno ?? p.apellido ?? '').trim()} ${String(p.apellido_materno ?? '').trim()}`.trim()
                                const initials = (() => {
                                  const parts = nombreCompleto.split(/\s+/).filter(Boolean)
                                  const a = (parts[0]?.[0] || '') + (parts[1]?.[0] || '')
                                  return (a || 'P').toUpperCase()
                                })()
                                return (
                                  <div key={p.id} className="border rounded-md p-3 space-y-3">
                                    <div className="flex items-center gap-3">
                                      <Avatar className="h-10 w-10"><AvatarFallback>{initials}</AvatarFallback></Avatar>
                                      <div className="flex-1 min-w-0">
                                        <div className="font-medium truncate">{nombreCompleto || 'Sin nombre'}</div>
                                        <div className="text-xs text-muted-foreground truncate">{p.correo || 'Sin correo'}</div>
                                      </div>
                                      <Select value={p.estado_pago || 'pendiente'} onValueChange={(val) => setParticipantes(arr => { const a = [...arr]; a[idx] = { ...a[idx], estado_pago: val }; return a })}>
                                        <SelectTrigger className="w-28"><SelectValue placeholder="Estado pago" /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="pendiente">pendiente</SelectItem>
                                          <SelectItem value="anticipo">anticipo</SelectItem>
                                          <SelectItem value="pagado">pagado</SelectItem>
                                          <SelectItem value="cancelado">cancelado</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="text-xs">
                                      <span className="font-semibold">Certificado:</span> {String(p.id_certificado || '-')} · <span className="font-semibold">Código:</span> {String(p.codigo_validacion || '-')} · <span className="font-semibold">Emisión:</span> {p.fecha_emision_certificado ? String(p.fecha_emision_certificado).slice(0,10) : '-'} · <span className="font-semibold">Inicio vigencia:</span> {p.fecha_inicio_vigencia ? String(p.fecha_inicio_vigencia).slice(0,10) : '-'} · <span className="font-semibold">Expira:</span> {p.fecha_expiracion ? String(p.fecha_expiracion).slice(0,10) : '-'} · <span className="font-semibold">Estatus:</span> {(() => { const acr = !!p.estado_acreditacion; const exp = p.fecha_expiracion ? new Date(String(p.fecha_expiracion)) : null; const today = new Date(); if (!acr) return 'pendiente'; if (exp && exp < new Date(today.getFullYear(), today.getMonth(), today.getDate())) return 'vencido'; return 'activo' })()}
                                    </div>
                                    <div className="grid grid-cols-1 gap-2">
                                      <label className="grid gap-1 text-xs font-medium text-muted-foreground">Nombres<Input placeholder="Nombres" value={String(p.nombres ?? p.nombre ?? '')} onChange={(e) => setParticipantes(arr => { const a = [...arr]; a[idx] = { ...a[idx], nombres: e.target.value }; return a })} /></label>
                                      <label className="grid gap-1 text-xs font-medium text-muted-foreground">Apellido paterno<Input placeholder="Apellido paterno" value={String(p.apellido_paterno ?? '')} onChange={(e) => setParticipantes(arr => { const a = [...arr]; a[idx] = { ...a[idx], apellido_paterno: e.target.value }; return a })} /></label>
                                      <label className="grid gap-1 text-xs font-medium text-muted-foreground">Apellido materno<Input placeholder="Apellido materno" value={String(p.apellido_materno ?? '')} onChange={(e) => setParticipantes(arr => { const a = [...arr]; a[idx] = { ...a[idx], apellido_materno: e.target.value }; return a })} /></label>
                                      
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                      <label className="grid gap-1 text-xs font-medium text-muted-foreground">Ciudad<Input placeholder="Ciudad" value={p.ciudad_origen || ''} onChange={(e) => setParticipantes(arr => { const a = [...arr]; a[idx] = { ...a[idx], ciudad_origen: e.target.value }; return a })} /></label>
                                      <label className="grid gap-1 text-xs font-medium text-muted-foreground">Teléfono<Input placeholder="Teléfono" value={String(p.telefono ?? '')} onChange={(e) => setParticipantes(arr => { const a = [...arr]; a[idx] = { ...a[idx], telefono: e.target.value }; return a })} /></label>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                      <label className="grid gap-1 text-xs font-medium text-muted-foreground">Empresa<Input placeholder="Empresa" value={String(p.empresa ?? '')} onChange={(e) => setParticipantes(arr => { const a = [...arr]; a[idx] = { ...a[idx], empresa: e.target.value }; return a })} /></label>
                                      <label className="grid gap-1 text-xs font-medium text-muted-foreground">Cargo<Input placeholder="Cargo" value={String(p.cargo ?? '')} onChange={(e) => setParticipantes(arr => { const a = [...arr]; a[idx] = { ...a[idx], cargo: e.target.value }; return a })} /></label>
                                      <label className="grid gap-1 text-xs font-medium text-muted-foreground">Profesión<Input placeholder="Profesión" value={String(p.profesion ?? '')} onChange={(e) => setParticipantes(arr => { const a = [...arr]; a[idx] = { ...a[idx], profesion: e.target.value }; return a })} /></label>
                                    </div>
                                    
                                    <div className="flex flex-wrap gap-2">
                                      <Button onClick={() => saveParticipante(p)}>Guardar</Button>
                                      <Button variant="outline" onClick={() => savePrecio(p)}>Guardar precio</Button>
                                      <Button variant="secondary" onClick={() => registrarPago(p)}>Registrar pago</Button>
                                      
                                      <Button variant="destructive" onClick={() => deleteParticipante(p)}>Eliminar</Button>
                                      <Button variant="ghost" onClick={() => verPagos(p)}>{openPagos[p.id] ? 'Ocultar pagos' : 'Ver pagos'}</Button>
                                    </div>
                                    {filaError[p.id] && (<Alert className="alert-error">{filaError[p.id]}</Alert>)}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                      <label className="grid gap-1 text-xs font-medium text-muted-foreground">ID certificado<Input placeholder="ID certificado" value={String(p.id_certificado || '')} onChange={(e) => setParticipantes(arr => { const a = [...arr]; const i = a.findIndex(x => x.id === p.id); if (i !== -1) { a[i] = { ...a[i], id_certificado: e.target.value } } return a })} /></label>
                                      <label className="grid gap-1 text-xs font-medium text-muted-foreground">Código validación<Input placeholder="Código validación" value={String(p.codigo_validacion || '')} onChange={(e) => setParticipantes(arr => { const a = [...arr]; const i = a.findIndex(x => x.id === p.id); if (i !== -1) { a[i] = { ...a[i], codigo_validacion: e.target.value.toUpperCase() } } return a })} /></label>
                                      <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-2">
                                          <Checkbox checked={!!p.estado_acreditacion} onCheckedChange={(val) => setParticipantes(arr => { const a = [...arr]; const i = a.findIndex(x => x.id === p.id); if (i !== -1) { a[i] = { ...a[i], estado_acreditacion: !!val } } return a })} />
                                          <span className="text-sm">Acreditado</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <Checkbox checked={!!(p as any).habilitar_validacion} onCheckedChange={(val) => setParticipantes(arr => { const a = [...arr]; const i = a.findIndex(x => x.id === p.id); if (i !== -1) { a[i] = { ...a[i], habilitar_validacion: !!val } } return a })} />
                                          <span className="text-sm">Activar validación</span>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                      <label className="grid gap-1 text-xs font-medium text-muted-foreground">Emisión certificado<Input type="date" placeholder="Emisión certificado" value={String(p.fecha_emision_certificado || '')} onChange={(e) => setParticipantes(arr => { const a = [...arr]; const i = a.findIndex(x => x.id === p.id); if (i !== -1) { a[i] = { ...a[i], fecha_emision_certificado: e.target.value } } return a })} /></label>
                                      <label className="grid gap-1 text-xs font-medium text-muted-foreground">Expiración certificado<Input type="date" placeholder="Expiración certificado" value={String(p.fecha_expiracion || '')} onChange={(e) => setParticipantes(arr => { const a = [...arr]; const i = a.findIndex(x => x.id === p.id); if (i !== -1) { a[i] = { ...a[i], fecha_expiracion: e.target.value } } return a })} /></label>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                                      <Select value={String(nuevoAsignacion[p.id]?.constancia_id || '')} onValueChange={(val) => setNuevoAsignacion(prev => ({ ...prev, [p.id]: { ...(prev[p.id] || {}), constancia_id: val } }))}>
                                        <SelectTrigger className="w-full"><SelectValue placeholder="Constancia del curso" /></SelectTrigger>
                                        <SelectContent>
                                          {constanciasCurso.map(c => (<SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>))}
                                        </SelectContent>
                                      </Select>
                                      
                                      <div className="flex items-center gap-2">
                                        <Checkbox checked={!!nuevoAsignacion[p.id]?.estado_acreditacion} onCheckedChange={(val) => setNuevoAsignacion(prev => ({ ...prev, [p.id]: { ...(prev[p.id] || {}), estado_acreditacion: !!val } }))} />
                                        <span className="text-sm">Acreditado</span>
                                      </div>
                                      <Button onClick={async () => { if (!selected) return; const data = nuevoAsignacion[p.id] || {}; const constancia_id = data.constancia_id; if (!constancia_id) { setFilaError(prev => ({ ...prev, [p.id]: 'Selecciona una constancia del curso' })); return } const payload: Record<string, unknown> = { constancia_id }; if (typeof data.estado_acreditacion !== 'undefined') payload.estado_acreditacion = !!data.estado_acreditacion; try { await apiRequest(`/clientes/cursos/${selected.id}/participantes/${p.id}/constancias`, { method: 'POST', body: JSON.stringify(payload) }); setNuevoAsignacion(prev => ({ ...prev, [p.id]: {} })); await loadConstanciasAsignadas(); setFilaError(prev => { const nx = { ...prev }; delete nx[p.id]; return nx }) } catch (e) { setFilaError(prev => ({ ...prev, [p.id]: (e as Error)?.message || 'No se pudo asignar la constancia' })) } }}>Asignar constancia</Button>
                                      <Button variant="secondary" disabled={!p.estado_acreditacion} onClick={async () => { try { const token = localStorage.getItem('aaces_token'); const res = await fetch('/api/v1/constancias/emitir', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ curso_participante_id: p.id }) }); if (!res.ok) { const err = await res.json(); throw new Error(err.detail || 'Error al emitir') } const data = await res.json(); const doc = data.documento; const dl = await fetch(doc.descarga_url, { headers: { Authorization: `Bearer ${token}` } }); if (dl.ok) { const blob = await dl.blob(); const url = URL.createObjectURL(blob); window.open(url, '_blank'); } toast.success('Constancia emitida correctamente'); await loadConstanciasAsignadas(); } catch (e) { toast.error((e as Error)?.message || 'Error al emitir constancia') } }}>
                                        Emitir constancia
                                      </Button>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 items-center">
                                      <div className="md:col-span-2">
                                        <ToggleGroup type="single" value={(() => { const vb = Number(selected?.precio_base ?? 0); const vp = selected?.precio_promocional != null ? Number(selected?.precio_promocional ?? 0) : null; const cur = Number(p.costo_asignado || 0); if (vp != null && cur === vp) return 'descuento'; if (cur === vb) return 'normal'; return 'normal' })()} onValueChange={(val) => val && setParticipantes(arr => { const a = [...arr]; a[idx] = { ...a[idx], costo_asignado: val === 'descuento' ? Number(selected?.precio_promocional ?? selected?.precio_base ?? 0) : Number(selected?.precio_base ?? selected?.precio_promocional ?? 0), descuento: 0 }; return a })}>
                                          <ToggleGroupItem value="normal">Normal {fmtMXN.format(Number(selected?.precio_base || 0))}</ToggleGroupItem>
                                          <ToggleGroupItem value="descuento" disabled={selected?.precio_promocional == null}>Descuento {fmtMXN.format(Number(selected?.precio_promocional ?? selected?.precio_base ?? 0))}</ToggleGroupItem>
                                        </ToggleGroup>
                                      </div>
                                      <label className="grid gap-1 text-xs font-medium text-muted-foreground">Costo<Input type="number" step="0.01" placeholder="Costo" value={String(p.costo_asignado ?? '')} onChange={(e) => setParticipantes(arr => { const a = [...arr]; a[idx] = { ...a[idx], costo_asignado: Number(e.target.value || 0) }; return a })} /></label>
                                      
                                      <div className="text-sm text-right md:text-left">{fmtMXN.format(Number(p.valor_pagado || 0))}</div>
                                      <div className="text-sm font-medium text-right md:text-left">{fmtMXN.format(saldo)}</div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                      <label className="grid gap-1 text-xs font-medium text-muted-foreground">Monto (MXN)<Input type="number" step="0.01" placeholder="Monto (MXN)" value={String((nuevoPago[p.id]?.monto ?? ''))} onChange={(e) => setNuevoPago(prev => ({ ...prev, [p.id]: { ...(prev[p.id] || { monto: 0, metodo: 'efectivo', ref: '' }), monto: Number(e.target.value || 0) } }))} /></label>
                                      <Select value={String((nuevoPago[p.id]?.metodo ?? 'efectivo'))} onValueChange={(val) => setNuevoPago(prev => ({ ...prev, [p.id]: { ...(prev[p.id] || { monto: 0, metodo: 'efectivo', ref: '' }), metodo: val } }))}>
                                        <SelectTrigger className="w-full"><SelectValue placeholder="Método" /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="efectivo">efectivo</SelectItem>
                                          <SelectItem value="transferencia">transferencia</SelectItem>
                                          <SelectItem value="tarjeta">tarjeta</SelectItem>
                                          <SelectItem value="paypal">paypal</SelectItem>
                                          <SelectItem value="otro">otro</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <label className="grid gap-1 text-xs font-medium text-muted-foreground">Referencia<Input placeholder="Referencia" value={String((nuevoPago[p.id]?.ref ?? ''))} onChange={(e) => setNuevoPago(prev => ({ ...prev, [p.id]: { ...(prev[p.id] || { monto: 0, metodo: 'efectivo', ref: '' }), ref: e.target.value } }))} /></label>
                                    </div>
                                    <div className="text-xs">
                                      <span className="font-semibold">Programa:</span> {selected?.nombre || '-'} · <span className="font-semibold">Proveedor:</span> {selected?.empresa_contratante || '-'} · <span className="font-semibold">Fecha curso:</span> {selected?.fecha_inicio ? String(selected.fecha_inicio).slice(0,10) : '-'} · <span className="font-semibold">Expira:</span> {p.fecha_expiracion ? String(p.fecha_expiracion).slice(0,10) : '-'} · <span className="font-semibold">Estatus:</span> {(() => { const acr = !!p.estado_acreditacion; const exp = p.fecha_expiracion ? new Date(String(p.fecha_expiracion)) : null; const today = new Date(); if (!acr) return 'pendiente'; if (exp && exp < new Date(today.getFullYear(), today.getMonth(), today.getDate())) return 'vencido'; return 'activo' })()}
                                    </div>
                                    {openPagos[p.id] && (
                                      <div className="space-y-1">
                                        <div className="text-xs font-semibold">Pagos</div>
                                        {(pagosByCp[p.id] || []).map(pay => (
                                          <div key={pay.id} className="flex items-center justify-between text-xs">
                                            <div>{String(pay.fecha_pago).slice(0,10)} · {pay.metodo_pago} · {fmtMXN.format(Number(pay.monto || 0))} · {pay.estado_pago}</div>
                                          </div>
                                        ))}
                                        {(pagosByCp[p.id] || []).length === 0 && <div className="text-xs">Sin pagos registrados</div>}
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                ) : (
                  <div className="text-sm">Sin participantes inscritos</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
    </Suspense>
  )
}
