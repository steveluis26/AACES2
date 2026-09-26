"use client"
import Link from "next/link"
import { AlertTriangle, ArrowRight, BadgeCheck, GraduationCap, QrCode, ShieldCheck } from "lucide-react"
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal"
import { SectionHeading } from "@/components/landing/section-heading"

const puntos = [
  { icon: ShieldCheck, title: "Agente registrado, verificado", desc: "Consultamos tu registro en el buscador oficial de la STPS. Si no aparece, el QR lo dice." },
  { icon: BadgeCheck, title: "Curso registrado", desc: "Cada grupo se liga a un curso de tu catálogo que tienes registrado ante la STPS." },
  { icon: GraduationCap, title: "Instructor que lo impartió", desc: "El DC-3 lleva al instructor de tu plantilla. Si algo no coincide, AACES te avisa antes de generar folios." },
]

const filas: [string, React.ReactNode][] = [
  ["Agente capacitador", <span key="a" className="contents"><BadgeCheck className="h-4 w-4 shrink-0 text-green-600" /> Registrado ante la STPS</span>],
  ["Curso", <span key="c" className="contents"><BadgeCheck className="h-4 w-4 shrink-0 text-green-600" /> Trabajos en alturas · registrado</span>],
  ["Instructor", <span key="i" className="contents"><BadgeCheck className="h-4 w-4 shrink-0 text-green-600" /> Ing. Juan Pérez López</span>],
  ["Vigencia", <span key="v" className="font-semibold text-green-600">ACTIVO</span>],
]

/** El diferenciador: un DC-3 congruente que la empresa comprueba escaneando el QR. */
export default function CongruenciaSection() {
  return (
    <section id="congruencia" className="scroll-mt-24 py-12 md:py-20">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="Congruencia"
          title="Un DC-3 que resiste una revisión"
          description="Es común que un capacitador sin registro imparta el curso y otro agente firme las constancias. La empresa paga, archiva y cree que cumple. Con AACES, quien recibe el DC-3 comprueba en segundos quién lo emitió y quién lo impartió."
        />

        <div className="mt-12 grid items-center gap-10 lg:grid-cols-2">
          <Stagger className="space-y-4" stagger={0.1}>
            {puntos.map((p) => (
              <StaggerItem key={p.title}>
                <div className="flex gap-4 rounded-2xl border border-border/50 bg-card p-5 transition-colors hover:border-orange-500/30">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white"><p.icon className="h-5 w-5" /></span>
                  <div>
                    <h3 className="font-semibold">{p.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{p.desc}</p>
                  </div>
                </div>
              </StaggerItem>
            ))}
            <StaggerItem>
              <p className="flex items-start gap-2 px-1 text-sm text-muted-foreground">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                ¿Su Comisión Mixta revisa esta congruencia antes de autentificar las constancias? Con AACES basta escanear el QR.
              </p>
            </StaggerItem>
          </Stagger>

          <Reveal delay={0.15} y={32}>
            <div className="relative mx-auto max-w-md">
              <div aria-hidden="true" className="pointer-events-none absolute -inset-6 rounded-[2rem] bg-orange-500/10 blur-2xl" />
              <div className="relative overflow-hidden rounded-2xl border bg-card shadow-xl">
                <div className="flex items-center justify-between border-b bg-muted/40 px-5 py-4">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-600 text-white"><ShieldCheck className="h-4 w-4" /></span>
                    <div>
                      <p className="text-sm font-semibold">Certificado válido</p>
                      <p className="text-xs text-muted-foreground">Verificado al escanear el QR</p>
                    </div>
                  </div>
                  <QrCode className="h-7 w-7 text-muted-foreground" />
                </div>
                <dl className="divide-y">
                  {filas.map(([k, v]) => (
                    <div key={k} className="grid grid-cols-[7.5rem_1fr] items-center gap-3 px-5 py-3 text-sm">
                      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{k}</dt>
                      <dd className="flex items-center gap-1.5 font-medium">{v}</dd>
                    </div>
                  ))}
                </dl>
                <p className="border-t px-5 py-3 text-xs text-muted-foreground">Con liga a la consulta oficial de la STPS para confirmarlo.</p>
              </div>
            </div>
          </Reveal>
        </div>

        <Reveal className="mt-10 text-center" delay={0.1}>
          <Link href="/verificar" className="group inline-flex items-center gap-1.5 text-sm font-semibold text-orange-500 hover:text-orange-600">
            Así lo ve una empresa <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </Reveal>
      </div>
    </section>
  )
}
