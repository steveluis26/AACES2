import { Cpu, Lock, Sparkles, Zap } from 'lucide-react'

export default function ContentSection() {
    return (
        <section className="py-16 md:py-32">
            <div className="mx-auto max-w-5xl space-y-8 px-6 md:space-y-12">
                <div className="mx-auto max-w-xl space-y-6 text-center md:space-y-12">
                    <h2 className="text-balance text-4xl font-medium lg:text-5xl">Impulsamos la capacitación y la certificación confiable</h2>
                    <p>AACES integra herramientas modernas, trazabilidad y verificación en un mismo sistema para elevar la seguridad y la profesionalización.</p>
                </div>
                <picture>
                    <source srcSet="https://images.unsplash.com/photo-1616587226960-4a03badbe8bf?q=80&w=1280&auto=format&fit=crop" media="(min-width: 768px)" />
                    <img className="rounded-(--radius) grayscale w-full h-auto" src="https://images.unsplash.com/photo-1616587226960-4a03badbe8bf?q=80&w=800&auto=format&fit=crop" alt="Equipo AACES" loading="lazy" />
                </picture>

                <div className="relative mx-auto grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-8 lg:grid-cols-4">
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Zap className="size-4" />
                            <h3 className="text-sm font-medium">Ágil</h3>
                        </div>
                        <p className="text-muted-foreground text-sm">Procesos rápidos para administración y validación de certificaciones.</p>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Cpu className="size-4" />
                            <h3 className="text-sm font-medium">Potente</h3>
                        </div>
                        <p className="text-muted-foreground text-sm">Herramientas robustas para cursos, participantes y constancias.</p>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Lock className="size-4" />
                            <h3 className="text-sm font-medium">Seguridad</h3>
                        </div>
                        <p className="text-muted-foreground text-sm">Verificación por código único y controles anti‑fraude.</p>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Sparkles className="size-4" />
                            <h3 className="text-sm font-medium">Optimizado</h3>
                        </div>
                        <p className="text-muted-foreground text-sm">Experiencia moderna y adaptable para equipos y empresas.</p>
                    </div>
                </div>
            </div>
        </section>
    )
}
