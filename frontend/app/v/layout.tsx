import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Verificar documento — AACES',
  description: 'Documento verificado mediante AACES',
}

export default function VLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${inter.className} min-h-screen bg-gradient-to-b from-white to-gray-50`}>
      {children}
    </div>
  )
}
