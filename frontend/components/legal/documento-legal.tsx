"use client"

import Link from "next/link"
import { PageHero } from "@/components/landing/page-hero"
import FooterSection from "src/components/footer"
import { RESPONSABLE, ACTUALIZADO } from "@/lib/legal"

export type Seccion = { id: string; titulo: string; contenido: React.ReactNode }

/** Dato del responsable; si falta, se ve resaltado para no publicarlo incompleto. */
export function Dato({ campo }: { campo: keyof typeof RESPONSABLE }) {
  const v = RESPONSABLE[campo]
  if (v) return <strong className="font-semibold text-foreground">{v}</strong>
  return <mark className="rounded bg-amber-200 px-1 font-semibold text-amber-900">[pendiente: {campo}]</mark>
}

export function Correo() {
  return RESPONSABLE.correo
    ? <a href={`mailto:${RESPONSABLE.correo}`} className="font-semibold text-orange-600 underline-offset-2 hover:underline">{RESPONSABLE.correo}</a>
    : <Dato campo="correo" />
}

/** Página de documento legal: encabezado, índice lateral y secciones numeradas. */
export function DocumentoLegal({ eyebrow, titulo, resumen, secciones, relacionado }: {
  eyebrow: string
  titulo: string
  resumen: React.ReactNode
  secciones: Seccion[]
  relacionado?: { href: string; texto: string }
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PageHero eyebrow={eyebrow} title={titulo} description={resumen}>
        <p className="text-sm text-muted-foreground">Última actualización: {ACTUALIZADO}</p>
      </PageHero>

      <div className="mx-auto grid max-w-6xl gap-10 px-6 pb-20 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <nav aria-label="Contenido" className="lg:sticky lg:top-28 lg:self-start">
          <details className="rounded-2xl border bg-card p-4 lg:hidden">
            <summary className="cursor-pointer text-sm font-semibold">Contenido</summary>
            <Indice secciones={secciones} />
          </details>
          <div className="hidden rounded-2xl border bg-card p-4 lg:block">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contenido</p>
            <Indice secciones={secciones} />
          </div>
          {relacionado && (
            <Link href={relacionado.href} className="mt-3 block px-1 text-sm font-medium text-orange-500 hover:underline">{relacionado.texto} →</Link>
          )}
        </nav>

        <article className="space-y-10">
          {secciones.map((s, i) => (
            <section key={s.id} id={s.id} className="scroll-mt-28">
              <h2 className="flex items-baseline gap-3 text-xl font-semibold">
                <span className="text-sm font-bold text-orange-500">{String(i + 1).padStart(2, "0")}</span>{s.titulo}
              </h2>
              <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-muted-foreground [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_strong]:text-foreground [&_ul]:space-y-1.5">
                {s.contenido}
              </div>
            </section>
          ))}
        </article>
      </div>
      <FooterSection />
    </div>
  )
}

function Indice({ secciones }: { secciones: Seccion[] }) {
  return (
    <ol className="mt-2 space-y-1 text-sm">
      {secciones.map((s, i) => (
        <li key={s.id}>
          <a href={`#${s.id}`} className="flex gap-2 rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <span className="w-5 shrink-0 text-xs font-semibold text-orange-500">{i + 1}</span>{s.titulo}
          </a>
        </li>
      ))}
    </ol>
  )
}
