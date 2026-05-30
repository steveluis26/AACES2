'use client';

import { useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { apiService } from '@/lib/api';

export interface CertificateValidation {
  id: string;
  codigo: string;
  participante_nombre: string;
  curso_nombre: string;
  fecha_emision: string;
  fecha_expiracion: string;
  estado: 'valido' | 'expirado' | 'invalido';
  mensaje: string;
}

export interface UseCertificateReturn {
  validateCertificate: (code: string) => Promise<CertificateValidation | null>;
  isLoading: boolean;
  lastValidation: CertificateValidation | null;
}

export function useCertificate(): UseCertificateReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [lastValidation, setLastValidation] = useState<CertificateValidation | null>(null);

  const validateCertificate = useCallback(async (code: string): Promise<CertificateValidation | null> => {
    if (!code.trim()) {
      toast.error('Por favor ingrese un código de certificado');
      return null;
    }

    setIsLoading(true);
    
    try {
      const response = await apiService.validarCertificado(code.trim());
      const validation = response.data;
      
      setLastValidation(validation);
      
      // Mostrar mensaje según el estado
      switch (validation.estado) {
        case 'valido':
          toast.success('✅ Certificado válido y vigente');
          break;
        case 'expirado':
          toast.error('⚠️ Certificado válido pero expirado');
          break;
        case 'invalido':
          toast.error('❌ Certificado inválido o no encontrado');
          break;
        default:
          toast(validation.mensaje || 'Validación completada');
      }
      
      return validation;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al validar certificado';
      toast.error(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    validateCertificate,
    isLoading,
    lastValidation,
  };
}