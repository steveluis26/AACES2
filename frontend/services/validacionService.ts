import axios from 'axios';

const API_URL = '/api/v1';

export interface ValidacionResponse {
  es_valido: boolean;
  mensaje: string;
  certificado?: {
    id: number;
    codigo_certificado: string;
    tipo_certificado: string;
    fecha_emision: string;
    fecha_vencimiento: string;
    estado: string;
    cliente_nombre: string;
    cliente_email: string;
  };
  errores?: string[];
}

export interface ValidacionRequest {
  codigo_certificado: string;
}

class ValidacionService {
  // Validar certificado
  async validarCertificado(codigo: string): Promise<ValidacionResponse> {
    try {
      const response = await axios.post(`${API_URL}/validaciones/validar`, {
        codigo_certificado: codigo
      });
      
      return response.data;
    } catch (error: any) {
      console.error('Error validando certificado:', error);
      
      // Manejar errores específicos
      if (error.response?.status === 404) {
        return {
          es_valido: false,
          mensaje: 'Certificado no encontrado en el sistema'
        };
      } else if (error.response?.status === 400) {
        return {
          es_valido: false,
          mensaje: 'Datos inválidos para la validación'
        };
      } else if (error.response?.status === 401) {
        return {
          es_valido: false,
          mensaje: 'No autorizado para realizar esta validación'
        };
      }
      
      // Error genérico
      return {
        es_valido: false,
        mensaje: 'Error al validar el certificado. Por favor, intente nuevamente.'
      };
    }
  }

  // Obtener historial de validaciones (para administradores)
  async obtenerHistorialValidaciones(filtros?: {
    fecha_inicio?: string;
    fecha_fin?: string;
    cliente_id?: number;
    limite?: number;
    offset?: number;
  }): Promise<any> {
    try {
      const params = new URLSearchParams();
      
      if (filtros) {
        Object.entries(filtros).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            params.append(key, value.toString());
          }
        });
      }

      const response = await axios.get(`${API_URL}/validaciones/historial?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Error obteniendo historial de validaciones:', error);
      throw error;
    }
  }

  // Obtener estadísticas de validaciones (para administradores)
  async obtenerEstadisticasValidaciones(): Promise<any> {
    try {
      const response = await axios.get(`${API_URL}/validaciones/estadisticas`);
      return response.data;
    } catch (error) {
      console.error('Error obteniendo estadísticas de validaciones:', error);
      throw error;
    }
  }
}

export const validacionService = new ValidacionService();