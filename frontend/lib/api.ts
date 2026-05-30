import axios, { AxiosInstance, AxiosError } from 'axios';
import { authService } from './auth';

class ApiService {
  private static instance: ApiService;
  private api: AxiosInstance;

  private constructor() {
    this.api = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.api.interceptors.request.use(
      (config) => {
        const token = authService.getToken();
        if (token) {
          (config.headers as any)['Authorization'] = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.api.interceptors.response.use(
      (response) => {
        return response;
      },
      async (error: AxiosError) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && originalRequest && !originalRequest.headers['X-Retry']) {
          try {
            // Try to refresh token
            const newToken = await authService.refreshAccessToken();
            
            if (newToken) {
              originalRequest.headers['X-Retry'] = 'true';
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              return this.api(originalRequest);
            }
          } catch (refreshError) {
            // If refresh fails, logout and redirect to login
            await authService.logout();
            if (typeof window !== 'undefined') {
              window.location.href = '/login';
            }
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  // Validación de certificados
  async validarCertificado(codigo: string) {
    try {
      const response = await this.api.post('/api/v1/validaciones/validar', {
        codigo_certificado: codigo
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.detail || 'Error al validar certificado');
      }
      throw new Error('Error de conexión');
    }
  }

  // Auth endpoints
  async login(correo: string, password: string) {
    return this.api.post('/api/v1/auth/login', {
      correo,
      password,
    });
  }

  async logout() {
    return this.api.post('/api/v1/auth/logout');
  }

  // User profile
  async getProfile() {
    return this.api.get('/api/v1/auth/me');
  }

  // Courses endpoints
  async getCourses() {
    return this.api.get('/api/v1/cursos');
  }

  async getCourse(id: string) {
    return this.api.get(`/api/v1/cursos/${id}`);
  }

  // Certificates endpoints
  async getCertificates() {
    return this.api.get('/api/v1/certificados');
  }

  async downloadCertificate(id: string) {
    return this.api.get(`/api/v1/certificados/${id}/descargar`, {
      responseType: 'blob'
    });
  }

  // Payments endpoints
  async getPayments() {
    return this.api.get('/api/v1/pagos');
  }

  async createPayment(data: any) {
    return this.api.post('/api/v1/pagos', data);
  }

  // Reports endpoints
  async getReports() {
    return this.api.get('/api/v1/reportes');
  }

  async getConstanciasCliente() {
    return this.api.get('/api/v1/clientes/constancias');
  }

  // Dashboard endpoints
  async getDashboardStats() {
    return this.api.get('/api/v1/dashboard/estadisticas');
  }

  // Participants endpoints
  async getParticipants() {
    return this.api.get('/api/v1/participantes');
  }

  async createParticipant(data: any) {
    return this.api.post('/api/v1/participantes', data);
  }

  // Trainers endpoints
  async getTrainers() {
    return this.api.get('/api/v1/capacitadores');
  }

  // Clients endpoints
  async getClients() {
    return this.api.get('/api/v1/clientes');
  }

  // Enrollments endpoints
  async enrollInCourse(courseId: string, participantId: string) {
    return this.api.post('/api/v1/inscripciones', {
      curso_id: courseId,
      participante_id: participantId
    });
  }

  // Notifications endpoints
  async getNotifications() {
    return this.api.get('/api/v1/notificaciones');
  }

  async markNotificationAsRead(id: string) {
    return this.api.patch(`/api/v1/notificaciones/${id}/leer`);
  }

  // Settings endpoints
  async updateSettings(data: any) {
    return this.api.put('/api/v1/configuraciones', data);
  }

  // Audit endpoints
  async getAuditLogs() {
    return this.api.get('/api/v1/auditoria');
  }

  // Analytics endpoints
  async getAnalytics() {
    return this.api.get('/api/v1/analytics');
  }

  // File upload endpoints
  async uploadFile(file: File, type: string) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    return this.api.post('/api/v1/archivos/subir', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  // Export endpoints
  async exportData(type: string, format: string = 'csv') {
    return this.api.get(`/api/v1/exportar/${type}`, {
      params: { formato: format },
      responseType: 'blob'
    });
  }
}

export const apiService = ApiService.getInstance();

// Export individual functions for easier use
export const {
  validarCertificado,
  login,
  logout,
  getProfile,
  getCourses,
  getCourse,
  getCertificates,
  downloadCertificate,
  getPayments,
  createPayment,
  getReports,
  getDashboardStats,
  getParticipants,
  createParticipant,
  getTrainers,
  getClients,
  enrollInCourse,
  getNotifications,
  markNotificationAsRead,
  updateSettings,
  getAuditLogs,
  getAnalytics,
  uploadFile,
  exportData
} = apiService;
