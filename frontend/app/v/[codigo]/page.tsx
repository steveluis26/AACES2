"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import {
  AlertTriangle, BadgeCheck, CalendarClock, Check, CheckCircle2, Clock, Copy, Loader2, Printer, QrCode,
  Search, Share2, ShieldAlert, ShieldCheck, XCircle,
} from "lucide-react"

// ---------- Tipos ----------
type Certificado = {
  valido: boolean
  estado: "vigente" | "vencido" | "no_acreditado"
  id_certificado: string | null
  codigo_validacion: string | null
  participante: { nombre: string }
  curso: { nombre: string; codigo: string | null; fecha_inicio: string | null; fecha_fin: string | null; duracion_horas: number | null; modalidad: string | null; ciudad: string | null }
  fecha_emision: string | null
  fecha_expiracion: string | null
  calificacion: number | null
  constancias: { nombre: string; norma: string | null }[]
  capacitador: {
    nombre: string | null; razon_social: string | null; logo_url: string | null; stps_registro: string | null
    stps_verificado?: boolean; stps_rfc?: string | null; stps_origen?: string | null; stps_consultado_en?: string | null; stps_fuente?: string
  }
  congruencia?: { fuente: string; curso_registrado: boolean; curso_stps_nombre: string | null; instructor: string | null; instructor_en_plantilla: boolean } | null
  empresa: string | null
  verificaciones: number
}

// Documentos del motor nuevo (código UUID)
type Documento = {
  valida: boolean
  codigo_validacion: string
  tipo_documento: string
  estatus: string
  fecha_emision?: string | null
  organizacion?: string | null
  participante?: { nombre: string } | null
  curso?: { nombre: string; duracion_horas?: number; expiracion?: string | null } | null
  verificaciones_count: number
}

const EASE = [0.22, 1, 0.36, 1] as const
const esUUID = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
const fecha = (v?: string | null) => {
  if (!v) return null
  const s = String(v)
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + "T00:00:00") : new Date(s)
  return isNaN(d.getTime()) ? null : d
}
const corta = (v?: string | null) => fecha(v)?.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" }) ?? "—"
const larga = (v?: string | null) => fecha(v)?.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" }) ?? "—"

const ESTADOS = {
  vigente: {
    titulo: "Certificado verificado",
    texto: "Esta constancia es auténtica y se encuentra vigente.",
    icono: ShieldCheck,
    sello: "bg-green-600 shadow-green-600/30",
    halo: "bg-green-500/20",
    pill: "CERTIFICACIÓN VERIFICADA",
    pillCls: "border-green-200 bg-green-50 text-green-700",
    estado: "text-green-700",
  },
  vencido: {
    titulo: "Certificado vencido",
    texto: "Esta constancia es auténtica, pero su vigencia ya terminó.",
    icono: CalendarClock,
    sello: "bg-amber-500 shadow-amber-500/30",
    halo: "bg-amber-400/20",
    pill: "CERTIFICACIÓN VENCIDA",
    pillCls: "border-amber-200 bg-amber-50 text-amber-700",
    estado: "text-amber-600",
  },
  no_acreditado: {
    titulo: "Participante no acreditado",
    texto: "El participante está registrado en el curso, pero no ha sido acreditado.",
    icono: ShieldAlert,
    sello: "bg-red-600 shadow-red-600/30",
    halo: "bg-red-500/20",
    pill: "NO ACREDITADO",
    pillCls: "border-red-200 bg-red-50 text-red-700",
    estado: "text-red-600",
  },
} as const

export default function VerificarCodigoPage({ params }: { params: { codigo: string } }) {
  const codigo = decodeURIComponent(params.codigo)
  const reduce = useReducedMotion()
  const [cert, setCert] = useState<Certificado | null>(null)
  const [doc, setDoc] = useState<Documento | null>(null)
  const [loading, setLoading] = useState(true)
  const [noEncontrado, setNoEncontrado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [qr, setQr] = useState<string>("")
  const [url, setUrl] = useState("")
  const [copiado, setCopiado] = useState(false)
  const [ahora] = useState(() => new Date())

  useEffect(() => {
    let vivo = true
    setUrl(window.location.href.split("#")[0])
    ;(async () => {
      try {
        const res = await fetch(esUUID(codigo) ? `/api/v1/verificaciones/${codigo}` : `/api/v1/public/certificado/${encodeURIComponent(codigo)}`)
        if (res.status === 404 || res.status === 400) { if (vivo) setNoEncontrado(true); return }
        if (res.status === 429) { if (vivo) setError("Se hicieron demasiadas consultas con códigos no válidos desde esta conexión. Espera unos minutos e intenta de nuevo."); return }
        if (!res.ok) { if (vivo) setError("No pudimos verificar el documento en este momento."); return }
        const json = await res.json()
        if (!vivo) return
        if (esUUID(codigo)) setDoc(json)
        else setCert(json)
      } catch {
        if (vivo) setError("Error de conexión al verificar. Intenta de nuevo.")
      } finally {
        if (vivo) setLoading(false)
      }
    })()
    return () => { vivo = false }
  }, [codigo])

  // QR con la dirección de esta misma página
  useEffect(() => {
    if (!url) return
    import("qrcode").then((q) => q.toDataURL(url, { width: 360, margin: 1, errorCorrectionLevel: "M" }).then(setQr)).catch(() => {})
  }, [url])

  const compartir = async () => {
    const titulo = cert ? `Certificado de ${cert.participante.nombre}` : "Verificación AACES"
    try {
      if (navigator.share) { await navigator.share({ title: titulo, url }); return }
    } catch { return }
    try { await navigator.clipboard.writeText(url); setCopiado(true); setTimeout(() => setCopiado(false), 2000) } catch {}
  }

  // ---------- Cargando ----------
  if (loading) {
    return (
      <Contenedor>
        <div className="flex flex-col items-center gap-4 py-24 text-center">
          <div className="relative flex h-20 w-20 items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-orange-500/15 motion-safe:animate-ping" />
            <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-orange-500 text-white shadow-lg shadow-orange-500/30">
              <QrCode className="h-7 w-7" />
            </span>
          </div>
          <p className="font-medium">Verificando certificado…</p>
          <p className="font-mono text-sm text-muted-foreground">{codigo}</p>
        </div>
      </Contenedor>
    )
  }

  // ---------- No encontrado / error ----------
  if (noEncontrado || error || (!cert && !doc)) {
    return (
      <Contenedor>
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto max-w-md py-16 text-center"
        >
          <motion.span
            initial={reduce ? false : { scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.1 }}
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-white shadow-lg shadow-red-600/30"
          >
            <XCircle className="h-8 w-8" />
          </motion.span>
          <h1 className="mt-6 text-2xl font-bold">{error ? "No pudimos verificar" : "Certificado no encontrado"}</h1>
          <p className="mt-2 text-muted-foreground">
            {error || "El código no corresponde a ninguna constancia emitida en AACES. Revisa que esté completo o consulta con quien la emitió."}
          </p>
          <p className="mt-4 inline-block rounded-lg bg-muted px-3 py-1.5 font-mono text-sm">{codigo}</p>
          <div className="mt-8 flex flex-col justify-center gap-2 sm:flex-row">
            <Link href="/verificar" className="inline-flex items-center justify-center gap-2 rounded-full bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-orange-500/25 transition-colors hover:bg-orange-600">
              <Search className="h-4 w-4" /> Verificar otro código
            </Link>
            {error && (
              <button onClick={() => window.location.reload()} className="inline-flex items-center justify-center rounded-full border px-5 py-2.5 text-sm font-semibold hover:bg-muted">Reintentar</button>
            )}
          </div>
        </motion.div>
      </Contenedor>
    )
  }

  // ---------- Documento del motor nuevo (UUID) ----------
  if (doc) {
    const ok = doc.valida
    return (
      <Contenedor>
        <Encabezado
          reduce={!!reduce}
          icono={ok ? ShieldCheck : XCircle}
          sello={ok ? ESTADOS.vigente.sello : "bg-red-600 shadow-red-600/30"}
          halo={ok ? ESTADOS.vigente.halo : "bg-red-500/20"}
          titulo={ok ? "Documento verificado" : "Documento no válido"}
          texto={ok ? `Emitido por ${doc.organizacion || "una organización registrada"} a través de AACES.` : doc.estatus === "cancelado" ? "Este documento fue revocado por la organización emisora." : "El documento no es válido."}
          ahora={ahora}
          verificaciones={doc.verificaciones_count}
        />
        <Tarjeta reduce={!!reduce} pill={ok ? ESTADOS.vigente.pill : "NO VÁLIDO"} pillCls={ok ? ESTADOS.vigente.pillCls : ESTADOS.no_acreditado.pillCls}
          filas={[
            ["Código", <span key="c" className="font-mono">{doc.codigo_validacion}</span>],
            ...(doc.participante ? [["Nombre completo", doc.participante.nombre] as [string, React.ReactNode]] : []),
            ...(doc.curso ? [["Nombre del curso", doc.curso.nombre] as [string, React.ReactNode]] : []),
            ...(doc.fecha_emision ? [["Fecha de emisión", corta(doc.fecha_emision)] as [string, React.ReactNode]] : []),
            ...(doc.curso?.expiracion ? [["Fecha de expiración", corta(doc.curso.expiracion)] as [string, React.ReactNode]] : []),
            ...(doc.organizacion ? [["Capacitador", doc.organizacion] as [string, React.ReactNode]] : []),
            ["Estado", <span key="e" className={ok ? "font-bold text-green-700" : "font-bold text-red-600"}>{ok ? "VÁLIDO" : "NO VÁLIDO"}</span>],
          ]}
          qr={qr} url={url}
        />
        <Acciones compartir={compartir} copiado={copiado} />
      </Contenedor>
    )
  }

  // ---------- Certificado / DC-3 ----------
  const c = cert!
  const e = ESTADOS[c.estado] ?? ESTADOS.no_acreditado
  const cap = c.capacitador?.nombre
  const constancias = c.constancias.map((k) => (k.norma ? `${k.nombre} (${k.norma})` : k.nombre)).join(", ")
  const fechaCurso = c.curso.fecha_inicio && c.curso.fecha_fin && c.curso.fecha_inicio !== c.curso.fecha_fin
    ? `${corta(c.curso.fecha_inicio)} – ${corta(c.curso.fecha_fin)}`
    : corta(c.curso.fecha_inicio)

  const filas: [string, React.ReactNode][] = [
    ["ID certificado", <span key="id" className="font-mono">{c.id_certificado || c.codigo_validacion}</span>],
    ["Nombre completo", c.participante.nombre],
    ["Fecha del curso", fechaCurso],
    ["Fecha de expiración", c.fecha_expiracion ? corta(c.fecha_expiracion) : "Sin vencimiento"],
    ["Nombre del curso", c.curso.nombre],
  ]
  if (constancias) filas.push(["Constancias asociadas", constancias])
  if (c.curso.duracion_horas) filas.push(["Duración", `${c.curso.duracion_horas} horas`])
  if (cap) filas.push(["Capacitador", cap])
  if (c.capacitador?.stps_verificado) {
    const k = c.capacitador
    filas.push(["Registro STPS", (
      <span key="stps" className="inline-flex flex-col gap-0.5">
        <span className="inline-flex items-center gap-1.5 font-medium">
          <BadgeCheck className="h-4 w-4 shrink-0 text-green-600" />
          Agente capacitador registrado
          {(k.stps_registro || k.stps_rfc) && <span className="font-mono font-normal text-muted-foreground">· {k.stps_registro || k.stps_rfc}</span>}
        </span>
        <span className="text-xs text-muted-foreground">
          {k.stps_origen === "automatica" && k.stps_consultado_en ? `Verificado en el registro de la STPS el ${corta(k.stps_consultado_en.slice(0, 10))}. ` : "Validado por AACES. "}
          {k.stps_fuente && <a href={k.stps_fuente} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">Consultar en la STPS</a>}
        </span>
      </span>
    )])
  } else if (c.capacitador) {
    // Transparencia: quien verifica merece saber que el registro no está comprobado
    filas.push(["Registro STPS", (
      <span key="stps" className="inline-flex flex-col gap-0.5">
        <span className="inline-flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0" /> No verificado
        </span>
        <span className="text-xs text-muted-foreground">
          AACES no ha comprobado el registro de este capacitador ante la STPS. La constancia sí es auténtica.{" "}
          <a href={c.capacitador.stps_fuente || "https://agentes.stps.gob.mx/Buscador/BuscadorAgente.aspx"} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">Consultar en la STPS</a>
        </span>
      </span>
    )])
  }
  // Congruencia agente–curso–instructor (Fase 1: declarado por el agente capacitador)
  const cg = c.congruencia
  if (cg) {
    const declarado = <span className="block text-xs text-muted-foreground">Declarado por el agente capacitador</span>
    filas.push(["Curso registrado", (
      <span key="cur" className="inline-flex flex-col gap-0.5">
        {cg.curso_registrado
          ? <span className="inline-flex items-center gap-1.5 font-medium"><BadgeCheck className="h-4 w-4 shrink-0 text-green-600" />Registrado ante la STPS{cg.curso_stps_nombre ? ` como “${cg.curso_stps_nombre}”` : ""}</span>
          : <span className="inline-flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-400"><AlertTriangle className="h-4 w-4 shrink-0" />No declarado como registrado</span>}
        {declarado}
      </span>
    )])
    filas.push(["Instructor", (
      <span key="ins" className="inline-flex flex-col gap-0.5">
        {cg.instructor
          ? <span className="inline-flex items-center gap-1.5 font-medium">
              {cg.instructor_en_plantilla ? <BadgeCheck className="h-4 w-4 shrink-0 text-green-600" /> : <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />}
              {cg.instructor}
            </span>
          : <span className="font-medium text-amber-700 dark:text-amber-400">No indicado</span>}
        {cg.instructor && <span className="block text-xs text-muted-foreground">{cg.instructor_en_plantilla ? "Forma parte de la plantilla de instructores del agente para este curso" : "No aparece en la plantilla declarada para este curso"}</span>}
        {declarado}
      </span>
    )])
  }
  filas.push(["Estado", <span key="est" className={`font-bold ${e.estado}`}>{c.estado === "vigente" ? "ACTIVO" : c.estado === "vencido" ? "VENCIDO" : "NO ACREDITADO"}</span>])

  return (
    <Contenedor>
      <Encabezado
        reduce={!!reduce}
        icono={e.icono}
        sello={e.sello}
        halo={e.halo}
        titulo={e.titulo}
        texto={c.estado === "vencido" && c.fecha_expiracion ? `Esta constancia es auténtica, pero venció el ${larga(c.fecha_expiracion)}.` : `${e.texto}${cap ? ` Emitida por ${cap} a través de AACES.` : ""}`}
        ahora={ahora}
        verificaciones={c.verificaciones}
      />
      <Tarjeta reduce={!!reduce} pill={e.pill} pillCls={e.pillCls} filas={filas} qr={qr} url={url} logo={c.capacitador?.logo_url} />
      <Acciones compartir={compartir} copiado={copiado} />
    </Contenedor>
  )
}

// ---------- Piezas ----------
function Contenedor({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-svh overflow-hidden pb-16 pt-24 print:p-0">
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-16 h-[380px] w-[720px] -translate-x-1/2 rounded-full bg-orange-500/10 blur-3xl print:hidden" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.06)_1px,transparent_0)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_60%_45%_at_50%_25%,black,transparent)] print:hidden" />
      <div className="relative mx-auto max-w-2xl px-4 sm:px-6">{children}</div>
    </div>
  )
}

function Encabezado({ reduce, icono: Icono, sello, halo, titulo, texto, ahora, verificaciones }: {
  reduce: boolean; icono: React.ComponentType<{ className?: string }>; sello: string; halo: string; titulo: string; texto: string; ahora: Date; verificaciones: number
}) {
  return (
    <div className="mb-8 text-center print:hidden">
      <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
        <motion.span
          aria-hidden="true"
          className={`absolute inset-0 rounded-full ${halo}`}
          initial={reduce ? false : { scale: 0.6, opacity: 0 }}
          animate={reduce ? { opacity: 1 } : { scale: [0.6, 1.25, 1], opacity: [0, 1, 1] }}
          transition={{ duration: 0.9, ease: EASE }}
        />
        <motion.span
          className={`relative flex h-16 w-16 items-center justify-center rounded-full text-white shadow-xl ${sello}`}
          initial={reduce ? false : { scale: 0, rotate: -40 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 240, damping: 14, delay: 0.1 }}
        >
          <Icono className="h-8 w-8" />
        </motion.span>
      </div>
      <motion.h1
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3, ease: EASE }}
        className="mt-5 text-2xl font-bold sm:text-3xl"
      >
        {titulo}
      </motion.h1>
      <motion.p
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4, ease: EASE }}
        className="mx-auto mt-2 max-w-md text-muted-foreground"
      >
        {texto}
      </motion.p>
      <motion.div
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.55 }}
        className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground"
      >
        <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />Consultado el {ahora.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })} a las {ahora.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</span>
        {verificaciones > 0 && <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" />Verificado {verificaciones} {verificaciones === 1 ? "vez" : "veces"}</span>}
      </motion.div>
    </div>
  )
}

function Tarjeta({ reduce, pill, pillCls, filas, qr, url, logo }: {
  reduce: boolean; pill: string; pillCls: string; filas: [string, React.ReactNode][]; qr: string; url: string; logo?: string | null
}) {
  return (
    <motion.article
      id="certificado"
      initial={reduce ? false : { opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.35, ease: EASE }}
      className="rounded-[28px] border border-border/70 bg-background p-2 shadow-2xl shadow-black/10 print:rounded-none print:border-0 print:p-0 print:shadow-none"
    >
      <div className="overflow-hidden rounded-[22px] border border-border/70 bg-white text-gray-900">
        {/* Encabezado */}
        <header className="flex flex-col gap-4 border-b border-gray-200 bg-gray-50/60 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="AACES" width={40} height={40} className="h-9 w-auto" />
            <div>
              <p className="text-xl font-bold leading-none tracking-tight">AACES</p>
              <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-gray-500">Sistema de gestión de capacitaciones</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="Logo del capacitador" className="h-9 w-auto max-w-[120px] object-contain" />
            )}
            <span className={`relative inline-flex overflow-hidden rounded-full border px-4 py-1.5 text-xs font-semibold tracking-wide ${pillCls}`}>
              {pill}
              {!reduce && (
                <motion.span
                  aria-hidden="true"
                  className="absolute inset-y-0 w-10 -skew-x-12 bg-white/70"
                  initial={{ x: "-150%" }}
                  animate={{ x: "450%" }}
                  transition={{ duration: 1.2, delay: 1.1, ease: "easeInOut" }}
                />
              )}
            </span>
          </div>
        </header>

        {/* Datos */}
        <dl className="grid gap-x-8 px-6 py-6 sm:grid-cols-[minmax(0,210px)_1fr] sm:px-8">
          {filas.map(([k, v], i) => (
            <motion.div
              key={k}
              className="contents"
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.6 + i * 0.05 }}
            >
              <dt className="pt-3 text-xs font-semibold uppercase tracking-wide text-gray-500 sm:py-1.5 sm:text-sm">{k}</dt>
              <dd className="pb-3 text-[15px] uppercase leading-snug text-gray-900 sm:py-1.5">{v}</dd>
            </motion.div>
          ))}
        </dl>

        {/* QR */}
        <div className="flex flex-col-reverse items-center gap-5 px-6 pb-6 sm:flex-row sm:items-end sm:justify-between sm:px-8">
          <p className="max-w-xs break-all text-center text-xs uppercase leading-relaxed text-gray-500 sm:text-left">
            Verificación en línea: {url}
          </p>
          <motion.div
            initial={reduce ? false : { opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.9, ease: EASE }}
            className="shrink-0 rounded-2xl border border-gray-200 bg-white p-2.5 shadow-sm"
          >
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt="Código QR de verificación" className="h-36 w-36 sm:h-40 sm:w-40" />
            ) : (
              <div className="flex h-36 w-36 items-center justify-center sm:h-40 sm:w-40"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
            )}
          </motion.div>
        </div>

        {/* Pie */}
        <footer className="grid gap-2 border-t border-gray-200 bg-gray-50/60 px-6 py-4 text-[11px] uppercase leading-relaxed text-gray-500 sm:grid-cols-[minmax(0,210px)_1fr] sm:gap-8 sm:px-8">
          <span>Emitido por AACES · aaces.com</span>
          <span>Este documento confirma la validez del certificado.</span>
        </footer>
      </div>
    </motion.article>
  )
}

function Acciones({ compartir, copiado }: { compartir: () => void; copiado: boolean }) {
  const btn = "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-200 active:scale-95"
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1 }}
      className="mt-8 flex flex-col items-center gap-6 print:hidden"
    >
      <div className="flex w-full flex-col justify-center gap-2 sm:w-auto sm:flex-row">
        <button onClick={() => window.print()} className={`${btn} bg-orange-500 text-white shadow-md shadow-orange-500/25 hover:bg-orange-600`}>
          <Printer className="h-4 w-4" /> Imprimir o guardar PDF
        </button>
        <button onClick={compartir} className={`${btn} border bg-background hover:bg-muted`}>
          <AnimatePresence mode="wait" initial={false}>
            {copiado ? (
              <motion.span key="ok" className="inline-flex items-center gap-2 text-green-700" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <Check className="h-4 w-4" /> Enlace copiado
              </motion.span>
            ) : (
              <motion.span key="share" className="inline-flex items-center gap-2" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                {typeof navigator !== "undefined" && "share" in navigator ? <Share2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Compartir
              </motion.span>
            )}
          </AnimatePresence>
        </button>
        <Link href="/verificar" className={`${btn} text-muted-foreground hover:bg-muted hover:text-foreground`}>
          <Search className="h-4 w-4" /> Verificar otro
        </Link>
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 text-orange-500" />
        Verificación protegida por <Link href="/" className="font-semibold text-foreground hover:text-orange-500">AACES</Link>
      </p>
    </motion.div>
  )
}
