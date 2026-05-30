import { api } from './api';

const ENDPOINTS = {
  plantillas: {
    base: '/plantillas',
  },
}

export interface Plantilla {
  id: number;
  nombre: string;
  descripcion?: string;
  tipo_certificado: string;
  version: number;
  campos: Record<string, any>;
  contenido_html: string;
  css_personalizado?: string;
  activa: boolean;
  fecha_creacion: string;
  fecha_actualizacion: string;
  creado_por: number;
  creado_por_nombre: string;
}

export interface CrearPlantillaDTO {
  nombre: string;
  descripcion?: string;
  tipo_certificado: string;
  campos: Record<string, any>;
  contenido_html: string;
  css_personalizado?: string;
}

export interface ActualizarPlantillaDTO {
  nombre?: string;
  descripcion?: string;
  tipo_certificado?: string;
  campos?: Record<string, any>;
  contenido_html?: string;
  css_personalizado?: string;
  activa?: boolean;
}

export interface FiltrosPlantilla {
  tipo_certificado?: string;
  activa?: boolean;
  busqueda?: string;
}

export const plantillaService = {
  async obtenerPlantillas(filtros?: FiltrosPlantilla) {
    const params = new URLSearchParams();
    
    if (filtros) {
      Object.keys(filtros).forEach(key => {
        if (filtros[key as keyof FiltrosPlantilla] !== undefined) {
          params.append(key, String(filtros[key as keyof FiltrosPlantilla]));
        }
      });
    }

    const response = await api.get(`${ENDPOINTS.plantillas.base}?${params}`);
    return response.data;
  },

  async obtenerPlantilla(id: number): Promise<Plantilla> {
    const response = await api.get(`${ENDPOINTS.plantillas.base}/${id}`);
    return response.data;
  },

  async crearPlantilla(data: CrearPlantillaDTO) {
    const response = await api.post(ENDPOINTS.plantillas.base, data);
    return response.data;
  },

  async actualizarPlantilla(id: number, data: ActualizarPlantillaDTO) {
    const response = await api.put(`${ENDPOINTS.plantillas.base}/${id}`, data);
    return response.data;
  },

  async eliminarPlantilla(id: number) {
    await api.delete(`${ENDPOINTS.plantillas.base}/${id}`);
  },

  async obtenerTiposCertificado() {
    const response = await api.get(`${ENDPOINTS.plantillas.base}/tipos-certificado`);
    return response.data;
  },

  async obtenerCamposDisponibles(tipoCertificado: string) {
    const response = await api.get(`${ENDPOINTS.plantillas.base}/campos-disponibles/${tipoCertificado}`);
    return response.data;
  },

  async previsualizarPlantilla(plantillaId: number, datosPrueba: Record<string, any>) {
    const response = await api.post(`${ENDPOINTS.plantillas.base}/${plantillaId}/previsualizar`, {
      datos_prueba: datosPrueba
    });
    return response.data;
  },

  async duplicarPlantilla(id: number) {
    const response = await api.post(`${ENDPOINTS.plantillas.base}/${id}/duplicar`);
    return response.data;
  },

  async establecerPredeterminada(id: number) {
    const response = await api.post(`${ENDPOINTS.plantillas.base}/${id}/predeterminada`);
    return response.data;
  },

  async obtenerVersiones(id: number) {
    const response = await api.get(`${ENDPOINTS.plantillas.base}/${id}/versiones`);
    return response.data;
  },

  async restaurarVersion(plantillaId: number, versionId: number) {
    const response = await api.post(`${ENDPOINTS.plantillas.base}/${plantillaId}/versiones/${versionId}/restaurar`);
    return response.data;
  },
};
