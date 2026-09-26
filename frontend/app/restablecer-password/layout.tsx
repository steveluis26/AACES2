import type { Metadata } from "next"

// El enlace trae el token en la URL: que no se filtre en el Referer.
export const metadata: Metadata = { title: "Restablecer contraseña · AACES", referrer: "no-referrer" }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
