import { api } from './api';

export interface Auditoria {
  id: number;
  usuario_id: number;
  usuario_nombre: string;
  usuario_email: string;
  accion: string;
  tabla_afectada?: string;
  registro_id?: number;
  valores_anteriores?: Record<string, any>;
  valores_nuevos?: Record<string, any>;
  direccion_ip: string;
  user_agent: string;
  dispositivo?: string;
  navegador?: string;
  sistema_operativo?: string;
  fecha_hora: string;
  duracion_ms?: number;
  exitoso: boolean;
  error_mensaje?: string;
  categoria: 'autenticacion' | 'usuario' | 'certificado' | 'validacion' | 'auditoria' | 'sistema' | 'configuracion';
  severidad: 'info' | 'warning' | 'error' | 'critical';
  contexto_adicional?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface FiltrosAuditoria {
  usuario_id?: number;
  accion?: string;
  tabla_afectada?: string;
  registro_id?: number;
  categoria?: string;
  severidad?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  exitoso?: boolean;
  direccion_ip?: string;
  limit?: number;
  offset?: number;
  ordenar_por?: string;
  ordenar_direccion?: 'asc' | 'desc';
}

export interface CrearAuditoria {
  accion: string;
  tabla_afectada?: string;
  registro_id?: number;
  valores_anteriores?: Record<string, any>;
  valores_nuevos?: Record<string, any>;
  duracion_ms?: number;
  exitoso: boolean;
  error_mensaje?: string;
  categoria: 'autenticacion' | 'usuario' | 'certificado' | 'validacion' | 'auditoria' | 'sistema' | 'configuracion';
  severidad: 'info' | 'warning' | 'error' | 'critical';
  contexto_adicional?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface EstadisticasAuditoria {
  total_acciones: number;
  acciones_por_categoria: Record<string, number>;
  acciones_por_severidad: Record<string, number>;
  acciones_exitosas: number;
  acciones_fallidas: number;
  usuarios_activos: number;
  acciones_por_usuario: Array<{
    usuario_id: number;
    usuario_nombre: string;
    total_acciones: number;
  }>;
  acciones_por_hora: Array<{
    hora: number;
    total: number;
  }>;
  acciones_ultimos_7_dias: number;
  acciones_ultimos_30_dias: number;
  promedio_duracion_ms: number;
  errores_comunes: Array<{
    error: string;
    frecuencia: number;
  }>;
}

export interface ConfiguracionAuditoria {
  id: number;
  categoria: string;
  acciones_registrar: string[];
  severidad_minima: 'info' | 'warning' | 'error' | 'critical';
  retencion_dias: number;
  activa: boolean;
  fecha_creacion: string;
  fecha_actualizacion: string;
}

export interface ActualizarConfiguracionAuditoria {
  acciones_registrar?: string[];
  severidad_minima?: 'info' | 'warning' | 'error' | 'critical';
  retencion_dias?: number;
  activa?: boolean;
}

class AuditoriaService {
  async obtenerAuditorias(filtros: FiltrosAuditoria = {}): Promise<{
    auditorias: Auditoria[];
    total: number;
    limit: number;
    offset: number;
  }> {
    try {
      const response = await api.get('/auditoria', { params: filtros });
      return response.data;
    } catch (error: any) {
      console.error('Error obteniendo auditorías:', error);
      
      if (error.response?.status === 403) {
        throw new Error('No tiene permisos para ver auditorías');
      }
      
      throw new Error('Error al obtener auditorías');
    }
  }

  async obtenerAuditoria(id: number): Promise<Auditoria> {
    try {
      const response = await api.get(`/auditoria/${id}`);
      return response.data;
    } catch (error: any) {
      console.error(`Error obteniendo auditoría ${id}:`, error);
      
      if (error.response?.status === 403) {
        throw new Error('No tiene permisos para ver esta auditoría');
      }
      
      if (error.response?.status === 404) {
        throw new Error('Auditoría no encontrada');
      }
      
      throw new Error('Error al obtener auditoría');
    }
  }

  async crearAuditoria(auditoria: CrearAuditoria): Promise<Auditoria> {
    try {
      const response = await api.post('/auditoria', auditoria);
      return response.data;
    } catch (error: any) {
      console.error('Error creando auditoría:', error);
      
      if (error.response?.status === 403) {
        throw new Error('No tiene permisos para crear auditorías');
      }
      
      if (error.response?.status === 400) {
        throw new Error('Datos de auditoría inválidos');
      }
      
      throw new Error('Error al crear auditoría');
    }
  }

  async obtenerEstadisticas(filtros: Omit<FiltrosAuditoria, 'limit' | 'offset' | 'ordenar_por' | 'ordenar_direccion'> = {}): Promise<EstadisticasAuditoria> {
    try {
      const response = await api.get('/auditoria/estadisticas', { params: filtros });
      return response.data;
    } catch (error: any) {
      console.error('Error obteniendo estadísticas de auditoría:', error);
      
      if (error.response?.status === 403) {
        throw new Error('No tiene permisos para ver estadísticas');
      }
      
      throw new Error('Error al obtener estadísticas de auditoría');
    }
  }

  async obtenerConfiguracion(): Promise<ConfiguracionAuditoria[]> {
    try {
      const response = await api.get('/auditoria/configuracion');
      return response.data;
    } catch (error: any) {
      console.error('Error obteniendo configuración de auditoría:', error);
      
      if (error.response?.status === 403) {
        throw new Error('No tiene permisos para ver configuración');
      }
      
      throw new Error('Error al obtener configuración de auditoría');
    }
  }

  async actualizarConfiguracion(categoria: string, configuracion: ActualizarConfiguracionAuditoria): Promise<ConfiguracionAuditoria> {
    try {
      const response = await api.put(`/auditoria/configuracion/${categoria}`, configuracion);
      return response.data;
    } catch (error: any) {
      console.error(`Error actualizando configuración de auditoría para ${categoria}:`, error);
      
      if (error.response?.status === 403) {
        throw new Error('No tiene permisos para modificar configuración');
      }
      
      if (error.response?.status === 404) {
        throw new Error('Configuración no encontrada');
      }
      
      throw new Error('Error al actualizar configuración de auditoría');
    }
  }

  async exportarAuditoria(filtros: FiltrosAuditoria = {}, formato: 'csv' | 'json' | 'xlsx' = 'csv'): Promise<Blob> {
    try {
      const response = await api.get('/auditoria/exportar', {
        params: { ...filtros, formato },
        responseType: 'blob'
      });
      return response.data;
    } catch (error: any) {
      console.error('Error exportando auditorías:', error);
      
      if (error.response?.status === 403) {
        throw new Error('No tiene permisos para exportar auditorías');
      }
      
      throw new Error('Error al exportar auditorías');
    }
  }

  async limpiarAuditoriaAntigua(dias: number = 90): Promise<{ eliminadas: number }> {
    try {
      const response = await api.delete('/auditoria/limpiar', { params: { dias } });
      return response.data;
    } catch (error: any) {
      console.error('Error limpiando auditorías antiguas:', error);
      
      if (error.response?.status === 403) {
        throw new Error('No tiene permisos para limpiar auditorías');
      }
      
      throw new Error('Error al limpiar auditorías antiguas');
    }
  }

  async obtenerAccionesPorUsuario(usuarioId: number, filtros: Omit<FiltrosAuditoria, 'usuario_id' | 'limit' | 'offset'> = {}): Promise<{
    auditorias: Auditoria[];
    total: number;
  }> {
    try {
      const response = await api.get(`/auditoria/usuario/${usuarioId}`, { params: filtros });
      return response.data;
    } catch (error: any) {
      console.error(`Error obteniendo auditorías del usuario ${usuarioId}:`, error);
      
      if (error.response?.status === 403) {
        throw new Error('No tiene permisos para ver auditorías de usuarios');
      }
      
      throw new Error('Error al obtener auditorías del usuario');
    }
  }

  async obtenerAccionesRecientes(limit: number = 10): Promise<Auditoria[]> {
    try {
      const response = await api.get('/auditoria/recientes', { params: { limit } });
      return response.data;
    } catch (error: any) {
      console.error('Error obteniendo acciones recientes:', error);
      
      if (error.response?.status === 403) {
        throw new Error('No tiene permisos para ver acciones recientes');
      }
      
      throw new Error('Error al obtener acciones recientes');
    }
  }

  async buscarAuditorias(query: string, filtros: FiltrosAuditoria = {}): Promise<{
    auditorias: Auditoria[];
    total: number;
  }> {
    try {
      const response = await api.get('/auditoria/buscar', { params: { query, ...filtros } });
      return response.data;
    } catch (error: any) {
      console.error('Error buscando en auditorías:', error);
      
      if (error.response?.status === 403) {
        throw new Error('No tiene permisos para buscar en auditorías');
      }
      
      throw new Error('Error al buscar en auditorías');
    }
  }

  async registrarAccion(
    accion: string,
    categoria: 'autenticacion' | 'usuario' | 'certificado' | 'validacion' | 'auditoria' | 'sistema' | 'configuracion',
    severidad: 'info' | 'warning' | 'error' | 'critical',
    exitoso: boolean = true,
    tablaAfectada?: string,
    registroId?: number,
    valoresAnteriores?: Record<string, any>,
    valoresNuevos?: Record<string, any>,
    duracionMs?: number,
    errorMensaje?: string,
    contextoAdicional?: Record<string, any>,
    metadata?: Record<string, any>
  ): Promise<Auditoria> {
    try {
      const auditoria: CrearAuditoria = {
        accion,
        tabla_afectada: tablaAfectada,
        registro_id: registroId,
        valores_anteriores: valoresAnteriores,
        valores_nuevos: valoresNuevos,
        duracion_ms: duracionMs,
        exitoso,
        error_mensaje: errorMensaje,
        categoria,
        severidad,
        contexto_adicional: contextoAdicional,
        metadata: metadata
      };

      return await this.crearAuditoria(auditoria);
    } catch (error) {
      console.error('Error registrando acción en auditoría:', error);
      
      throw error instanceof Error ? error : new Error('Error al registrar acción');
    }
  }

  async obtenerErroresRecientes(limit: number = 20): Promise<Auditoria[]> {
    try {
      const response = await api.get('/auditoria/errores-recientes', { params: { limit } });
      return response.data;
    } catch (error: any) {
      console.error('Error obteniendo errores recientes:', error);
      
      if (error.response?.status === 403) {
        throw new Error('No tiene permisos para ver errores');
      }
      
      throw new Error('Error al obtener errores recientes');
    }
  }

  async obtenerActividadPorHora(fecha?: string): Promise<{
    horas: Array<{
      hora: number;
      total: number;
      exitosos: number;
      fallidos: number;
    }>;
    fecha: string;
  }> {
    try {
      const response = await api.get('/auditoria/actividad-por-hora', { params: { fecha } });
      return response.data;
    } catch (error: any) {
      console.error('Error obteniendo actividad por hora:', error);
      
      if (error.response?.status === 403) {
        throw new Error('No tiene permisos para ver actividad');
      }
      
      throw new Error('Error al obtener actividad por hora');
    }
  }
}

export const auditoriaService = new AuditoriaService();