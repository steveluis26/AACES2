import axios from 'axios';

const API_URL = '/api/v1/auth';

class AuthService {
  constructor() {
    this.token = localStorage.getItem('aaces_token');
    this.user = this.getUserFromToken();
    this.setupAxiosInterceptors();
  }

  setupAxiosInterceptors() {
    // Request interceptor para añadir token a todas las peticiones
    axios.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('aaces_token');
        if (token) {
          if (!config.headers) config.headers = {};
          config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor para manejar errores de autenticación
    axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Token inválido o expirado
          this.logout();
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  decodeJWT(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Error al decodificar token:', error);
      return null;
    }
  }

  getUserFromToken() {
    const token = localStorage.getItem('aaces_token');
    if (!token) return null;
    
    const decoded = this.decodeJWT(token);
    return decoded ? {
      id: decoded.sub,
      email: decoded.email,
      nombre: decoded.nombre,
      rol: decoded.rol,
      exp: decoded.exp
    } : null;
  }

  isTokenExpired() {
    const user = this.getUserFromToken();
    if (!user || !user.exp) return true;
    
    const currentTime = Date.now() / 1000;
    return user.exp < currentTime;
  }

  async login(email, password) {
    try {
      if (!email || !password) {
        return {
          success: false,
          message: 'Por favor complete todos los campos'
        };
      }

      const response = await axios.post(`${API_URL}/login`, {
        email: email.trim(),
        password: password
      });

      const { access_token } = response.data;

      // Almacenar token y datos del usuario
      localStorage.setItem('aaces_token', access_token);
      try {
        const payload = this.decodeJWT(access_token) || {}
        localStorage.setItem('aaces_user', JSON.stringify({ id: payload.sub, email: payload.email, nombre: payload.nombre || payload.name, rol: (payload.rol || payload.role) === 'admin' ? 'admin' : 'cliente' }))
      } catch {}
      this.token = access_token;
      this.user = this.getUserFromToken();

      return {
        success: true,
        user: this.user,
        token: access_token,
        message: 'Login exitoso'
      };
    } catch (error) {
      let errorMessage = 'Error al iniciar sesión';
      
      if (error.response?.status === 401) {
        errorMessage = 'Credenciales inválidas';
      } else if (error.response?.status === 400) {
        errorMessage = 'Datos de login inválidos';
      } else if (error.response?.status === 500) {
        errorMessage = 'Error del servidor. Por favor intente más tarde';
      } else if (error.code === 'ERR_NETWORK') {
        errorMessage = 'Error de conexión. Verifique su conexión a internet';
      }

      return {
        success: false,
        message: errorMessage,
        error: error
      };
    }
  }

  logout() {
    localStorage.removeItem('token');
    this.token = null;
    this.user = null;
  }

  isAuthenticated() {
    return !!this.token && !this.isTokenExpired();
  }

  getUserRole() {
    return this.user?.rol || null;
  }

  getCurrentUser() {
    return this.user;
  }

  isAdmin() {
    return this.user?.rol === 'admin';
  }

  isCliente() {
    return this.user?.rol === 'cliente';
  }

  // Verificar permisos para rutas
  canAccessRoute(requiredRole) {
    if (!this.isAuthenticated()) return false;
    
    if (!requiredRole) return true;
    
    return this.user?.rol === requiredRole;
  }
}

export default new AuthService();
