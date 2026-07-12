import Link from 'next/link'
import Image from 'next/image'

export default function CommunitySection() {
    return (
        <section className="py-16 md:py-32">
            <div className="mx-auto max-w-5xl px-6">
                <div className="text-center">
                    <h2 className="text-3xl font-semibold">
                        Construido por la comunidad <br /> para la comunidad
                    </h2>
                    <p className="mt-6">Nuestra comunidad impulsa la mejora continua y comparte buenas prácticas.</p>
                </div>
                <div className="mx-auto mt-12 max-w-sm sm:max-w-none space-y-3">
                    <div className="flex justify-center gap-3 flex-wrap">
                        {[
                            '/1.jpg',
                            '/2.jpg',
                            '/3.jpg',
                            '/4.jpg',
                            '/5.jpg',
                            '/6.jpg',
                        ].map((src, i) => (
                            <Link key={`r1-${i}`} href="https://github.com/meschacirung" target="_blank" title="Méschac Irung" className="relative block w-12 h-12 sm:w-14 sm:h-14 rounded-full border overflow-hidden">
                                <Image className="object-cover" alt={`Avatar ${i+1}`} src={src} fill sizes="48px" />
                            </Link>
                        ))}
                    </div>
                    <div className="flex justify-center gap-3 flex-wrap">
                        {[
                            '/7.jpg',
                            '/8.jpg',
                            '/9.jpg',
                            '/10.jpg',
                            '/11.jpg',
                        ].map((src, i) => (
                            <Link key={`r2-${i}`} href="https://github.com/meschacirung" target="_blank" title="Méschac Irung" className="relative block w-12 h-12 sm:w-14 sm:h-14 rounded-full border overflow-hidden">
                                <Image className="object-cover" alt={`Avatar ${i+7}`} src={src} fill sizes="48px" />
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    )
}
