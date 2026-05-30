// Servicio de autenticación para manejar JWT y peticiones autenticadas

const API_BASE_URL = '/api/v1';

// Obtener token del almacenamiento
export const getToken = (): string | null => {
  return localStorage.getItem('aaces_token');
};

// Guardar token
export const setToken = (token: string): void => {
  localStorage.setItem('aaces_token', token);
};

// Eliminar token (logout)
export const removeToken = (): void => {
  localStorage.removeItem('aaces_token');
};

// Verificar si el usuario está autenticado
export const isAuthenticated = (): boolean => {
  const token = getToken();
  if (!token) return false;
  
  try {
    // Verificar si el token está expirado
    const payload = JSON.parse(atob(token.split('.')[1]));
    const currentTime = Date.now() / 1000;
    return payload.exp > currentTime;
  } catch {
    return false;
  }
};

// Obtener información del usuario del token
export const getUserInfo = () => {
  const token = getToken();
  if (!token) return null;
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return {
      id: payload.sub,
      email: payload.email,
      rol: payload.rol,
      nombre: payload.nombre
    };
  } catch {
    return null;
  }
};

// Función para hacer peticiones autenticadas
export const authenticatedFetch = async (url: string, options: RequestInit = {}) => {
  const token = getToken();
  
  if (!token) {
    throw new Error('No hay token de autenticación');
  }

  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Si el token está expirado o inválido
    if (response.status === 401) {
      removeToken();
      window.location.href = '/login';
      throw new Error('Sesión expirada. Por favor, inicie sesión nuevamente.');
    }

    return response;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Sesión expirada')) {
      throw error;
    }
    throw new Error('Error de conexión con el servidor');
  }
};

// Función para validar certificado
export const validarCertificado = async (codigo_certificado: string) => {
  const response = await authenticatedFetch(`${API_BASE_URL}/validaciones/validar`, {
    method: 'POST',
    body: JSON.stringify({ codigo_certificado }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Error al validar certificado');
  }

  return response.json();
};

// Función para obtener todas las validaciones (admin)
export const obtenerValidaciones = async () => {
  const response = await authenticatedFetch(`${API_BASE_URL}/validaciones/`);
  
  if (!response.ok) {
    throw new Error('Error al obtener validaciones');
  }
  
  return response.json();
};

// Función para obtener certificados por cliente
export const obtenerCertificadosCliente = async (clienteId: string) => {
  const response = await authenticatedFetch(`${API_BASE_URL}/certificados/cliente/${clienteId}`);
  
  if (!response.ok) {
    throw new Error('Error al obtener certificados');
  }
  
  return response.json();
};

// Función para crear certificado (admin)
export const crearCertificado = async (certificadoData: any) => {
  const response = await authenticatedFetch(`${API_BASE_URL}/certificados/`, {
    method: 'POST',
    body: JSON.stringify(certificadoData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Error al crear certificado');
  }

  return response.json();
};

// Función para obtener estadísticas (admin)
export const obtenerEstadisticas = async () => {
  const response = await authenticatedFetch(`${API_BASE_URL}/estadisticas/`);
  
  if (!response.ok) {
    throw new Error('Error al obtener estadísticas');
  }
  
  return response.json();
};
