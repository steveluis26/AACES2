export const metadata = {
  title: 'Verificación de certificado — AACES',
  description: 'Consulta la autenticidad y vigencia de una constancia emitida a través de AACES.',
  robots: { index: false, follow: false },
}

export default function VLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <style>{`
        @media print {
          /* Solo se imprime el certificado */
          body * { visibility: hidden !important; }
          #certificado, #certificado * { visibility: visible !important; }
          #certificado { position: absolute; left: 0; top: 0; width: 100%; }
          body { background: #fff !important; }
          @page { size: A4; margin: 14mm; }
        }
      `}</style>
      {children}
    </div>
  )
}
