import { api } from './api';

const ENDPOINTS = {
  clientes: {
    lista: '/clientes',
    detalle: '/clientes',
    por_ruc: '/clientes/por-ruc',
    crear: '/clientes',
    actualizar: '/clientes',
    eliminar: '/clientes',
    cambiar_estado: '/clientes/cambiar-estado',
    dashboard: '/clientes/dashboard',
    certificados: '/clientes/certificados',
    certificados_activos: '/clientes/certificados-activos',
    certificados_por_vencer: '/clientes/certificados-por-vencer',
    certificados_vencidos: '/clientes/certificados-vencidos',
    historial_validaciones: '/clientes/historial-validaciones',
    notificaciones: '/clientes/notificaciones',
    marcar_leida: '/clientes/notificaciones/marcar-leida',
    marcar_todas_leidas: '/clientes/notificaciones/marcar-todas-leidas',
    enviar_notificacion: '/clientes/notificaciones/enviar',
    exportar_datos: '/clientes/exportar',
    verificar_ruc: '/clientes/verificar-ruc',
    top_certificados: '/clientes/top-certificados',
    sin_certificados: '/clientes/sin-certificados',
    reporte_general: '/clientes/reporte-general',
  },
}

export interface Cliente {
  id: number;
  ruc: string;
  nombre: string;
  email: string;
  telefono: string;
  direccion: string;
  ciudad: string;
  pais: string;
  estado: 'activo' | 'inactivo';
  fecha_registro: string;
  fecha_actualizacion: string;
  certificados_count?: number;
  ultima_validacion?: string;
}

export interface CrearClienteData {
  ruc: string;
  nombre: string;
  email: string;
  telefono?: string;
  direccion?: string;
  ciudad?: string;
  pais?: string;
}

export interface ActualizarClienteData {
  nombre?: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  ciudad?: string;
  pais?: string;
  estado?: 'activo' | 'inactivo';
}

export interface FiltrosCliente {
  ruc?: string;
  nombre?: string;
  email?: string;
  estado?: 'activo' | 'inactivo';
  fecha_desde?: string;
  fecha_hasta?: string;
}

export interface ClienteDashboard {
  total_clientes: number;
  clientes_activos: number;
  clientes_inactivos: number;
  clientes_nuevos_mes: number;
  top_clientes_certificados: Array<{
    cliente_id: number;
    nombre: string;
    ruc: string;
    total_certificados: number;
  }>;
}

export interface CertificadoCliente {
  id: number;
  codigo: string;
  tipo_certificado: string;
  equipo_nombre: string;
  equipo_modelo: string;
  equipo_serie: string;
  fecha_emision: string;
  fecha_vencimiento: string;
  estado: 'vigente' | 'vencido' | 'por_vencer';
  dias_vencimiento: number;
}

export interface ValidacionCliente {
  id: number;
  codigo_certificado: string;
  fecha_validacion: string;
  resultado: boolean;
  mensaje: string;
  ip_address: string;
}

export interface NotificacionCliente {
  id: number;
  cliente_id: number;
  tipo: 'vencimiento' | 'recordatorio' | 'nuevo_certificado';
  titulo: string;
  mensaje: string;
  leida: boolean;
  fecha_creacion: string;
  fecha_lectura?: string;
}

export const clienteService = {
  async obtenerTodos(filtros?: FiltrosCliente): Promise<Cliente[]> {
    const params = new URLSearchParams();
    
    if (filtros) {
      Object.keys(filtros).forEach(key => {
        if (filtros[key as keyof FiltrosCliente] !== undefined) {
          params.append(key, String(filtros[key as keyof FiltrosCliente]));
        }
      });
    }

    const response = await api.get(`${ENDPOINTS.clientes.lista}?${params}`);
    return response.data;
  },

  async obtenerPorId(id: number): Promise<Cliente> {
    const response = await api.get(`${ENDPOINTS.clientes.detalle}/${id}`);
    return response.data;
  },

  async obtenerPorRuc(ruc: string): Promise<Cliente> {
    const response = await api.get(`${ENDPOINTS.clientes.por_ruc}/${ruc}`);
    return response.data;
  },

  async crear(data: CrearClienteData): Promise<Cliente> {
    const response = await api.post(ENDPOINTS.clientes.crear, data);
    return response.data;
  },

  async actualizar(id: number, data: ActualizarClienteData): Promise<Cliente> {
    const response = await api.put(`${ENDPOINTS.clientes.actualizar}/${id}`, data);
    return response.data;
  },

  async eliminar(id: number): Promise<{ mensaje: string }> {
    const response = await api.delete(`${ENDPOINTS.clientes.eliminar}/${id}`);
    return response.data;
  },

  async cambiarEstado(id: number, estado: 'activo' | 'inactivo'): Promise<Cliente> {
    const response = await api.patch(`${ENDPOINTS.clientes.cambiar_estado}/${id}`, { estado });
    return response.data;
  },

  async obtenerDashboard(): Promise<ClienteDashboard> {
    const response = await api.get(ENDPOINTS.clientes.dashboard);
    return response.data;
  },

  async obtenerCertificados(clienteId: number): Promise<CertificadoCliente[]> {
    const response = await api.get(`${ENDPOINTS.clientes.certificados}/${clienteId}`);
    return response.data;
  },

  async obtenerCertificadosActivos(clienteId: number): Promise<CertificadoCliente[]> {
    const response = await api.get(`${ENDPOINTS.clientes.certificados_activos}/${clienteId}`);
    return response.data;
  },

  async obtenerCertificadosPorVencer(clienteId: number, dias: number = 30): Promise<CertificadoCliente[]> {
    const response = await api.get(`${ENDPOINTS.clientes.certificados_por_vencer}/${clienteId}?dias=${dias}`);
    return response.data;
  },

  async obtenerCertificadosVencidos(clienteId: number): Promise<CertificadoCliente[]> {
    const response = await api.get(`${ENDPOINTS.clientes.certificados_vencidos}/${clienteId}`);
    return response.data;
  },

  async obtenerHistorialValidaciones(clienteId: number, limite: number = 50): Promise<ValidacionCliente[]> {
    const response = await api.get(`${ENDPOINTS.clientes.historial_validaciones}/${clienteId}?limite=${limite}`);
    return response.data;
  },

  async obtenerNotificaciones(clienteId: number): Promise<NotificacionCliente[]> {
    const response = await api.get(`${ENDPOINTS.clientes.notificaciones}/${clienteId}`);
    return response.data;
  },

  async marcarNotificacionLeida(notificacionId: number): Promise<NotificacionCliente> {
    const response = await api.patch(`${ENDPOINTS.clientes.marcar_leida}/${notificacionId}`);
    return response.data;
  },

  async marcarTodasNotificacionesLeidas(clienteId: number): Promise<{ mensaje: string; actualizadas: number }> {
    const response = await api.patch(`${ENDPOINTS.clientes.marcar_todas_leidas}/${clienteId}`);
    return response.data;
  },

  async enviarNotificacionVencimiento(clienteId: number, certificadoId: number): Promise<{ mensaje: string }> {
    const response = await api.post(ENDPOINTS.clientes.enviar_notificacion, {
      cliente_id: clienteId,
      certificado_id: certificadoId,
      tipo: 'vencimiento'
    });
    return response.data;
  },

  async exportarDatos(clienteId: number, formato: 'csv' | 'excel' | 'pdf' = 'excel'): Promise<Blob> {
    const response = await api.get(`${ENDPOINTS.clientes.exportar_datos}/${clienteId}?formato=${formato}`, {
      responseType: 'blob',
    });
    return response.data;
  },

  async generarReporteGeneral(filtros?: FiltrosCliente, formato: 'csv' | 'excel' | 'pdf' = 'excel'): Promise<Blob> {
    const params = new URLSearchParams();
    
    if (filtros) {
      Object.keys(filtros).forEach(key => {
        if (filtros[key as keyof FiltrosCliente] !== undefined) {
          params.append(key, String(filtros[key as keyof FiltrosCliente]));
        }
      });
    }

    const response = await api.get(`${ENDPOINTS.clientes.reporte_general}?${params}&formato=${formato}`, {
      responseType: 'blob',
    });
    return response.data;
  },

  async verificarRucExiste(ruc: string): Promise<{ existe: boolean; cliente?: Cliente }> {
    const response = await api.get(`${ENDPOINTS.clientes.verificar_ruc}/${ruc}`);
    return response.data;
  },

  async obtenerTopClientesPorCertificados(limite: number = 10): Promise<Array<{
    cliente_id: number;
    nombre: string;
    ruc: string;
    total_certificados: number;
  }>> {
    const response = await api.get(`${ENDPOINTS.clientes.top_certificados}?limite=${limite}`);
    return response.data;
  },

  async obtenerClientesSinCertificadosVigentes(): Promise<Cliente[]> {
    const response = await api.get(ENDPOINTS.clientes.sin_certificados);
    return response.data;
  },
};
