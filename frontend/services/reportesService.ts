import { api } from './api';

export interface FiltrosReporte {
  fecha_inicio?: string;
  fecha_fin?: string;
  cliente_id?: number;
  estado_certificado?: 'vigente' | 'vencido' | 'todos';
  tipo_reporte: 'certificados' | 'clientes' | 'auditoria' | 'sistema';
  formato?: 'pdf' | 'excel' | 'csv';
}

export interface ReporteGenerado {
  id: string;
  tipo_reporte: string;
  fecha_generacion: string;
  usuario_generador: string;
  parametros: FiltrosReporte;
  archivo_url: string;
  tamano_archivo: number;
  estado: 'generado' | 'generando' | 'error';
}

export interface EstadisticasReporte {
  total_reportes: number;
  reportes_por_tipo: {
    tipo: string;
    cantidad: number;
    porcentaje: number;
  }[];
  usuarios_mas_activos: {
    usuario: string;
    cantidad_reportes: number;
    ultimo_reporte: string;
  }[];
  tamano_total_archivos: number;
}

export interface DatosReporteCertificados {
  total_certificados: number;
  vigentes: number;
  vencidos: number;
  por_vencer_30_dias: number;
  certificados_por_tipo: {
    tipo: string;
    cantidad: number;
    porcentaje: number;
  }[];
  certificados_por_mes: {
    mes: string;
    cantidad: number;
  }[];
  certificados_por_cliente: {
    cliente: string;
    cantidad: number;
    vigentes: number;
    vencidos: number;
  }[];
}

export interface DatosReporteClientes {
  total_clientes: number;
  clientes_activos: number;
  clientes_inactivos: number;
  nuevos_ultimo_mes: number;
  clientes_por_sector: {
    sector: string;
    cantidad: number;
    porcentaje: number;
  }[];
  clientes_por_ciudad: {
    ciudad: string;
    cantidad: number;
  }[];
  top_clientes_certificados: {
    cliente: string;
    certificados: number;
    ultimo_certificado: string;
  }[];
}

export interface DatosReporteAuditoria {
  total_acciones: number;
  acciones_por_tipo: {
    accion: string;
    cantidad: number;
  }[];
  usuarios_mas_activos: {
    usuario: string;
    acciones: number;
    ultima_accion: string;
  }[];
  tablas_mas_afectadas: {
    tabla: string;
    acciones: number;
  }[];
  acciones_por_dia: {
    fecha: string;
    acciones: number;
  }[];
}

class ReportesService {
  async generarReporte(filtros: FiltrosReporte): Promise<{
    reporte_id: string;
    mensaje: string;
    estado: 'generado' | 'generando';
  }> {
    try {
      const response = await api.post('/reportes/generar', filtros);
      return response.data;
    } catch (error: any) {
      console.error('Error generando reporte:', error);
      
      if (error.response?.status === 403) {
        throw new Error('No tiene permisos para generar reportes');
      }
      
      if (error.response?.status === 400) {
        throw new Error('Parámetros del reporte inválidos');
      }
      
      throw new Error('Error al generar reporte');
    }
  }

  async obtenerReporte(reporteId: string): Promise<ReporteGenerado> {
    try {
      const response = await api.get(`/reportes/${reporteId}`);
      return response.data;
    } catch (error: any) {
      console.error(`Error obteniendo reporte ${reporteId}:`, error);
      
      if (error.response?.status === 403) {
        throw new Error('No tiene permisos para ver este reporte');
      }
      
      if (error.response?.status === 404) {
        throw new Error('Reporte no encontrado');
      }
      
      throw new Error('Error al obtener reporte');
    }
  }

  async obtenerReportes(filtros?: {
    fecha_inicio?: string;
    fecha_fin?: string;
    usuario_generador?: string;
    tipo_reporte?: string;
    estado?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    reportes: ReporteGenerado[];
    total: number;
    limit: number;
    offset: number;
  }> {
    try {
      const response = await api.get('/reportes', { params: filtros });
      return response.data;
    } catch (error: any) {
      console.error('Error obteniendo reportes:', error);
      
      if (error.response?.status === 403) {
        throw new Error('No tiene permisos para ver reportes');
      }
      
      throw new Error('Error al obtener reportes');
    }
  }

  async descargarReporte(reporteId: string): Promise<Blob> {
    try {
      const response = await api.get(`/reportes/${reporteId}/descargar`, {
        responseType: 'blob'
      });
      return response.data;
    } catch (error: any) {
      console.error(`Error descargando reporte ${reporteId}:`, error);
      
      if (error.response?.status === 403) {
        throw new Error('No tiene permisos para descargar este reporte');
      }
      
      if (error.response?.status === 404) {
        throw new Error('Reporte no encontrado');
      }
      
      throw new Error('Error al descargar reporte');
    }
  }

  async obtenerEstadisticas(): Promise<EstadisticasReporte> {
    try {
      const response = await api.get('/reportes/estadisticas');
      return response.data;
    } catch (error: any) {
      console.error('Error obteniendo estadísticas de reportes:', error);
      
      if (error.response?.status === 403) {
        throw new Error('No tiene permisos para ver estadísticas');
      }
      
      throw new Error('Error al obtener estadísticas de reportes');
    }
  }

  async obtenerDatosPrevios(tipoReporte: string, filtros?: FiltrosReporte): Promise<
    DatosReporteCertificados | DatosReporteClientes | DatosReporteAuditoria
  > {
    try {
      const response = await api.get(`/reportes/datos-previos/${tipoReporte}`, { params: filtros });
      return response.data;
    } catch (error: any) {
      console.error(`Error obteniendo datos previos para ${tipoReporte}:`, error);
      
      if (error.response?.status === 403) {
        throw new Error('No tiene permisos para ver datos previos');
      }
      
      if (error.response?.status === 404) {
        throw new Error('Tipo de reporte no encontrado');
      }
      
      throw new Error('Error al obtener datos previos');
    }
  }

  async obtenerPlantillas(): Promise<{
    id: number;
    nombre: string;
    descripcion: string;
    tipo_reporte: string;
    parametros_predefinidos: Record<string, any>;
    activa: boolean;
  }[]> {
    try {
      const response = await api.get('/reportes/plantillas');
      return response.data;
    } catch (error: any) {
      console.error('Error obteniendo plantillas de reportes:', error);
      
      if (error.response?.status === 403) {
        throw new Error('No tiene permisos para ver plantillas');
      }
      
      throw new Error('Error al obtener plantillas de reportes');
    }
  }

  async generarReporteDesdePlantilla(plantillaId: number, parametros?: Record<string, any>): Promise<{
    reporte_id: string;
    mensaje: string;
    estado: 'generado' | 'generando';
  }> {
    try {
      const response = await api.post(`/reportes/plantillas/${plantillaId}/generar`, parametros);
      return response.data;
    } catch (error: any) {
      console.error(`Error generando reporte desde plantilla ${plantillaId}:`, error);
      
      if (error.response?.status === 403) {
        throw new Error('No tiene permisos para generar reportes desde plantillas');
      }
      
      if (error.response?.status === 404) {
        throw new Error('Plantilla no encontrada');
      }
      
      throw new Error('Error al generar reporte desde plantilla');
    }
  }

  async programarReporte(configuracion: {
    nombre: string;
    descripcion: string;
    tipo_reporte: string;
    parametros: FiltrosReporte;
    frecuencia: 'diaria' | 'semanal' | 'mensual';
    destinatarios: string[];
    formato: 'pdf' | 'excel' | 'csv';
    activo: boolean;
  }): Promise<{
    tarea_id: string;
    mensaje: string;
  }> {
    try {
      const response = await api.post('/reportes/programar', configuracion);
      return response.data;
    } catch (error: any) {
      console.error('Error programando reporte:', error);
      
      if (error.response?.status === 403) {
        throw new Error('No tiene permisos para programar reportes');
      }
      
      throw new Error('Error al programar reporte');
    }
  }

  async eliminarReporte(reporteId: string): Promise<void> {
    try {
      await api.delete(`/reportes/${reporteId}`);
    } catch (error: any) {
      console.error(`Error eliminando reporte ${reporteId}:`, error);
      
      if (error.response?.status === 403) {
        throw new Error('No tiene permisos para eliminar reportes');
      }
      
      if (error.response?.status === 404) {
        throw new Error('Reporte no encontrado');
      }
      
      throw new Error('Error al eliminar reporte');
    }
  }

  async cancelarGeneracion(reporteId: string): Promise<void> {
    try {
      await api.post(`/reportes/${reporteId}/cancelar`);
    } catch (error: any) {
      console.error(`Error cancelando generación del reporte ${reporteId}:`, error);
      
      if (error.response?.status === 403) {
        throw new Error('No tiene permisos para cancelar reportes');
      }
      
      if (error.response?.status === 404) {
        throw new Error('Reporte no encontrado');
      }
      
      throw new Error('Error al cancelar generación del reporte');
    }
  }
}

export const reportesService = new ReportesService();