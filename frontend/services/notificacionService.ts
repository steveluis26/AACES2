import { api } from './api';

export interface Notificacion {
  id: number;
  titulo: string;
  mensaje: string;
  tipo: 'info' | 'success' | 'warning' | 'error' | 'system';
  usuario_id: number;
  usuario_nombre: string;
  leida: boolean;
  fecha_creacion: string;
  fecha_lectura?: string;
  accion_requerida?: string;
  datos_adicionales?: Record<string, any>;
  prioridad: 'baja' | 'media' | 'alta' | 'critica';
  categoria: 'sistema' | 'certificado' | 'usuario' | 'auditoria' | 'alerta';
  notificacion_push: boolean;
  notificacion_email: boolean;
  notificacion_sms: boolean;
}

export interface CrearNotificacion {
  titulo: string;
  mensaje: string;
  tipo: 'info' | 'success' | 'warning' | 'error' | 'system';
  usuario_id?: number;
  accion_requerida?: string;
  datos_adicionales?: Record<string, any>;
  prioridad?: 'baja' | 'media' | 'alta' | 'critica';
  categoria?: 'sistema' | 'certificado' | 'usuario' | 'auditoria' | 'alerta';
  notificacion_push?: boolean;
  notificacion_email?: boolean;
  notificacion_sms?: boolean;
}

export interface PreferenciasNotificacion {
  id: number;
  usuario_id: number;
  categoria: string;
  tipo_notificacion: 'push' | 'email' | 'sms';
  activa: boolean;
  horario_inicio?: string;
  horario_fin?: string;
  dias_semana?: number[];
  frecuencia_maxima?: number;
  fecha_creacion: string;
  fecha_actualizacion: string;
}

export interface ConfigurarPreferencias {
  categoria: string;
  tipo_notificacion: 'push' | 'email' | 'sms';
  activa: boolean;
  horario_inicio?: string;
  horario_fin?: string;
  dias_semana?: number[];
  frecuencia_maxima?: number;
}

export interface FiltrosNotificacion {
  leida?: boolean;
  tipo?: string;
  categoria?: string;
  prioridad?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  usuario_id?: number;
  limit?: number;
  offset?: number;
}

export interface EstadisticasNotificacion {
  total: number;
  no_leidas: number;
  por_tipo: Record<string, number>;
  por_categoria: Record<string, number>;
  por_prioridad: Record<string, number>;
  ultimas_24h: number;
  ultima_semana: number;
  ultimo_mes: number;
}

class NotificacionService {
  async obtenerNotificaciones(filtros: FiltrosNotificacion = {}): Promise<{
    notificaciones: Notificacion[];
    total: number;
    limit: number;
    offset: number;
  }> {
    try {
      const response = await api.get('/notificaciones', { params: filtros });
      return response.data;
    } catch (error: any) {
      console.error('Error obteniendo notificaciones:', error);
      
      if (error.response?.status === 403) {
        throw new Error('No tiene permisos para ver notificaciones');
      }
      
      throw new Error('Error al obtener notificaciones');
    }
  }

  async obtenerNotificacion(id: number): Promise<Notificacion> {
    try {
      const response = await api.get(`/notificaciones/${id}`);
      return response.data;
    } catch (error: any) {
      console.error(`Error obteniendo notificación ${id}:`, error);
      
      if (error.response?.status === 403) {
        throw new Error('No tiene permisos para ver esta notificación');
      }
      
      if (error.response?.status === 404) {
        throw new Error('Notificación no encontrada');
      }
      
      throw new Error('Error al obtener notificación');
    }
  }

  async crearNotificacion(notificacion: CrearNotificacion): Promise<Notificacion> {
    try {
      const response = await api.post('/notificaciones', notificacion);
      return response.data;
    } catch (error: any) {
      console.error('Error creando notificación:', error);
      
      if (error.response?.status === 403) {
        throw new Error('No tiene permisos para crear notificaciones');
      }
      
      if (error.response?.status === 400) {
        throw new Error('Datos de notificación inválidos');
      }
      
      throw new Error('Error al crear notificación');
    }
  }

  async marcarComoLeida(id: number): Promise<Notificacion> {
    try {
      const response = await api.put(`/notificaciones/${id}/leer`);
      return response.data;
    } catch (error: any) {
      console.error(`Error marcando notificación ${id} como leída:`, error);
      
      if (error.response?.status === 403) {
        throw new Error('No tiene permisos para modificar esta notificación');
      }
      
      if (error.response?.status === 404) {
        throw new Error('Notificación no encontrada');
      }
      
      throw new Error('Error al marcar notificación como leída');
    }
  }

  async marcarTodasComoLeidas(): Promise<{ cantidad: number }> {
    try {
      const response = await api.put('/notificaciones/marcar-todas-leidas');
      return response.data;
    } catch (error: any) {
      console.error('Error marcando todas las notificaciones como leídas:', error);
      
      if (error.response?.status === 403) {
        throw new Error('No tiene permisos para modificar notificaciones');
      }
      
      throw new Error('Error al marcar notificaciones como leídas');
    }
  }

  async eliminarNotificacion(id: number): Promise<void> {
    try {
      await api.delete(`/notificaciones/${id}`);
    } catch (error: any) {
      console.error(`Error eliminando notificación ${id}:`, error);
      
      if (error.response?.status === 403) {
        throw new Error('No tiene permisos para eliminar notificaciones');
      }
      
      if (error.response?.status === 404) {
        throw new Error('Notificación no encontrada');
      }
      
      throw new Error('Error al eliminar notificación');
    }
  }

  async obtenerNoLeidas(): Promise<{
    notificaciones: Notificacion[];
    total: number;
  }> {
    try {
      const response = await api.get('/notificaciones/no-leidas');
      return response.data;
    } catch (error: any) {
      console.error('Error obteniendo notificaciones no leídas:', error);
      
      if (error.response?.status === 403) {
        throw new Error('No tiene permisos para ver notificaciones');
      }
      
      throw new Error('Error al obtener notificaciones no leídas');
    }
  }

  async obtenerEstadisticas(): Promise<EstadisticasNotificacion> {
    try {
      const response = await api.get('/notificaciones/estadisticas');
      return response.data;
    } catch (error: any) {
      console.error('Error obteniendo estadísticas de notificaciones:', error);
      
      if (error.response?.status === 403) {
        throw new Error('No tiene permisos para ver estadísticas');
      }
      
      throw new Error('Error al obtener estadísticas de notificaciones');
    }
  }

  async obtenerPreferencias(): Promise<PreferenciasNotificacion[]> {
    try {
      const response = await api.get('/notificaciones/preferencias');
      return response.data;
    } catch (error: any) {
      console.error('Error obteniendo preferencias de notificaciones:', error);
      
      if (error.response?.status === 403) {
        throw new Error('No tiene permisos para ver preferencias');
      }
      
      throw new Error('Error al obtener preferencias de notificaciones');
    }
  }

  async configurarPreferencias(preferencias: ConfigurarPreferencias): Promise<PreferenciasNotificacion> {
    try {
      const response = await api.post('/notificaciones/preferencias', preferencias);
      return response.data;
    } catch (error: any) {
      console.error('Error configurando preferencias de notificaciones:', error);
      
      if (error.response?.status === 403) {
        throw new Error('No tiene permisos para configurar preferencias');
      }
      
      throw new Error('Error al configurar preferencias de notificaciones');
    }
  }

  async actualizarPreferencia(id: number, preferencia: Partial<ConfigurarPreferencias>): Promise<PreferenciasNotificacion> {
    try {
      const response = await api.put(`/notificaciones/preferencias/${id}`, preferencia);
      return response.data;
    } catch (error: any) {
      console.error(`Error actualizando preferencia ${id}:`, error);
      
      if (error.response?.status === 403) {
        throw new Error('No tiene permisos para modificar preferencias');
      }
      
      if (error.response?.status === 404) {
        throw new Error('Preferencia no encontrada');
      }
      
      throw new Error('Error al actualizar preferencia de notificaciones');
    }
  }

  async eliminarPreferencia(id: number): Promise<void> {
    try {
      await api.delete(`/notificaciones/preferencias/${id}`);
    } catch (error: any) {
      console.error(`Error eliminando preferencia ${id}:`, error);
      
      if (error.response?.status === 403) {
        throw new Error('No tiene permisos para eliminar preferencias');
      }
      
      if (error.response?.status === 404) {
        throw new Error('Preferencia no encontrada');
      }
      
      throw new Error('Error al eliminar preferencia de notificaciones');
    }
  }

  async enviarNotificacionPush(usuarioId: number, titulo: string, mensaje: string, datos?: Record<string, any>): Promise<void> {
    try {
      await api.post('/notificaciones/enviar-push', {
        usuario_id: usuarioId,
        titulo,
        mensaje,
        datos_adicionales: datos
      });
    } catch (error: any) {
      console.error('Error enviando notificación push:', error);
      
      if (error.response?.status === 403) {
        throw new Error('No tiene permisos para enviar notificaciones push');
      }
      
      throw new Error('Error al enviar notificación push');
    }
  }

  async enviarNotificacionEmail(usuarioId: number, asunto: string, mensaje: string, html?: string): Promise<void> {
    try {
      await api.post('/notificaciones/enviar-email', {
        usuario_id: usuarioId,
        asunto,
        mensaje,
        html
      });
    } catch (error: any) {
      console.error('Error enviando notificación por email:', error);
      
      if (error.response?.status === 403) {
        throw new Error('No tiene permisos para enviar notificaciones por email');
      }
      
      throw new Error('Error al enviar notificación por email');
    }
  }

  async enviarNotificacionSMS(usuarioId: number, mensaje: string): Promise<void> {
    try {
      await api.post('/notificaciones/enviar-sms', {
        usuario_id: usuarioId,
        mensaje
      });
    } catch (error: any) {
      console.error('Error enviando notificación por SMS:', error);
      
      if (error.response?.status === 403) {
        throw new Error('No tiene permisos para enviar notificaciones por SMS');
      }
      
      throw new Error('Error al enviar notificación por SMS');
    }
  }

  async limpiarNotificacionesAntiguas(dias: number = 30): Promise<{ eliminadas: number }> {
    try {
      const response = await api.delete('/notificaciones/limpiar', { params: { dias } });
      return response.data;
    } catch (error: any) {
      console.error('Error limpiando notificaciones antiguas:', error);
      
      if (error.response?.status === 403) {
        throw new Error('No tiene permisos para limpiar notificaciones');
      }
      
      throw new Error('Error al limpiar notificaciones antiguas');
    }
  }
}

export const notificacionService = new NotificacionService();