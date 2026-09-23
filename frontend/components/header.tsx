"use client"
import Image from "next/image"
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { Menu, X } from "lucide-react"

export function HeroHeader() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(true)
  const [shrink, setShrink] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
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
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])
  if (!visible) return null
  const isCurrent = (href: string) => !href.includes("#") && (pathname === href || (href !== "/" && (pathname || "").startsWith(href + "/")))
  return (
    <>
      <div className={`pointer-events-auto fixed left-1/2 top-4 z-50 -translate-x-1/2 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-4 motion-safe:duration-700 transition-all duration-300 ${shrink ? 'w-[min(100%-4rem,980px)]' : 'w-[min(100%-2rem,1100px)]'}`}>
        <div className="mx-auto flex items-center justify-between rounded-[2rem] border border-[var(--border)] bg-background/70 px-5 py-2 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
          <a href="/" className="group flex items-center gap-2">
            <Image src="/logo.png" alt="AACES" width={24} height={24} className="h-6 w-auto" />
            <span className="text-sm font-semibold transition-colors group-hover:text-orange-500">AACES</span>
          </a>
          <nav className="hidden md:flex items-center gap-6">
            <a href="/verificar" aria-current={isCurrent("/verificar") ? "page" : undefined} className={`relative py-1 transition-colors duration-200 hover:text-orange-500 after:absolute after:-bottom-0.5 after:left-0 after:h-0.5 after:w-full after:origin-left after:rounded-full after:bg-orange-500 after:transition-transform after:duration-300 ${isCurrent("/verificar") ? "text-orange-500 after:scale-x-100" : "opacity-80 after:scale-x-0 hover:after:scale-x-100"}`}>Verificar</a>
            <a href="/producto" aria-current={isCurrent("/producto") ? "page" : undefined} className={`relative py-1 transition-colors duration-200 hover:text-orange-500 after:absolute after:-bottom-0.5 after:left-0 after:h-0.5 after:w-full after:origin-left after:rounded-full after:bg-orange-500 after:transition-transform after:duration-300 ${isCurrent("/producto") ? "text-orange-500 after:scale-x-100" : "opacity-80 after:scale-x-0 hover:after:scale-x-100"}`}>Producto</a>
            <a href="/#planes" aria-current={isCurrent("/#planes") ? "page" : undefined} className={`relative py-1 transition-colors duration-200 hover:text-orange-500 after:absolute after:-bottom-0.5 after:left-0 after:h-0.5 after:w-full after:origin-left after:rounded-full after:bg-orange-500 after:transition-transform after:duration-300 ${isCurrent("/#planes") ? "text-orange-500 after:scale-x-100" : "opacity-80 after:scale-x-0 hover:after:scale-x-100"}`}>Precios</a>
            <a href="/marketplace" aria-current={isCurrent("/marketplace") ? "page" : undefined} className={`relative py-1 transition-colors duration-200 hover:text-orange-500 after:absolute after:-bottom-0.5 after:left-0 after:h-0.5 after:w-full after:origin-left after:rounded-full after:bg-orange-500 after:transition-transform after:duration-300 ${isCurrent("/marketplace") ? "text-orange-500 after:scale-x-100" : "opacity-80 after:scale-x-0 hover:after:scale-x-100"} flex items-center gap-1`}>
              Marketplace
              <span className="rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">Próximamente</span>
            </a>
            <a href="/blog" aria-current={isCurrent("/blog") ? "page" : undefined} className={`relative py-1 transition-colors duration-200 hover:text-orange-500 after:absolute after:-bottom-0.5 after:left-0 after:h-0.5 after:w-full after:origin-left after:rounded-full after:bg-orange-500 after:transition-transform after:duration-300 ${isCurrent("/blog") ? "text-orange-500 after:scale-x-100" : "opacity-80 after:scale-x-0 hover:after:scale-x-100"}`}>Blog</a>
            <a href="/contacto" aria-current={isCurrent("/contacto") ? "page" : undefined} className={`relative py-1 transition-colors duration-200 hover:text-orange-500 after:absolute after:-bottom-0.5 after:left-0 after:h-0.5 after:w-full after:origin-left after:rounded-full after:bg-orange-500 after:transition-transform after:duration-300 ${isCurrent("/contacto") ? "text-orange-500 after:scale-x-100" : "opacity-80 after:scale-x-0 hover:after:scale-x-100"}`}>Contacto</a>
          </nav>
          <div className="flex items-center gap-2">
            <a href="/login" className="hidden sm:inline-flex items-center rounded-full px-3 py-1 text-sm bg-orange-500 text-white shadow-sm shadow-orange-500/30 transition-all duration-200 hover:bg-orange-600 hover:shadow-md hover:shadow-orange-500/30 active:scale-95">
              Ingresar
            </a>
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-full text-foreground hover:bg-muted"
              aria-label="Abrir menú"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="fixed right-0 top-0 h-full w-72 bg-background shadow-2xl animate-in slide-in-from-right">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <span className="text-sm font-semibold">Menú</span>
              <button
                onClick={() => setMobileOpen(false)}
                className="inline-flex items-center justify-center rounded-full p-1.5 hover:bg-muted"
                aria-label="Cerrar menú"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex flex-col gap-1 p-5">
              <a href="/verificar" aria-current={isCurrent("/verificar") ? "page" : undefined} className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${isCurrent("/verificar") ? "bg-orange-500/10 text-orange-600" : "hover:bg-muted"}`}>Verificar</a>
              <a href="/producto" aria-current={isCurrent("/producto") ? "page" : undefined} className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${isCurrent("/producto") ? "bg-orange-500/10 text-orange-600" : "hover:bg-muted"}`}>Producto</a>
              <a href="/#planes" aria-current={isCurrent("/#planes") ? "page" : undefined} className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${isCurrent("/#planes") ? "bg-orange-500/10 text-orange-600" : "hover:bg-muted"}`}>Precios</a>
              <a href="/marketplace" aria-current={isCurrent("/marketplace") ? "page" : undefined} className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${isCurrent("/marketplace") ? "bg-orange-500/10 text-orange-600" : "hover:bg-muted"}`}>Marketplace</a>
              <a href="/blog" aria-current={isCurrent("/blog") ? "page" : undefined} className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${isCurrent("/blog") ? "bg-orange-500/10 text-orange-600" : "hover:bg-muted"}`}>Blog</a>
              <a href="/contacto" aria-current={isCurrent("/contacto") ? "page" : undefined} className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${isCurrent("/contacto") ? "bg-orange-500/10 text-orange-600" : "hover:bg-muted"}`}>Contacto</a>
            </nav>
            <div className="p-5 border-t border-border">
              <a href="/login" className="flex items-center justify-center rounded-full px-4 py-2.5 text-sm bg-orange-500 text-white hover:bg-orange-600 transition-colors">
                Ingresar
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  )
}