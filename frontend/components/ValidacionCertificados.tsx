import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Input, Button, Alert, Spinner } from './ui';
import { certificadoService } from '../services/certificadoService';
import { useToast } from '../hooks/use-toast';

interface CertificadoValidado {
  id: number;
  numero_certificado: string;
  titular: string;
  documento_identificacion: string;
  curso: string;
  fecha_emision: string;
  fecha_vencimiento: string;
  estado: 'vigente' | 'vencido' | 'cancelado';
}

export default function ValidacionCertificados() {
  const [numeroCertificado, setNumeroCertificado] = useState('');
  const [resultado, setResultado] = useState<CertificadoValidado | null>(null);
  const [loading, setLoading] = useState(false);
  const { showError, showSuccess } = useToast();

  const handleValidar = async () => {
    if (!numeroCertificado.trim()) {
      showError('Por favor ingrese un número de certificado');
      return;
    }

    setLoading(true);
    try {
      const data = await certificadoService.validarCertificado(numeroCertificado);
      setResultado(data.certificado ?? null);

      if (!data.valido) {
        showError(data.mensaje || 'Certificado no válido');
      } else if (data.certificado?.estado === 'vigente') {
        showSuccess('El certificado se encuentra vigente');
      } else if (data.certificado?.estado === 'vencido') {
        showError('El certificado ha vencido');
      }
    } catch (error) {
      setResultado(null);
      showError(error instanceof Error ? error.message : 'Certificado no encontrado o inválido');
    } finally {
      setLoading(false);
    }
  };

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'vigente':
        return 'bg-green-100 text-green-800';
      case 'vencido':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Validación de Certificados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label htmlFor="numero-certificado" className="block text-sm font-medium mb-2">
                Número de Certificado
              </label>
              <Input
                id="numero-certificado"
                type="text"
                placeholder="Ingrese el número de certificado"
                value={numeroCertificado}
                onChange={(e) => setNumeroCertificado(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleValidar()}
                disabled={loading}
              />
            </div>
            
            <Button 
              onClick={handleValidar} 
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <Spinner className="h-4 w-4" />
                  Validando...
                </div>
              ) : (
                'Validar Certificado'
              )}
            </Button>
          </div>

          {resultado && (
            <div className="mt-6 space-y-4">
              <Alert className={resultado.estado === 'vigente' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Estado:</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEstadoColor(resultado.estado)}`}>
                      {resultado.estado.toUpperCase()}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Certificado:</span>
                      <p className="text-gray-600">{resultado.numero_certificado}</p>
                    </div>
                    <div>
                      <span className="font-medium">Titular:</span>
                      <p className="text-gray-600">{resultado.titular}</p>
                    </div>
                    <div>
                      <span className="font-medium">Documento:</span>
                      <p className="text-gray-600">{resultado.documento_identificacion}</p>
                    </div>
                    <div>
                      <span className="font-medium">Curso:</span>
                      <p className="text-gray-600">{resultado.curso}</p>
                    </div>
                    <div>
                      <span className="font-medium">Fecha de emisión:</span>
                      <p className="text-gray-600">{resultado.fecha_emision}</p>
                    </div>
                    <div>
                      <span className="font-medium">Fecha de vencimiento:</span>
                      <p className="text-gray-600">{resultado.fecha_vencimiento}</p>
                    </div>
                  </div>
                </div>
              </Alert>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}