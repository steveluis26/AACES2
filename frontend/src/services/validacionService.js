import axios from 'axios';

const API_URL = '/api/v1/validaciones';

class ValidacionService {
  async validarCertificado(numeroCertificado) {
    try {
      if (!numeroCertificado) {
        return {
          success: false,
          message: 'Por favor ingrese un número de certificado'
        };
      }

      const response = await axios.post(`${API_URL}/validar`, {
        numero_certificado: numeroCertificado.trim()
      });

      return {
        success: true,
        data: response.data,
        message: 'Certificado validado exitosamente'
      };
    } catch (error) {
      let errorMessage = 'Error al validar certificado';
      
      if (error.response?.status === 404) {
        errorMessage = 'Certificado no encontrado';
      } else if (error.response?.status === 400) {
        errorMessage = 'Número de certificado inválido';
      } else if (error.response?.status === 422) {
        const detail = error.response.data?.detail;
        if (Array.isArray(detail)) {
          errorMessage = detail[0]?.msg || 'Datos inválidos';
        } else {
          errorMessage = detail || 'Datos inválidos';
        }
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

  async obtenerHistorialValidaciones(filtros = {}) {
    try {
      const params = new URLSearchParams();
      
      if (filtros.fecha_inicio) params.append('fecha_inicio', filtros.fecha_inicio);
      if (filtros.fecha_fin) params.append('fecha_fin', filtros.fecha_fin);
      if (filtros.estado) params.append('estado', filtros.estado);
      if (filtros.limit) params.append('limit', filtros.limit);
      if (filtros.offset) params.append('offset', filtros.offset);

      const response = await axios.get(`${API_URL}/historial?${params.toString()}`);

      return {
        success: true,
        data: response.data,
        message: 'Historial obtenido exitosamente'
      };
    } catch (error) {
      let errorMessage = 'Error al obtener historial';
      
      if (error.response?.status === 403) {
        errorMessage = 'No tiene permisos para ver este historial';
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

  async obtenerEstadisticas() {
    try {
      const response = await axios.get(`${API_URL}/estadisticas`);

      return {
        success: true,
        data: response.data,
        message: 'Estadísticas obtenidas exitosamente'
      };
    } catch (error) {
      let errorMessage = 'Error al obtener estadísticas';
      
      if (error.response?.status === 403) {
        errorMessage = 'No tiene permisos para ver estadísticas';
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

export default new ValidacionService();