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
    { src: "https://html.tailus.io/blocks/customers/nvidia.svg", alt: "Nvidia", h: 20 },
    { src: "https://html.tailus.io/blocks/customers/column.svg", alt: "Column", h: 16 },
    { src: "https://html.tailus.io/blocks/customers/github.svg", alt: "GitHub", h: 16 },
    { src: "https://html.tailus.io/blocks/customers/nike.svg", alt: "Nike", h: 20 },
    { src: "https://html.tailus.io/blocks/customers/lemonsqueezy.svg", alt: "Lemon Squeezy", h: 20 },
    { src: "https://html.tailus.io/blocks/customers/laravel.svg", alt: "Laravel", h: 16 },
    { src: "https://html.tailus.io/blocks/customers/lilly.svg", alt: "Lilly", h: 28 },
    { src: "https://html.tailus.io/blocks/customers/openai.svg", alt: "OpenAI", h: 24 },
  ]

  return (
    <section className="bg-background pb-16 md:pb-32">
      <div className="group relative m-auto max-w-6xl px-6">
        <div className="flex flex-col items-center md:flex-row">
          <div className="inline md:max-w-44 md:border-r md:pr-6">
            <p className="text-end text-sm">Powering the best teams</p>
          </div>
          <div className="relative py-6 md:w-[calc(100%-11rem)] overflow-hidden">
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
