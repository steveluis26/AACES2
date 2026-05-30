"use client"
import Image from "next/image"
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"

export function HeroHeader() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(true)
  const [shrink, setShrink] = useState(false)
  useEffect(() => {
    try {
      const tok = typeof window !== "undefined" ? (localStorage.getItem("aaces_token") || localStorage.getItem("token")) : null
      const usr = typeof window !== "undefined" ? (localStorage.getItem("aaces_user") || localStorage.getItem("user")) : null
      const isAuthed = !!tok || !!usr
      const inApp = (pathname || "").startsWith("/admin") || (pathname || "").startsWith("/cliente")
      setVisible(!(isAuthed || inApp))
    } catch {
      setVisible(true)
    }
    const onScroll = () => setShrink(window.scrollY > 24)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [pathname])
  if (!visible) return null
  return (
    <div className={`pointer-events-auto fixed left-1/2 top-4 z-50 -translate-x-1/2 transition-all duration-300 ${shrink ? 'w-[min(100%-4rem,980px)]' : 'w-[min(100%-2rem,1100px)]'}`}>
      <div className="mx-auto flex items-center justify-between rounded-[2rem] border border-[var(--border)] bg-background/70 px-5 py-2 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
        <a href="/" className="group flex items-center gap-2">
          <Image src="/logo.png" alt="AACES" width={24} height={24} className="h-6 w-auto" />
          <span className="text-sm font-semibold transition-colors group-hover:text-orange-500">AACES</span>
        </a>
        <nav className="hidden md:flex items-center gap-6">
          <a href="/blog" className="opacity-80 hover:text-orange-500">Blog</a>
          <a href="/nosotros" className="opacity-80 hover:text-orange-500">Nosotros</a>
          <a href="/contacto" className="opacity-80 hover:text-orange-500">Contacto</a>
        </nav>
        <a href="/login" className="inline-flex items-center rounded-full px-3 py-1 text-sm bg-orange-500 text-white hover:bg-orange-600">
          Ingresar
        </a>
      </div>
    </div>
  )
}
