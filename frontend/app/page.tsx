'use client';

export const dynamic = 'force-dynamic'

import { Suspense, useState, useCallback, useEffect } from 'react';
import { Shield, CheckCircle, Loader2 } from 'lucide-react';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner';
import Image from 'next/image';
import { LogoCloud3 } from '@/components/ui/logo-cloud-3'
import { useSearchParams } from 'next/navigation';
import HeroSection from '@/components/landing/hero-section'
import FeaturesSection from '@/components/landing/features-section'
import PlansSection from '@/components/landing/plans-section'
import FooterSection from 'src/components/footer'
import CommunitySection from 'src/components/content-6'

interface ValidationResult {
  valido: boolean;
  mensaje: string;
  datos_certificado?: {
    nombre_participante: string;
    nombre_curso: string;
    codigo_curso: string;
    fecha_inicio: string;
    fecha_fin: string;
    duracion_horas: number;
    calificacion?: number;
    fecha_emision?: string;
    fecha_expiracion?: string;
    id_certificado?: string;
    constancias?: string[];
    capacitador?: string;
    estado?: string;
  };
  intentos_restantes?: number;
}

export default function Home() {
  const [validationCode, setValidationCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState(5);
  const [openDetails, setOpenDetails] = useState(false)
  

  const printDetails = useCallback(() => {
    const d = validationResult?.datos_certificado as any
    const ex = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('cliente_profile_extra') || '{}') : {}
    const capdisp = String(ex.empresa || (d?.capacitador || '-'))
    if (!d) return
    const consts = Array.isArray(d.constancias) ? d.constancias : []
    const estado = String(d.estado || (d.fecha_expiracion && new Date(d.fecha_expiracion) < new Date() ? 'Vencido' : 'Activo'))
    const rawInput = validationCode.trim().toUpperCase()
    const verifyUrl = `${window.location.origin}/?code=${encodeURIComponent(rawInput)}`
    const html = `<!doctype html>
    <html lang="es">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Constancia AACES</title>
      <style>
        @page { margin: 28mm 20mm; }
        :root { --primary: #ff6a00; --text: #0f172a; --muted: #475569; --border: #e2e8f0; }
        body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji"; color: var(--text); }
        .sheet { max-width: 800px; margin: 0 auto; border: 1px solid var(--border); border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.08); text-transform: uppercase; }
        .brand { display:flex; align-items:center; justify-content:space-between; padding: 24px 28px; background: linear-gradient(180deg, #fff, #f8fafc); border-bottom: 1px solid var(--border); }
        .brand-left { display:flex; align-items:center; gap:14px; }
        .brand-name { font-size:22px; font-weight:700; letter-spacing:0.2px; }
        .brand-tag { font-size:12px; color: var(--muted); }
        .badge { font-size:12px; padding: 6px 10px; border-radius: 999px; border: 1px solid var(--border); background: #fff; }
        .content { padding: 24px 28px; }
        .row { display:flex; gap:12px; align-items:flex-start; margin: 8px 0; }
        .label { min-width: 220px; font-weight:600; color: var(--muted); }
        .value { flex: 1; }
        .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
        .verify { display:flex; align-items:center; justify-content:space-between; gap:16px; margin-top:16px; }
        .verify-url { font-size:12px; color: var(--muted); }
        .qr { border: 1px solid var(--border); padding:6px; border-radius:8px; background:#fff; }
        .footer { display:flex; justify-content:space-between; align-items:center; padding: 16px 28px; border-top: 1px solid var(--border); background:#fff; color: var(--muted); font-size:12px; }
        .status { font-weight:700; }
        .watermark { position:fixed; inset:0; pointer-events:none; opacity:0.04; background-image:url('/logo.png'); background-repeat:no-repeat; background-position:center; background-size: 400px auto; }
      </style>
    </head>
    <body>
      <div class="watermark"></div>
      <div class="sheet">
        <div class="brand">
          <div class="brand-left">
            <img src="/logo.png" alt="AACES" style="height:40px" />
            <div>
              <div class="brand-name">AACES</div>
              <div class="brand-tag"></div>
            </div>
          </div>
          <div class="badge">Certificación Verificada</div>
        </div>
        <div class="content">
          <div class="row"><div class="label">ID Certificado</div><div class="value mono">${String(d.id_certificado || '-')}</div></div>
          <div class="row"><div class="label">Nombre completo</div><div class="value">${String(d.nombre_participante || '-')}</div></div>
          <div class="row"><div class="label">Fecha del curso</div><div class="value">${d.fecha_inicio ? new Date(d.fecha_inicio).toLocaleDateString('es-ES') : '-'}</div></div>
          <div class="row"><div class="label">Fecha de expiración</div><div class="value">${d.fecha_expiracion ? new Date(d.fecha_expiracion).toLocaleDateString('es-ES') : 'No expira'}</div></div>
          <div class="row"><div class="label">Nombre del curso</div><div class="value">${String(d.nombre_curso || '-')}</div></div>
          <div class="row"><div class="label">Constancias asociadas</div><div class="value">${consts.length ? consts.join(', ') : '-'}</div></div>
          <div class="row"><div class="label">Capacitador</div><div class="value">${capdisp}</div></div>
          <div class="row"><div class="label">Estado</div><div class="value status">${estado}</div></div>
          <div class="verify">
            <div class="verify-url">Verificación en línea: ${verifyUrl}</div>
            <img class="qr" src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(verifyUrl)}" alt="QR" />
          </div>
        </div>
        <div class="footer">
          <div>Emitido por AACES · aaces.com</div>
          <div>Este documento confirma la validez del certificado.</div>
        </div>
      </div>
      <script>window.onload = function(){ window.print(); window.onafterprint = function(){ window.close(); }; };</script>
    </body>
    </html>`
    const w = window.open('', '_blank')
    if (!w) return
    w.document.open()
    w.document.write(html)
    w.document.close()
    w.focus()
  }, [validationResult, validationCode])

  const runValidation = useCallback(async () => {
    if (!validationCode.trim()) {
      toast.error('Por favor ingrese un código de validación');
      return;
    }
    setIsValidating(true);
    try {
      const raw = validationCode.trim().toUpperCase();
      const code = raw.startsWith('CERT-') ? raw.slice(5) : raw;
      const response = await fetch('/api/v1/validaciones/validar-certificado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo_validacion: code, ip_address: '127.0.0.1', user_agent: navigator.userAgent })
      });
      const result = await response.json();
      const normalized = result && result.certificado ? { ...result, datos_certificado: (result.datos_certificado ?? result.certificado) } : result;
      setValidationResult(normalized);
      if (result.intentos_restantes !== undefined) setAttemptsLeft(result.intentos_restantes);
      if (result.valido) { toast.success('Certificado validado exitosamente'); setOpenDetails(true) } else { toast.error(result.mensaje) }
    } catch (error) {
      toast.error('Error al validar el certificado');
      console.error('Validation error:', error);
    } finally {
      setIsValidating(false);
    }
  }, [validationCode])

  const validateCertificate = async (e: React.FormEvent) => { e.preventDefault(); await runValidation() }

  const searchParams = useSearchParams()
  useEffect(() => {
    const code = searchParams?.get('code')
    if (code && !validationResult) {
      setValidationCode(code.toUpperCase())
      setTimeout(() => { runValidation() }, 0)
    }
  }, [searchParams, runValidation, validationResult])

  return (
    <Suspense fallback={<div className="flex min-h-svh items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" /></div>}>
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">

      <HeroSection
        value={validationCode}
        onChange={(v) => setValidationCode(v.toUpperCase())}
        onSubmit={validateCertificate}
        loading={isValidating}
        attemptsLeft={attemptsLeft}
      />
      <FeaturesSection />
      <PlansSection />

      {/* Validation Result */}
      {validationResult && (
        <section className="py-12 bg-[var(--card)] text-[var(--card-foreground)] border-t border-[var(--border)]">
          <div className="max-w-4xl mx-auto px-4">
            <div className={`card ${validationResult.valido ? 'border-success-200 bg-success-50' : 'border-error-200 bg-error-50'}`}>
              <div className="card-body">
                <div className="flex items-center mb-4">
                  {validationResult.valido ? (
                    <CheckCircle className="w-8 h-8 text-success-600 mr-3" />
                  ) : (
                    <Shield className="w-8 h-8 text-error-600 mr-3" />
                  )}
                  <h3 className={`text-xl font-semibold ${validationResult.valido ? 'text-success-800' : 'text-error-800'}`}>
                    {validationResult.mensaje}
                  </h3>
                </div>
                
                {validationResult.datos_certificado && (
                  <div className="grid md:grid-cols-2 gap-4 sm:gap-6 mt-6">
                    <div className="space-y-2 sm:space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Participante</label>
                        <p className="text-gray-900 font-medium">{validationResult.datos_certificado.nombre_participante}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Curso</label>
                        <p className="text-gray-900 font-medium">{validationResult.datos_certificado.nombre_curso}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Código del Curso</label>
                        <p className="text-gray-900 font-mono">{validationResult.datos_certificado.codigo_curso}</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Duración</label>
                        <p className="text-gray-900">{validationResult.datos_certificado.duracion_horas} horas</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Fecha de Emisión</label>
                        <p className="text-gray-900">
                          {validationResult.datos_certificado.fecha_emision 
                            ? new Date(validationResult.datos_certificado.fecha_emision).toLocaleDateString('es-ES')
                            : 'No disponible'}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Fecha de Expiración</label>
                        <p className="text-gray-900">
                          {validationResult.datos_certificado.fecha_expiracion
                            ? new Date(validationResult.datos_certificado.fecha_expiracion).toLocaleDateString('es-ES')
                            : 'No expira'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      <Dialog open={openDetails} onClose={() => setOpenDetails(false)}>
        <DialogHeader>
          <DialogTitle>Certificación Verificada</DialogTitle>
        </DialogHeader>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          {validationResult?.datos_certificado ? (
            <div className="space-y-3 uppercase break-words">
              <div className="flex justify-center">
                <Image src="/logo.png" alt="AACES" width={160} height={40} />
              </div>
              <div className="font-mono break-all"><span className="font-semibold">ID Certificado:</span> {String(validationResult.datos_certificado.id_certificado || '-')}</div>
              <div><span className="font-semibold">Nombre completo:</span> {String(validationResult.datos_certificado.nombre_participante || '-')}</div>
              <div><span className="font-semibold">Fecha del curso:</span> {validationResult.datos_certificado.fecha_inicio ? new Date(validationResult.datos_certificado.fecha_inicio).toLocaleDateString('es-ES') : '-'}</div>
              <div><span className="font-semibold">Fecha de expiración:</span> {validationResult.datos_certificado.fecha_expiracion ? new Date(validationResult.datos_certificado.fecha_expiracion).toLocaleDateString('es-ES') : 'No expira'}</div>
              <div><span className="font-semibold">Nombre del curso:</span> {String(validationResult.datos_certificado.nombre_curso || '-')}</div>
              <div>
                <span className="font-semibold">Constancias:</span> {Array.isArray((validationResult.datos_certificado as any).constancias) && (validationResult.datos_certificado as any).constancias.length > 0 ? ((validationResult.datos_certificado as any).constancias as string[]).join(', ') : '-'}
              </div>
              <div><span className="font-semibold">Capacitador:</span> {String((JSON.parse(typeof window !== 'undefined' ? (localStorage.getItem('cliente_profile_extra') || '{}') : '{}').empresa) || (validationResult.datos_certificado as any).capacitador || '-')}</div>
              <div><span className="font-semibold">Estado:</span> {String((validationResult.datos_certificado as any).estado || (validationResult.datos_certificado.fecha_expiracion && new Date(validationResult.datos_certificado.fecha_expiracion) < new Date() ? 'Vencido' : 'Activo'))}</div>
            </div>
          ) : null}
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={printDetails}>Imprimir/Descargar</Button>
          <Button onClick={() => setOpenDetails(false)}>Cerrar</Button>
        </DialogFooter>
      </Dialog>

      <CommunitySection />

      <section className="py-12 md:py-16 bg-[var(--card)] text-[var(--card-foreground)] border-t border-[var(--border)]" role="region" aria-label="Logo Cloud">
        <LogoCloud3 />
      </section>

      

      <FooterSection />
    </div>
    </Suspense>
  );
}
