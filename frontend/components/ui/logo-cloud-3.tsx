"use client"
import React from "react"
import Image from "next/image"
import { InfiniteSlider } from "@/components/ui/infinite-slider"
import { ProgressiveBlur } from "@/components/ui/progressive-blur"

export function LogoCloud3() {
  const logos = [
    { src: "/cas.png", alt: "CAS", h: 28 },
    { src: "/cidesi.png", alt: "CIDESI", h: 28 },
    { src: "/lanited.png", alt: "Lanited", h: 28 },
    { src: "https://upload.wikimedia.org/wikipedia/commons/4/4a/GitHub_Mark_2023.svg", alt: "GitHub", h: 20 },
    { src: "https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg", alt: "Microsoft", h: 20 },
    { src: "https://upload.wikimedia.org/wikipedia/commons/9/96/Google_2024_Logo.svg", alt: "Google", h: 16 },
    { src: "https://upload.wikimedia.org/wikipedia/commons/c/ca/LinkedIn_logo_initials.png", alt: "LinkedIn", h: 20 },
    { src: "https://upload.wikimedia.org/wikipedia/commons/e/e8/Amazon_Web_Services_logo.svg", alt: "AWS", h: 16 },
    { src: "https://upload.wikimedia.org/wikipedia/commons/1/1f/OpenAI_Logo.svg", alt: "OpenAI", h: 22 },
    { src: "https://upload.wikimedia.org/wikipedia/commons/7/7f/Vercel_logo.svg", alt: "Vercel", h: 16 },
  ]

  return (
    <section className="bg-background pb-16 md:pb-32">
      <div className="group relative m-auto max-w-6xl px-6">
        <div className="flex flex-col items-center md:flex-row">
          <div className="inline md:max-w-44 md:border-r md:pr-6">
            <p className="text-center md:text-end text-sm">Confían en nosotros</p>
          </div>
          <div className="relative py-6 w-full overflow-hidden">
            <InfiniteSlider speedOnHover={20} speed={40} gap={112}>
              {logos.map((l, i) => (
                <div key={`${l.src}-${i}`} className="flex">
                  <Image className={`mx-auto object-contain ${l.src.startsWith('/') ? '' : 'dark:invert'}`} src={l.src} alt={`${l.alt} Logo`} height={l.h} width={l.h * 2} />
                </div>
              ))}
            </InfiniteSlider>
            <div className="bg-gradient-to-r from-background to-transparent pointer-events-none absolute inset-y-0 left-0 w-20"></div>
            <div className="bg-gradient-to-l from-background to-transparent pointer-events-none absolute inset-y-0 right-0 w-20"></div>
            <ProgressiveBlur className="pointer-events-none absolute left-0 top-0 h-full w-20" direction="left" blurIntensity={1} />
            <ProgressiveBlur className="pointer-events-none absolute right-0 top-0 h-full w-20" direction="right" blurIntensity={1} />
          </div>
        </div>
      </div>
    </section>
  )
}
