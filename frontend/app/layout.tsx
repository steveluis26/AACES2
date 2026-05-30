import './globals.css';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import { ReactQueryProvider } from '@/lib/react-query';
import { ThemeProvider } from '@/components/theme-provider'
import { HeroHeader } from '@/components/header'
import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'AACES',
  description: 'Sistema integral para la gestión de cursos, participantes y certificaciones',
  keywords: 'capacitación, cursos, certificaciones, educación',
  authors: [{ name: 'AACES' }],
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/logo.png',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={inter.className} suppressHydrationWarning>
      <body className="min-h-screen">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <ReactQueryProvider>
            <Suspense fallback={<div className="flex min-h-svh items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" /></div>}>
              <HeroHeader />
              {children}
            </Suspense>
            <Toaster 
              position="top-right" 
              expand={true}
              richColors
              closeButton
              duration={4000}
            />
          </ReactQueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
