const API_BASE_URL = '/api/v1';

// Obtener token del localStorage (compatibilidad entre claves)
const getToken = () => {
  if (typeof window !== 'undefined') {
    const keys = ['aaces_token', 'token', 'access_token']
    for (const k of keys) {
      const v = localStorage.getItem(k)
      if (v) return v
    }
  }
  return null
}

// Limpiar token y redirigir al login (remueve claves legacy)
const handleAuthError = () => {
  if (typeof window !== 'undefined') {
    try {
      ['aaces_token', 'token', 'access_token'].forEach((k) => localStorage.removeItem(k))
      ;['aaces_user', 'user'].forEach((k) => localStorage.removeItem(k))
    } catch {}
    window.location.href = '/login'
  }
}

// Función para hacer peticiones HTTP
export const apiRequest = async <T = unknown>(endpoint: string, options: RequestInit = {}): Promise<T> => {
  const token = getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401 || response.status === 403) {
      handleAuthError();
      throw new Error('No autorizado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Error ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error en la petición:', error);
    throw error;
  }
};

// Servicios de autenticación
export const authService = {
  login: async (email: string, password: string) => {
    return apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ correo: email, password }),
    });
  },

  register: async (userData: {
    nombre: string;
    correo: string;
    password: string;
    categoria: string;
  }) => {
    return apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  getProfile: async () => {
    return apiRequest('/auth/me');
  },

  updateProfile: async (userData: Record<string, unknown>) => {
    return apiRequest('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  },
};

// Servicios de clientes
export const clientesService = {
  getAll: async () => {
    return apiRequest('/clientes');
  },

  getById: async (id: number) => {
    return apiRequest(`/clientes/${id}`);
  },

  create: async (clienteData: Record<string, unknown>) => {
    return apiRequest('/clientes', {
      method: 'POST',
      body: JSON.stringify(clienteData),
    });
  },

  update: async (id: number, clienteData: Record<string, unknown>) => {
    return apiRequest(`/clientes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(clienteData),
    });
  },

  delete: async (id: number) => {
    return apiRequest(`/clientes/${id}`, {
      method: 'DELETE',
    });
  },
};

// Servicios de servicios
export const serviciosService = {
  getAll: async () => {
    return apiRequest('/servicios');
  },

  getById: async (id: number) => {
    return apiRequest(`/servicios/${id}`);
  },

  create: async (servicioData: Record<string, unknown>) => {
    return apiRequest('/servicios', {
      method: 'POST',
      body: JSON.stringify(servicioData),
    });
  },

  update: async (id: number, servicioData: Record<string, unknown>) => {
    return apiRequest(`/servicios/${id}`, {
      method: 'PUT',
      body: JSON.stringify(servicioData),
    });
  },

  delete: async (id: number) => {
    return apiRequest(`/servicios/${id}`, {
      method: 'DELETE',
    });
  },
};

// Servicios de suscripciones
export const suscripcionesService = {
  getAll: async () => {
    return apiRequest('/suscripciones');
  },

  getById: async (id: number) => {
    return apiRequest(`/suscripciones/${id}`);
  },

  create: async (suscripcionData: Record<string, unknown>) => {
    return apiRequest('/suscripciones', {
      method: 'POST',
      body: JSON.stringify(suscripcionData),
    });
  },

  update: async (id: number, suscripcionData: Record<string, unknown>) => {
    return apiRequest(`/suscripciones/${id}`, {
      method: 'PUT',
      body: JSON.stringify(suscripcionData),
    });
  },

  delete: async (id: number) => {
    return apiRequest(`/suscripciones/${id}`, {
      method: 'DELETE',
    });
  },
};

// Servicios de pagos
export const pagosService = {
  getAll: async () => {
    return apiRequest('/pagos');
  },

  getById: async (id: number) => {
    return apiRequest(`/pagos/${id}`);
  },

  create: async (pagoData: Record<string, unknown>) => {
    return apiRequest('/pagos', {
      method: 'POST',
      body: JSON.stringify(pagoData),
    });
  },

  update: async (id: number, pagoData: Record<string, unknown>) => {
    return apiRequest(`/pagos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(pagoData),
    });
  },

  delete: async (id: number) => {
    return apiRequest(`/pagos/${id}`, {
      method: 'DELETE',
    });
  },
};

// Servicios de notificaciones
export const notificacionesService = {
  getAll: async () => {
    return apiRequest('/notificaciones');
  },

  getById: async (id: number) => {
    return apiRequest(`/notificaciones/${id}`);
  },

  create: async (notificacionData: Record<string, unknown>) => {
    return apiRequest('/notificaciones', {
      method: 'POST',
      body: JSON.stringify(notificacionData),
    });
  },

  update: async (id: number, notificacionData: Record<string, unknown>) => {
    return apiRequest(`/notificaciones/${id}`, {
      method: 'PUT',
      body: JSON.stringify(notificacionData),
    });
  },

  delete: async (id: number) => {
    return apiRequest(`/notificaciones/${id}`, {
      method: 'DELETE',
    });
  },
};

// Servicios de reportes
export const reportesService = {
  getDashboard: async () => {
    return apiRequest('/reportes/dashboard');
  },

  getIngresos: async (fechaInicio: string, fechaFin: string) => {
    return apiRequest(`/reportes/ingresos?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`);
  },

  getSuscripciones: async (fechaInicio: string, fechaFin: string) => {
    return apiRequest(`/reportes/suscripciones?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`);
  },
};

const services = {
  authService,
  clientesService,
  serviciosService,
  suscripcionesService,
  pagosService,
  notificacionesService,
  reportesService,
};

export default services;

// Servicio de validaciones
export const validacionesService = {
  validarCertificado: async (codigo_certificado: string) => {
    return apiRequest('/validaciones/validar', {
      method: 'POST',
      body: JSON.stringify({ codigo_certificado }),
    });
  },

  obtenerValidaciones: async () => {
    return apiRequest('/validaciones/');
  },
};

// Servicio de certificados
export const certificadosService = {
  obtenerCertificados: async () => {
    return apiRequest('/certificados/');
  },

  obtenerCertificado: async (id: string) => {
    return apiRequest(`/certificados/${id}`);
  },

  crearCertificado: async (data: Record<string, unknown>) => {
    return apiRequest('/certificados/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  actualizarCertificado: async (id: string, data: Record<string, unknown>) => {
    return apiRequest(`/certificados/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  eliminarCertificado: async (id: string) => {
    return apiRequest(`/certificados/${id}`, {
      method: 'DELETE',
    });
  },
};

// Servicio de participantes
export const participantesService = {
  obtenerParticipantes: async () => {
    return apiRequest('/participantes/');
  },

  obtenerParticipante: async (id: string) => {
    return apiRequest(`/participantes/${id}`);
  },

  crearParticipante: async (data: Record<string, unknown>) => {
    return apiRequest('/participantes/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  actualizarParticipante: async (id: string, data: Record<string, unknown>) => {
    return apiRequest(`/participantes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  eliminarParticipante: async (id: string) => {
    return apiRequest(`/participantes/${id}`, {
      method: 'DELETE',
    });
  },
};

// Servicio de capacitaciones
export const capacitacionesService = {
  obtenerCapacitaciones: async () => {
    return apiRequest('/capacitaciones/');
  },

  obtenerCapacitacion: async (id: string) => {
    return apiRequest(`/capacitaciones/${id}`);
  },

  crearCapacitacion: async (data: Record<string, unknown>) => {
    return apiRequest('/capacitaciones/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  actualizarCapacitacion: async (id: string, data: Record<string, unknown>) => {
    return apiRequest(`/capacitaciones/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  eliminarCapacitacion: async (id: string) => {
    return apiRequest(`/capacitaciones/${id}`, {
      method: 'DELETE',
    });
  },
};

// Servicio de usuarios
export const usuariosService = {
  obtenerPerfil: async () => {
    return apiRequest('/auth/me');
  },

  actualizarPerfil: async (data: Record<string, unknown>) => {
    return apiRequest('/auth/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  cambiarPassword: async (data: Record<string, unknown>) => {
    return apiRequest('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

// Utilidades de autenticación
export const authUtils = {
  getUser: () => {
    if (typeof window !== 'undefined') {
      const userStr = localStorage.getItem('user');
      return userStr ? JSON.parse(userStr) : null;
    }
    return null;
  },

  getUserRole: () => {
    const user = authUtils.getUser();
    return user?.rol || null;
  },

  isAuthenticated: () => {
    return !!getToken();
  },

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
  },
};
