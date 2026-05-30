import { api } from './api';

export interface FiltrosReporte {
  fecha_inicio?: string;
  fecha_fin?: string;
  tipo_certificado?: string;
  estado?: 'valido' | 'vencido' | 'todos';
  cliente_id?: number;
  usuario_id?: number;
}

export interface EstadisticasCertificados {
  total_certificados: number;
  certificados_validos: number;
  certificados_vencidos: number;
  porcentaje_vigencia: number;
  certificados_por_tipo: {
    tipo: string;
    cantidad: number;
    porcentaje: number;
  }[];
  vencimientos_proximos_30_dias: number;
  vencimientos_proximos_60_dias: number;
  vencimientos_proximos_90_dias: number;
}

export interface EstadisticasClientes {
  total_clientes: number;
  clientes_activos: number;
  clientes_inactivos: number;
  certificados_por_cliente: {
    cliente_id: number;
    cliente_nombre: string;
    cantidad_certificados: number;
    ultima_actualizacion: string;
  }[];
}

export interface HistorialValidaciones {
  id: number;
  certificado_id: number;
  certificado_numero: string;
  cliente_nombre: string;
  fecha_validacion: string;
  resultado: 'valido' | 'vencido' | 'no_encontrado';
  ip_validacion?: string;
  usuario_agente?: string;
}

export interface ReporteAuditoria {
  id: number;
  usuario_id: number;
  usuario_nombre: string;
  accion: string;
  tabla_afectada: string;
  registro_id: number;
  fecha_accion: string;
  detalles?: string;
  ip_origen?: string;
}

class ReporteService {
  async obtenerEstadisticasCertificados(filtros?: FiltrosReporte): Promise<EstadisticasCertificados> {
    try {
      const response = await api.get('/reportes/estadisticas-certificados', { params: filtros });
      return response.data;
    } catch (error: any) {
      console.error('Error obteniendo estadísticas de certificados:', error);
      
      if (error.response?.status === 403) {
        throw new Error('No tiene permisos para ver estadísticas');
      }
      
      throw new Error('Error al obtener estadísticas de certificados');
    }
  }

  async obtenerEstadisticasClientes(filtros?: FiltrosReporte): Promise<EstadisticasClientes> {
    try {
      const response = await api.get('/reportes/estadisticas-clientes', { params: filtros });
      return response.data;
    } catch (error: any) {
      console.error('Error obteniendo estadísticas de clientes:', error);
      
      if (error.response?.status === 403) {
        throw new Error('No tiene permisos para ver estadísticas');
      }
      
      throw new Error('Error al obtener estadísticas de clientes');
    }
  }

  async obtenerHistorialValidaciones(filtros?: FiltrosReporte): Promise<HistorialValidaciones[]> {
    try {
      const response = await api.get('/reportes/historial-validaciones', { params: filtros });
      return response.data;
    } catch (error: any) {
      console.error('Error obteniendo historial de validaciones:', error);
      
      if (error.response?.status === 403) {
        throw new Error('No tiene permisos para ver el historial');
      }
      
      throw new Error('Error al obtener historial de validaciones');
    }
  }

  async obtenerReporteAuditoria(filtros?: FiltrosReporte): Promise<ReporteAuditoria[]> {
    try {
      const response = await api.get('/reportes/auditoria', { params: filtros });
      return response.data;
    } catch (error: any) {
      console.error('Error obteniendo reporte de auditoría:', error);
      
      if (error.response?.status === 403) {
        throw new Error('No tiene permisos para ver el reporte de auditoría');
      }
      
      throw new Error('Error al obtener reporte de auditoría');
    }
  }

  async exportarCertificados(filtros?: FiltrosReporte): Promise<Blob> {
    try {
      const response = await api.get('/reportes/exportar-certificados', {
        params: filtros,
        responseType: 'blob'
      });
      return response.data;
    } catch (error: any) {
      console.error('Error exportando certificados:', error);
      
      if (error.response?.status === 403) {
        throw new Error('No tiene permisos para exportar certificados');
      }
      
      throw new Error('Error al exportar certificados');
    }
  }

  async exportarClientes(filtros?: FiltrosReporte): Promise<Blob> {
    try {
      const response = await api.get('/reportes/exportar-clientes', {
        params: filtros,
        responseType: 'blob'
      });
      return response.data;
    } catch (error: any) {
      console.error('Error exportando clientes:', error);
      
      if (error.response?.status === 403) {
        throw new Error('No tiene permisos para exportar clientes');
      }
      
      throw new Error('Error al exportar clientes');
    }
  }

  async exportarValidaciones(filtros?: FiltrosReporte): Promise<Blob> {
    try {
      const response = await api.get('/reportes/exportar-validaciones', {
        params: filtros,
        responseType: 'blob'
      });
      return response.data;
    } catch (error: any) {
      console.error('Error exportando validaciones:', error);
      
      if (error.response?.status === 403) {
        throw new Error('No tiene permisos para exportar validaciones');
      }
      
      throw new Error('Error al exportar validaciones');
    }
  }

  async generarReporteCompleto(filtros?: FiltrosReporte): Promise<Blob> {
    try {
      const response = await api.get('/reportes/completo', {
        params: filtros,
        responseType: 'blob'
      });
      return response.data;
    } catch (error: any) {
      console.error('Error generando reporte completo:', error);
      
      if (error.response?.status === 403) {
        throw new Error('No tiene permisos para generar reportes');
      }
      
      throw new Error('Error al generar reporte completo');
    }
  }

  async obtenerDashboardData(): Promise<{
    estadisticas_certificados: EstadisticasCertificados;
    estadisticas_clientes: EstadisticasClientes;
    ultimas_validaciones: HistorialValidaciones[];
    alertas_vencimiento: {
      certificado_id: number;
      numero_certificado: string;
      cliente_nombre: string;
      fecha_vencimiento: string;
      dias_hasta_vencimiento: number;
    }[];
  }> {
    try {
      const response = await api.get('/reportes/dashboard');
      return response.data;
    } catch (error: any) {
      console.error('Error obteniendo datos del dashboard:', error);
      
      if (error.response?.status === 403) {
        throw new Error('No tiene permisos para ver el dashboard');
      }
      
      throw new Error('Error al obtener datos del dashboard');
    }
  }
}

export const reporteService = new ReporteService();