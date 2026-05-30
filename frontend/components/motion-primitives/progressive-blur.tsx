"use client"
import React from "react"

type ProgressiveBlurProps = {
  className?: string
  direction?: "left" | "right"
  blurIntensity?: number
}

export function ProgressiveBlur({ className, direction = "left", blurIntensity = 1 }: ProgressiveBlurProps) {
  const style: React.CSSProperties = {
    backdropFilter: `blur(${Math.max(0, blurIntensity) * 8}px)`,
    WebkitBackdropFilter: `blur(${Math.max(0, blurIntensity) * 8}px)`,
    background: direction === "left"
      ? "linear-gradient(to right, var(--background), transparent)"
      : "linear-gradient(to left, var(--background), transparent)",
  }
  return <div className={className} style={style} aria-hidden />
}

