import { api } from './api';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: {
    id: number;
    email: string;
    nombre: string;
    apellido: string;
    rol: 'admin' | 'cliente';
    activo: boolean;
  };
}

export interface User {
  id: number;
  email: string;
  nombre: string;
  apellido: string;
  rol: 'admin' | 'cliente';
  activo: boolean;
}

class AuthService {
  private tokenKey = 'access_token';
  private userKey = 'user_data';

  async login(email: string, password: string): Promise<LoginResponse> {
    try {
      const response = await api.post<LoginResponse>('/auth/login', {
        email,
        password
      });
      
      // Almacenar token y datos del usuario
      this.setToken(response.data.access_token);
      this.setUser(response.data.user);
      
      return response.data;
    } catch (error) {
      console.error('Error en login:', error);
      throw this.handleLoginError(error);
    }
  }

  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Error en logout:', error);
    } finally {
      this.clearAuth();
    }
  }

  async getCurrentUser(): Promise<User | null> {
    try {
      const response = await api.get<User>('/auth/me');
      return response.data;
    } catch (error) {
      console.error('Error obteniendo usuario actual:', error);
      return null;
    }
  }

  async refreshToken(): Promise<string | null> {
    try {
      const response = await api.post<{ access_token: string }>('/auth/refresh');
      const newToken = response.data.access_token;
      this.setToken(newToken);
      return newToken;
    } catch (error) {
      console.error('Error refrescando token:', error);
      this.clearAuth();
      return null;
    }
  }

  isAuthenticated(): boolean {
    const token = this.getToken();
    return token !== null && !this.isTokenExpired(token);
  }

  getUserRole(): 'admin' | 'cliente' | null {
    const user = this.getUser();
    return user ? user.rol : null;
  }

  getUser(): User | null {
    try {
      const userData = localStorage.getItem(this.userKey);
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('Error obteniendo usuario del localStorage:', error);
      return null;
    }
  }

  getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(this.tokenKey);
  }

  setToken(token: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.tokenKey, token);
    // Actualizar el header de autorización en axios
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  setUser(user: User): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.userKey, JSON.stringify(user));
  }

  clearAuth(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    delete api.defaults.headers.common['Authorization'];
  }

  private isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Date.now() / 1000;
      return payload.exp < currentTime;
    } catch (error) {
      console.error('Error verificando expiración del token:', error);
      return true;
    }
  }

  private handleLoginError(error: any): Error {
    if (error.response?.status === 401) {
      return new Error('Credenciales inválidas');
    }
    
    if (error.response?.status === 422) {
      return new Error('Datos de login inválidos');
    }
    
    if (error.response?.status === 403) {
      return new Error('Usuario deshabilitado');
    }
    
    if (error.response?.data?.detail) {
      return new Error(error.response.data.detail);
    }
    
    return new Error('Error al iniciar sesión');
  }
}

export const authService = new AuthService();