import api from './api';
import { mostrarNotificacion, mostrarCargando, manejarError } from '../utils/notifications';

export const certificadosService = {
  // Validar certificado por código
  async validarCertificado(codigo) {
    const toastId = mostrarCargando('Validando certificado...');
    
    try {
      const response = await api.post('/api/v1/validaciones/validar', {
        codigo_certificado: codigo
      });
      
      // Cerrar toast de carga
      if (toastId) {
        toast.dismiss(toastId);
      }
      
      const { valido, mensaje, datos_certificado } = response.data;
      
      if (valido) {
        mostrarNotificacion.exito('✅ Certificado válido');
        if (mensaje) {
          mostrarNotificacion.informacion(mensaje);
        }
      } else {
        mostrarNotificacion.error('❌ Certificado inválido');
        if (mensaje) {
          mostrarNotificacion.advertencia(mensaje);
        }
      }
      
      return {
        success: true,
        valido,
        mensaje,
        datos: datos_certificado
      };
      
    } catch (error) {
      // Cerrar toast de carga
      if (toastId) {
        toast.dismiss(toastId);
      }
      
      const mensajeError = manejarError(error, 'Error al validar certificado');
      
      return {
        success: false,
        valido: false,
        mensaje: mensajeError,
        datos: null
      };
    }
  },

  // Obtener certificado por ID
  async obtenerCertificado(id) {
    try {
      const response = await api.get(`/api/v1/certificados/${id}`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      manejarError(error, 'Error al obtener certificado');
      return {
        success: false,
        data: null
      };
    }
  },

  // Listar certificados (para administradores)
  async listarCertificados(pagina = 1, limite = 10) {
    try {
      const response = await api.get('/api/v1/certificados', {
        params: { pagina, limite }
      });
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      manejarError(error, 'Error al listar certificados');
      return {
        success: false,
        data: []
      };
    }
  },

  // Generar certificado (para administradores)
  async generarCertificado(datos) {
    const toastId = mostrarCargando('Generando certificado...');
    
    try {
      const response = await api.post('/api/v1/certificados/generar', datos);
      
      // Cerrar toast de carga
      if (toastId) {
        toast.dismiss(toastId);
      }
      
      mostrarNotificacion.exito('✅ Certificado generado exitosamente');
      
      return {
        success: true,
        data: response.data
      };
      
    } catch (error) {
      // Cerrar toast de carga
      if (toastId) {
        toast.dismiss(toastId);
      }
      
      manejarError(error, 'Error al generar certificado');
      
      return {
        success: false,
        data: null
      };
    }
  }
};

export default certificadosService;