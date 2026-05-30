'use client'

import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerTrigger, DrawerContent, DrawerClose, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'

export function MobileNav() {
  return (
    <div className="md:hidden">
      <Drawer>
        <DrawerTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Abrir menú">
            <Menu className="w-5 h-5" />
          </Button>
        </DrawerTrigger>
        <DrawerContent className="p-4">
          <DrawerHeader>
            <div className="flex items-center justify-between">
              <DrawerTitle>Menú</DrawerTitle>
              <DrawerClose asChild>
                <Button variant="ghost" size="icon" aria-label="Cerrar">
                  <X className="w-5 h-5" />
                </Button>
              </DrawerClose>
            </div>
          </DrawerHeader>
          <nav className="p-4 pt-0 flex flex-col gap-2">
            <Link href="/" className="px-3 py-2 rounded hover:bg-muted">Inicio</Link>
            <Link href="/blog" className="px-3 py-2 rounded hover:bg-muted">Blog</Link>
            <Link href="/nosotros" className="px-3 py-2 rounded hover:bg-muted">Nosotros</Link>
            <Link href="/contacto" className="px-3 py-2 rounded hover:bg-muted">Contacto</Link>
            <Link href="/login" className="px-3 py-2 rounded hover:bg-muted">Login</Link>
          </nav>
        </DrawerContent>
      </Drawer>
    </div>
  )
}
