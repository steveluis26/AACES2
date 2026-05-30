import { toast } from 'react-hot-toast';

export const mostrarNotificacion = {
  exito: (mensaje, duracion = 4000) => {
    toast.success(mensaje, {
      duration: duracion,
      position: 'top-right',
      style: {
        background: '#10B981',
        color: '#fff',
        padding: '16px',
        borderRadius: '8px',
        fontSize: '14px',
        fontWeight: '500'
      }
    });
  },

  error: (mensaje, duracion = 4000) => {
    toast.error(mensaje, {
      duration: duracion,
      position: 'top-right',
      style: {
        background: '#EF4444',
        color: '#fff',
        padding: '16px',
        borderRadius: '8px',
        fontSize: '14px',
        fontWeight: '500'
      }
    });
  },

  informacion: (mensaje, duracion = 4000) => {
    toast(mensaje, {
      duration: duracion,
      position: 'top-right',
      style: {
        background: '#3B82F6',
        color: '#fff',
        padding: '16px',
        borderRadius: '8px',
        fontSize: '14px',
        fontWeight: '500'
      }
    });
  },

  advertencia: (mensaje, duracion = 4000) => {
    toast(mensaje, {
      duration: duracion,
      position: 'top-right',
      style: {
        background: '#F59E0B',
        color: '#fff',
        padding: '16px',
        borderRadius: '8px',
        fontSize: '14px',
        fontWeight: '500'
      },
      icon: '⚠️'
    });
  }
};

export const manejarError = (error, mensajePorDefecto = 'Ocurrió un error inesperado') => {
  console.error('Error capturado:', error);
  
  let mensaje = mensajePorDefecto;
  
  if (error.response) {
    // Error de respuesta del servidor
    if (error.response.data && error.response.data.detail) {
      mensaje = error.response.data.detail;
    } else if (error.response.status === 401) {
      mensaje = 'No autorizado. Por favor, inicie sesión nuevamente.';
    } else if (error.response.status === 403) {
      mensaje = 'No tiene permisos para realizar esta acción.';
    } else if (error.response.status === 404) {
      mensaje = 'Recurso no encontrado.';
    } else if (error.response.status >= 500) {
      mensaje = 'Error del servidor. Por favor, intente más tarde.';
    }
  } else if (error.request) {
    // Error de red
    mensaje = 'Error de conexión. Verifique su conexión a internet.';
  } else if (error.message) {
    // Error de configuración
    mensaje = error.message;
  }
  
  mostrarNotificacion.error(mensaje);
  return mensaje;
};

export const mostrarCargando = (mensaje = 'Procesando...') => {
  return toast.loading(mensaje, {
    position: 'top-right',
    style: {
      background: '#6B7280',
      color: '#fff',
      padding: '16px',
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: '500'
    }
  });
};