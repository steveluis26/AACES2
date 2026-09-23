'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, Button, Input } from '@/components/ui'
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { FormStep } from '@/components/forms/form-bits'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { toast } from 'sonner'
import { AlertTriangle, Building2, ChevronRight, Loader2, Mail, Phone, Search, UserPlus, Users, X } from 'lucide-react'
import { Field } from '@/components/ui/field'
import { apiRequest } from '@/app/services/api'

type ParticipanteListado = {
  id: string
  pax_id: string
  nombre: string
  correo: string | null
  telefono: string | null
  empresa: string | null
  cargo: string | null
  fecha_creacion: string | null
}

export default function ParticipantesPage() {
  const router = useRouter()
  const [participantes, setParticipantes] = useState<ParticipanteListado[]>([])
  const [q, setQ] = useState('')
  const [showForm, setShowForm] = useState(false)

  const [nombre, setNombre] = useState('')
  const [correo, setCorreo] = useState('')
  const [telefono, setTelefono] = useState('')
  const [empresa, setEmpresa] = useState('')
  const [cargo, setCargo] = useState('')
  const [ciudadOrigen, setCiudadOrigen] = useState('')

  const [duplicados, setDuplicados] = useState<{ id: string; pax_id: string; nombre: string; correo: string; score: number }[]>([])
  const [creando, setCreando] = useState(false)
  const [crearError, setCrearError] = useState('')

  const [cargando, setCargando] = useState(true)
  const [empresaFiltro, setEmpresaFiltro] = useState('todas')
  const reduce = useReducedMotion()

  const load = useCallback(async (query = '') => {
    try {
      const data = await apiRequest<ParticipanteListado[]>(`/participantes?q=${encodeURIComponent(query)}`)
      setParticipantes(Array.isArray(data) ? data : [])
    } catch { setParticipantes([]) } finally { setCargando(false) }
  }, [])

  // Búsqueda con espera corta: antes se llamaba al servidor en cada tecla.
  useEffect(() => {
    const t = setTimeout(() => load(q), q ? 250 : 0)
    return () => clearTimeout(t)
  }, [q, load])

  const buscarDuplicados = async (): Promise<typeof duplicados> => {
    try {
      const params = new URLSearchParams()
      if (nombre) params.set('nombre', nombre)
      if (correo) params.set('correo', correo)
      if (telefono) params.set('telefono', telefono)
      const data = await apiRequest<{ posibles_duplicados: typeof duplicados }>(`/participantes/posibles-duplicados?${params}`)
      const found = data.posibles_duplicados?.filter(d => d.score >= 50) ?? []
      setDuplicados(found)
      return found
    } catch { setDuplicados([]); return [] }
  }

  // Si hay posibles duplicados se detiene y deja decidir.
  const guardar = async (forzar = false) => {
    if (!nombre.trim()) { setCrearError('Escribe el nombre completo'); return }
    if (!forzar) {
      setCreando(true)
      const found = await buscarDuplicados()
      setCreando(false)
      if (found.length > 0) return
    }
    crear()
  }

  const crear = async () => {
    if (!nombre.trim()) return
    setCreando(true)
    setCrearError('')
    try {
      const result = await apiRequest<{ id: string; pax_id: string }>('/participantes', {
        method: 'POST',
        body: JSON.stringify({ nombre, correo, telefono, empresa, cargo, ciudad_origen: ciudadOrigen }),
      })
      setShowForm(false)
      resetForm()
      setDuplicados([])
      toast.success('Participante registrado', { description: result.pax_id })
      load(q)
      router.push(`/cliente/participantes/${result.id}`)
    } catch (e) {
      setCrearError((e as Error)?.message || 'Error al crear participante')
    } finally { setCreando(false) }
  }

  const resetForm = () => {
    setNombre(''); setCorreo(''); setTelefono(''); setEmpresa(''); setCargo(''); setCiudadOrigen('')
    setCrearError(''); setDuplicados([])
  }

  const abrirNuevo = () => { resetForm(); setShowForm(true) }
  const empresas = Array.from(new Set(participantes.map(p => (p.empresa || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es'))
  const visibles = participantes.filter(p => empresaFiltro === 'todas' || (p.empresa || '').trim() === empresaFiltro)
  const iniciales = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '?'
  // Color estable por persona para el avatar
  const PALETA = ['bg-orange-100 text-orange-700', 'bg-blue-100 text-blue-700', 'bg-green-100 text-green-700', 'bg-purple-100 text-purple-700', 'bg-amber-100 text-amber-700', 'bg-pink-100 text-pink-700']
  const colorDe = (id: string) => PALETA[id.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % PALETA.length]
  const fila = (i: number) => reduce ? {} : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.3, delay: Math.min(i, 12) * 0.03 } }
  const cambiaDatoClave = () => { if (duplicados.length) setDuplicados([]); if (crearError) setCrearError('') }

  return (
    <div className="space-y-6 px-4 py-4 lg:px-6 lg:py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Participantes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {cargando ? 'Cargando…' : `${participantes.length} ${participantes.length === 1 ? 'participante registrado' : 'participantes registrados'}`}
          </p>
        </div>
        <Button onClick={abrirNuevo} className="transition-transform active:scale-[0.98]">
          <UserPlus className="h-4 w-4" /> Nuevo participante
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Buscar participantes" placeholder="Buscar por nombre, correo, teléfono o empresa" value={q} onChange={e => setQ(e.target.value)} className="pl-9 pr-9" />
          {q && (
            <button type="button" onClick={() => setQ('')} aria-label="Limpiar búsqueda" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {empresas.length > 1 && (
          <Select value={empresaFiltro} onValueChange={setEmpresaFiltro}>
            <SelectTrigger aria-label="Filtrar por empresa" className="w-full sm:w-60">
              <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las empresas</SelectItem>
              {empresas.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {cargando ? (
            <div className="divide-y">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-3 p-4">
                  <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
                  <div className="flex-1 space-y-2"><div className="h-3 w-1/3 animate-pulse rounded bg-muted" /><div className="h-3 w-1/4 animate-pulse rounded bg-muted" /></div>
                </div>
              ))}
            </div>
          ) : visibles.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-500"><Users className="h-6 w-6" /></span>
              <div>
                <p className="font-medium">{q || empresaFiltro !== 'todas' ? 'Sin resultados' : 'Aún no hay participantes'}</p>
                <p className="mt-1 text-sm text-muted-foreground">{q ? `No encontramos coincidencias con “${q}”.` : empresaFiltro !== 'todas' ? 'No hay participantes de esa empresa.' : 'Registra a los trabajadores que tomarán tus cursos.'}</p>
              </div>
              {!q && empresaFiltro === 'todas' && <Button onClick={abrirNuevo}><UserPlus className="h-4 w-4" /> Registrar el primero</Button>}
            </div>
          ) : (
            <>
              {/* Móvil: lista */}
              <ul className="divide-y md:hidden">
                {visibles.map((p, i) => (
                  <motion.li key={p.id} {...fila(i)}>
                    <Link href={`/cliente/participantes/${p.id}`} className="flex items-center gap-3 p-4 transition-colors hover:bg-muted/50 active:bg-muted">
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${colorDe(p.id)}`}>{iniciales(p.nombre)}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{p.nombre}</div>
                        <div className="truncate text-xs text-muted-foreground">{[p.empresa, p.cargo].filter(Boolean).join(' · ') || p.correo || 'Sin datos de contacto'}</div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </Link>
                  </motion.li>
                ))}
              </ul>
              {/* Escritorio: tabla */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Participante</TableHead>
                      <TableHead>Contacto</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead className="w-10"><span className="sr-only">Abrir</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibles.map((p, i) => (
                      <motion.tr
                        key={p.id}
                        {...fila(i)}
                        className="group cursor-pointer border-b transition-colors hover:bg-orange-50/50 dark:hover:bg-orange-500/5"
                        onClick={() => router.push(`/cliente/participantes/${p.id}`)}
                      >
                        <TableCell className="pl-6">
                          <div className="flex items-center gap-3">
                            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${colorDe(p.id)}`}>{iniciales(p.nombre)}</span>
                            <div className="min-w-0">
                              <Link href={`/cliente/participantes/${p.id}`} onClick={e => e.stopPropagation()} className="font-medium hover:text-orange-500">{p.nombre}</Link>
                              {p.cargo && <div className="text-xs text-muted-foreground">{p.cargo}</div>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5 text-sm">
                            {p.correo ? <div className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-muted-foreground" />{p.correo}</div> : <span className="text-muted-foreground">—</span>}
                            {p.telefono && <div className="flex items-center gap-1.5 text-muted-foreground"><Phone className="h-3.5 w-3.5" />{p.telefono}</div>}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{p.empresa || <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell><span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">{p.pax_id}</span></TableCell>
                        <TableCell><ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-orange-500" /></TableCell>
                      </motion.tr>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Panel lateral: nuevo participante */}
      <Sheet open={showForm} onOpenChange={(o) => { setShowForm(o); if (!o) setDuplicados([]) }}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
          <form noValidate className="flex h-full flex-col" onSubmit={(e) => { e.preventDefault(); if (!creando) guardar() }}>
            <SheetHeader className="border-b px-6 py-5 text-left">
              <SheetTitle>Nuevo participante</SheetTitle>
              <SheetDescription>Revisamos posibles duplicados antes de guardar.</SheetDescription>
            </SheetHeader>
            <div className="flex-1 space-y-8 overflow-y-auto px-6 py-6">
              <FormStep n={1} title="Datos personales">
                <Field label="Nombre completo" htmlFor="p_nombre" required error={crearError && !nombre.trim() ? crearError : undefined}>
                  <Input id="p_nombre" autoFocus autoComplete="name" placeholder="Nombre(s) y apellidos" value={nombre} onChange={e => { setNombre(e.target.value); cambiaDatoClave() }} />
                </Field>
              </FormStep>

              <FormStep n={2} title="Contacto" desc="Para enviarle su constancia y avisos de vencimiento.">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Correo" htmlFor="p_correo">
                    <Input id="p_correo" type="email" inputMode="email" autoComplete="email" placeholder="nombre@empresa.com" value={correo} onChange={e => { setCorreo(e.target.value); cambiaDatoClave() }} />
                  </Field>
                  <Field label="Teléfono" htmlFor="p_tel">
                    <Input id="p_tel" type="tel" inputMode="tel" autoComplete="tel" placeholder="10 dígitos" value={telefono} onChange={e => { setTelefono(e.target.value); cambiaDatoClave() }} />
                  </Field>
                </div>
              </FormStep>

              <FormStep n={3} title="Trabajo">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Empresa" htmlFor="p_empresa" hint={empresas.length ? 'Elige una existente o escribe una nueva.' : undefined} className="sm:col-span-2">
                    <Input id="p_empresa" list="empresas-existentes" autoComplete="organization" value={empresa} onChange={e => setEmpresa(e.target.value)} />
                    <datalist id="empresas-existentes">{empresas.map(e => <option key={e} value={e} />)}</datalist>
                  </Field>
                  <Field label="Cargo" htmlFor="p_cargo">
                    <Input id="p_cargo" autoComplete="organization-title" placeholder="Ej. Supervisor de seguridad" value={cargo} onChange={e => setCargo(e.target.value)} />
                  </Field>
                  <Field label="Ciudad" htmlFor="p_ciudad">
                    <Input id="p_ciudad" autoComplete="address-level2" value={ciudadOrigen} onChange={e => setCiudadOrigen(e.target.value)} />
                  </Field>
                </div>
              </FormStep>

              <AnimatePresence>
                {duplicados.length > 0 && (
                  <motion.div
                    role="alert"
                    initial={reduce ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduce ? undefined : { opacity: 0, y: 8 }}
                    className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10"
                  >
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                      <div className="min-w-0 flex-1 space-y-3">
                        <div>
                          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Este participante podría ya existir</p>
                          <p className="text-xs text-amber-800/80 dark:text-amber-200/70">Revisa las coincidencias antes de crear uno nuevo.</p>
                        </div>
                        <ul className="space-y-2">
                          {duplicados.map(d => (
                            <li key={d.id} className="flex items-center gap-3 rounded-lg border bg-background p-2.5">
                              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${colorDe(d.id)}`}>{iniciales(d.nombre)}</span>
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-medium">{d.nombre}</div>
                                <div className="truncate text-xs text-muted-foreground">{d.correo || 'Sin correo'} · {d.pax_id}</div>
                              </div>
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">{d.score}%</span>
                              <Button type="button" size="sm" variant="outline" onClick={() => router.push(`/cliente/participantes/${d.id}`)}>Ver</Button>
                            </li>
                          ))}
                        </ul>
                        <Button type="button" size="sm" variant="ghost" className="h-auto whitespace-normal px-2 py-1 text-left" onClick={() => guardar(true)} disabled={creando}>
                          No es la misma persona, crear de todos modos
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <SheetFooter className="flex-row flex-wrap items-center gap-2 border-t bg-background px-6 py-4 sm:justify-end">
              {crearError && nombre.trim() && <p role="alert" className="w-full text-sm text-[var(--destructive)] sm:mr-auto sm:w-auto">{crearError}</p>}
              <Button type="button" variant="outline" className="flex-1 sm:flex-none" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button type="submit" className="flex-1 sm:flex-none" disabled={creando}>
                {creando ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando…</> : 'Guardar participante'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  )
}
