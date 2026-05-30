"use client"
import React, { ReactNode, useMemo } from "react"

type InfiniteSliderProps = {
  children: ReactNode
  speed?: number
  speedOnHover?: number
  gap?: number
  className?: string
}

export function InfiniteSlider({ children, speed = 40, speedOnHover = 20, gap = 112, className }: InfiniteSliderProps) {
  const slides = useMemo(() => {
    const arr = React.Children.toArray(children)
    return [...arr, ...arr, ...arr]
  }, [children])

  return (
    <div className={className ? className : undefined}>
      <div
        className="flex will-change-transform"
        style={{
          gap: `${gap}px`,
          animation: `iscroll ${speed}s linear infinite`,
        }}
      >
        {slides.map((child, i) => (
          <div key={i} className="flex">
            {child}
          </div>
        ))}
      </div>
      <style jsx>{`
        @keyframes iscroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.33%); }
        }
        :global(.group:hover) div[style*="iscroll"] { animation-duration: ${speedOnHover}s; }
      `}</style>
    </div>
  )
}

