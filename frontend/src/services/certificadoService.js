import axios from 'axios';

const API_URL = '/api/v1/certificados';

class CertificadoService {
  async crearCertificado(certificadoData) {
    try {
      const response = await axios.post(`${API_URL}/crear`, certificadoData);

      return {
        success: true,
        data: response.data,
        message: 'Certificado creado exitosamente'
      };
    } catch (error) {
      let errorMessage = 'Error al crear certificado';
      
      if (error.response?.status === 400) {
        const detail = error.response.data?.detail;
        if (Array.isArray(detail)) {
          errorMessage = detail[0]?.msg || 'Datos inválidos';
        } else {
          errorMessage = detail || 'Datos inválidos';
        }
      } else if (error.response?.status === 403) {
        errorMessage = 'No tiene permisos para crear certificados';
      } else if (error.code === 'ERR_NETWORK') {
        errorMessage = 'Error de conexión. Verifique su conexión a internet';
      }

      return {
        success: false,
        message: errorMessage,
        error: error
      };
    }
  }

  async obtenerCertificados(filtros = {}) {
    try {
      const params = new URLSearchParams();
      
      if (filtros.estado) params.append('estado', filtros.estado);
      if (filtros.cliente_id) params.append('cliente_id', filtros.cliente_id);
      if (filtros.limit) params.append('limit', filtros.limit);
      if (filtros.offset) params.append('offset', filtros.offset);

      const response = await axios.get(`${API_URL}/listar?${params.toString()}`);

      return {
        success: true,
        data: response.data,
        message: 'Certificados obtenidos exitosamente'
      };
    } catch (error) {
      let errorMessage = 'Error al obtener certificados';
      
      if (error.response?.status === 403) {
        errorMessage = 'No tiene permisos para ver certificados';
      } else if (error.code === 'ERR_NETWORK') {
        errorMessage = 'Error de conexión. Verifique su conexión a internet';
      }

      return {
        success: false,
        message: errorMessage,
        error: error
      };
    }
  }

  async obtenerCertificadoPorId(id) {
    try {
      const response = await axios.get(`${API_URL}/obtener/${id}`);

      return {
        success: true,
        data: response.data,
        message: 'Certificado obtenido exitosamente'
      };
    } catch (error) {
      let errorMessage = 'Error al obtener certificado';
      
      if (error.response?.status === 404) {
        errorMessage = 'Certificado no encontrado';
      } else if (error.response?.status === 403) {
        errorMessage = 'No tiene permisos para ver este certificado';
      } else if (error.code === 'ERR_NETWORK') {
        errorMessage = 'Error de conexión. Verifique su conexión a internet';
      }

      return {
        success: false,
        message: errorMessage,
        error: error
      };
    }
  }

  async actualizarCertificado(id, certificadoData) {
    try {
      const response = await axios.put(`${API_URL}/actualizar/${id}`, certificadoData);

      return {
        success: true,
        data: response.data,
        message: 'Certificado actualizado exitosamente'
      };
    } catch (error) {
      let errorMessage = 'Error al actualizar certificado';
      
      if (error.response?.status === 404) {
        errorMessage = 'Certificado no encontrado';
      } else if (error.response?.status === 400) {
        const detail = error.response.data?.detail;
        if (Array.isArray(detail)) {
          errorMessage = detail[0]?.msg || 'Datos inválidos';
        } else {
          errorMessage = detail || 'Datos inválidos';
        }
      } else if (error.response?.status === 403) {
        errorMessage = 'No tiene permisos para actualizar certificados';
      } else if (error.code === 'ERR_NETWORK') {
        errorMessage = 'Error de conexión. Verifique su conexión a internet';
      }

      return {
        success: false,
        message: errorMessage,
        error: error
      };
    }
  }

  async eliminarCertificado(id) {
    try {
      const response = await axios.delete(`${API_URL}/eliminar/${id}`);

      return {
        success: true,
        data: response.data,
        message: 'Certificado eliminado exitosamente'
      };
    } catch (error) {
      let errorMessage = 'Error al eliminar certificado';
      
      if (error.response?.status === 404) {
        errorMessage = 'Certificado no encontrado';
      } else if (error.response?.status === 403) {
        errorMessage = 'No tiene permisos para eliminar certificados';
      } else if (error.code === 'ERR_NETWORK') {
        errorMessage = 'Error de conexión. Verifique su conexión a internet';
      }

      return {
        success: false,
        message: errorMessage,
        error: error
      };
    }
  }

  async generarPDF(id) {
    try {
      const response = await axios.get(`${API_URL}/generar-pdf/${id}`, {
        responseType: 'blob'
      });

      return {
        success: true,
        data: response.data,
        message: 'PDF generado exitosamente'
      };
    } catch (error) {
      let errorMessage = 'Error al generar PDF';
      
      if (error.response?.status === 404) {
        errorMessage = 'Certificado no encontrado';
      } else if (error.response?.status === 403) {
        errorMessage = 'No tiene permisos para generar PDF';
      } else if (error.code === 'ERR_NETWORK') {
        errorMessage = 'Error de conexión. Verifique su conexión a internet';
      }

      return {
        success: false,
        message: errorMessage,
        error: error
      };
    }
  }
}

export default new CertificadoService();