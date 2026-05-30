import api from './api';

const validacionesService = {
  // Validar certificado
  validarCertificado: async (codigoCertificado) => {
    try {
      const response = await api.post('/validaciones/validar', {
        codigo_certificado: codigoCertificado,
      });
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || 'Error al validar certificado',
      };
    }
  },

  // Obtener historial de validaciones (admin)
  getHistorialValidaciones: async () => {
    try {
      const response = await api.get('/validaciones/historial');
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || 'Error al obtener historial',
      };
    }
  },

  // Obtener estadísticas de validaciones (admin)
  getEstadisticasValidaciones: async () => {
    try {
      const response = await api.get('/validaciones/estadisticas');
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || 'Error al obtener estadísticas',
      };
    }
  },
};

export default validacionesService;