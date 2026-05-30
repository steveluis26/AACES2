import api from './api';

export interface Certificado {
  id: number;
  numero_certificado: string;
  nombre_cliente: string;
  producto: string;
  estado: string;
  fecha_emision: string;
  fecha_vencimiento: string;
  created_at: string;
  updated_at: string;
}

export interface ValidacionResponse {
  valido: boolean;
  mensaje: string;
  certificado?: Certificado;
}

export interface CreateCertificadoData {
  numero_certificado: string;
  nombre_cliente: string;
  producto: string;
  estado: string;
  fecha_emision: string;
  fecha_vencimiento: string;
}

export interface UpdateCertificadoData {
  nombre_cliente?: string;
  producto?: string;
  estado?: string;
  fecha_emision?: string;
  fecha_vencimiento?: string;
}

class CertificadosService {
  // Validar certificado
  async validarCertificado(numeroCertificado: string): Promise<ValidacionResponse> {
    try {
      const response = await api.post('/api/v1/validaciones/validar', {
        numero_certificado: numeroCertificado
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Certificado no encontrado');
      } else if (error.response?.status === 400) {
        throw new Error(error.response.data?.detail || 'Certificado inválido');
      } else {
        throw new Error('Error al validar el certificado');
      }
    }
  }

  // Obtener todos los certificados (admin)
  async getCertificados(): Promise<Certificado[]> {
    try {
      const response = await api.get('/api/v1/certificados/');
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('No autorizado para ver certificados');
      } else {
        throw new Error('Error al obtener certificados');
      }
    }
  }

  // Obtener certificado por ID
  async getCertificadoById(id: number): Promise<Certificado> {
    try {
      const response = await api.get(`/api/v1/certificados/${id}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Certificado no encontrado');
      } else {
        throw new Error('Error al obtener el certificado');
      }
    }
  }

  // Crear nuevo certificado (admin)
  async createCertificado(data: CreateCertificadoData): Promise<Certificado> {
    try {
      const response = await api.post('/api/v1/certificados/', data);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error(error.response.data?.detail || 'Error al crear el certificado');
      } else if (error.response?.status === 401) {
        throw new Error('No autorizado para crear certificados');
      } else {
        throw new Error('Error al crear el certificado');
      }
    }
  }

  // Actualizar certificado (admin)
  async updateCertificado(id: number, data: UpdateCertificadoData): Promise<Certificado> {
    try {
      const response = await api.put(`/api/v1/certificados/${id}`, data);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Certificado no encontrado');
      } else if (error.response?.status === 400) {
        throw new Error(error.response.data?.detail || 'Error al actualizar el certificado');
      } else if (error.response?.status === 401) {
        throw new Error('No autorizado para actualizar certificados');
      } else {
        throw new Error('Error al actualizar el certificado');
      }
    }
  }

  // Eliminar certificado (admin)
  async deleteCertificado(id: number): Promise<void> {
    try {
      await api.delete(`/api/v1/certificados/${id}`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Certificado no encontrado');
      } else if (error.response?.status === 401) {
        throw new Error('No autorizado para eliminar certificados');
      } else {
        throw new Error('Error al eliminar el certificado');
      }
    }
  }

  // Obtener certificados por cliente (cliente)
  async getCertificadosByCliente(clienteId: number): Promise<Certificado[]> {
    try {
      const response = await api.get(`/api/v1/certificados/cliente/${clienteId}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('No autorizado para ver estos certificados');
      } else {
        throw new Error('Error al obtener certificados del cliente');
      }
    }
  }
}

export const certificadosService = new CertificadosService();