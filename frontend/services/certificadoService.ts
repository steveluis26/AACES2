import { api } from './api';

export interface ValidarCertificadoRequest {
  numero_certificado: string;
  documento_identificacion?: string;
}

export interface ValidarCertificadoResponse {
  valido: boolean;
  mensaje: string;
  certificado?: {
    id: number;
    numero_certificado: string;
    titular: string;
    documento_identificacion: string;
    curso: string;
    fecha_emision: string;
    fecha_vencimiento: string;
    estado: 'vigente' | 'vencido' | 'cancelado';
    horas_duracion: number;
    instructor: string;
  };
}

export interface CrearCertificadoRequest {
  titular: string;
  documento_identificacion: string;
  curso: string;
  fecha_emision: string;
  fecha_vencimiento: string;
  horas_duracion: number;
  instructor: string;
}

export interface CrearCertificadoResponse {
  id: number;
  numero_certificado: string;
  titular: string;
  documento_identificacion: string;
  curso: string;
  fecha_emision: string;
  fecha_vencimiento: string;
  estado: 'vigente' | 'vencido' | 'cancelado';
  horas_duracion: number;
  instructor: string;
  fecha_creacion: string;
}

class CertificadoService {
  async validarCertificado(numeroCertificado: string, documentoIdentificacion?: string): Promise<ValidarCertificadoResponse> {
    try {
      const request: ValidarCertificadoRequest = {
        numero_certificado: numeroCertificado,
        documento_identificacion: documentoIdentificacion
      };

      const response = await api.post<ValidarCertificadoResponse>('/validaciones/validar', request);
      return response.data;
    } catch (error: any) {
      console.error('Error validando certificado:', error);
      
      // Manejar errores específicos
      if (error.response?.status === 404) {
        return {
          valido: false,
          mensaje: 'Certificado no encontrado'
        };
      }
      
      if (error.response?.status === 422) {
        return {
          valido: false,
          mensaje: 'Datos de validación inválidos'
        };
      }
      
      if (error.response?.data?.detail) {
        return {
          valido: false,
          mensaje: error.response.data.detail
        };
      }
      
      return {
        valido: false,
        mensaje: 'Error al validar el certificado'
      };
    }
  }

  async crearCertificado(data: CrearCertificadoRequest): Promise<CrearCertificadoResponse> {
    try {
      const response = await api.post<CrearCertificadoResponse>('/certificados/', data);
      return response.data;
    } catch (error: any) {
      console.error('Error creando certificado:', error);
      
      if (error.response?.status === 422) {
        throw new Error('Datos del certificado inválidos');
      }
      
      if (error.response?.status === 403) {
        throw new Error('No tiene permisos para crear certificados');
      }
      
      if (error.response?.data?.detail) {
        throw new Error(error.response.data.detail);
      }
      
      throw new Error('Error al crear el certificado');
    }
  }

  async obtenerCertificados(params?: {
    skip?: number;
    limit?: number;
    titular?: string;
    documento?: string;
    curso?: string;
    estado?: string;
  }): Promise<{
    certificados: CrearCertificadoResponse[];
    total: number;
    pagina: number;
    limite: number;
  }> {
    try {
      const response = await api.get('/certificados/', { params });
      return response.data;
    } catch (error: any) {
      console.error('Error obteniendo certificados:', error);
      
      if (error.response?.status === 403) {
        throw new Error('No tiene permisos para ver certificados');
      }
      
      throw new Error('Error al obtener los certificados');
    }
  }

  async obtenerCertificado(id: number): Promise<CrearCertificadoResponse> {
    try {
      const response = await api.get(`/certificados/${id}`);
      return response.data;
    } catch (error: any) {
      console.error('Error obteniendo certificado:', error);
      
      if (error.response?.status === 404) {
        throw new Error('Certificado no encontrado');
      }
      
      if (error.response?.status === 403) {
        throw new Error('No tiene permisos para ver este certificado');
      }
      
      throw new Error('Error al obtener el certificado');
    }
  }

  async cancelarCertificado(id: number): Promise<{ mensaje: string }> {
    try {
      const response = await api.patch(`/certificados/${id}/cancelar`);
      return response.data;
    } catch (error: any) {
      console.error('Error cancelando certificado:', error);
      
      if (error.response?.status === 404) {
        throw new Error('Certificado no encontrado');
      }
      
      if (error.response?.status === 403) {
        throw new Error('No tiene permisos para cancelar certificados');
      }
      
      if (error.response?.status === 400) {
        throw new Error('El certificado ya está cancelado o no se puede cancelar');
      }
      
      throw new Error('Error al cancelar el certificado');
    }
  }

  async renovarCertificado(id: number, nuevaFechaVencimiento: string): Promise<CrearCertificadoResponse> {
    try {
      const response = await api.patch(`/certificados/${id}/renovar`, {
        fecha_vencimiento: nuevaFechaVencimiento
      });
      return response.data;
    } catch (error: any) {
      console.error('Error renovando certificado:', error);
      
      if (error.response?.status === 404) {
        throw new Error('Certificado no encontrado');
      }
      
      if (error.response?.status === 403) {
        throw new Error('No tiene permisos para renovar certificados');
      }
      
      if (error.response?.status === 400) {
        throw new Error('El certificado no se puede renovar');
      }
      
      throw new Error('Error al renovar el certificado');
    }
  }
}

export const certificadoService = new CertificadoService();