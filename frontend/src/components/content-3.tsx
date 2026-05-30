import { Button } from '@/components/ui/button'
import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

export default function ContentSection() {
    return (
        <section className="py-16 md:py-32">
            <div className="mx-auto max-w-5xl space-y-8 px-6 md:space-y-12">
                <Image
                    className="rounded-(--radius) grayscale w-full h-auto"
                    src="https://images.unsplash.com/photo-1530099486328-e021101a494a?q=80&w=1280&auto=format&fit=crop"
                    alt="Equipo AACES"
                    width={1280}
                    height={720}
                    priority={false}
                />

                <div className="grid gap-6 md:grid-cols-2 md:gap-12">
                    <h2 className="text-4xl font-medium">Capacitación y herramientas que impulsan la profesionalización</h2>
                    <div className="space-y-6">
                        <p>AACES integra un ecosistema de soluciones: cursos, certificaciones y APIs para que equipos y empresas innoven con trazabilidad y confianza.</p>

                        <Button
                            asChild
                            variant="secondary"
                            size="sm"
                            className="gap-1 pr-1.5">
                            <Link href="/contacto">
                                <span>Más información</span>
                                <ChevronRight className="size-2" />
                            </Link>
                        </Button>
                    </div>
                </div>
            </div>
        </section>
    )
}
