import axios from 'axios';

export interface User {
  id: string;
  email: string;
  nombre: string;
  rol: 'admin' | 'cliente';
  cliente_id?: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

class AuthService {
  private static instance: AuthService;
  private token: string | null = null;
  private refreshToken: string | null = null;
  private user: User | null = null;

  private constructor() {
    this.loadTokens();
  }

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  private loadTokens(): void {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('aaces_token') || localStorage.getItem('access_token');
      this.refreshToken = localStorage.getItem('refresh_token');
      const userData = localStorage.getItem('aaces_user') || localStorage.getItem('user');
      if (userData) {
        this.user = JSON.parse(userData);
      }
    }
  }

  private saveTokens(response: AuthResponse): void {
    this.token = response.access_token;
    this.refreshToken = response.refresh_token;
    this.user = response.user;

    if (typeof window !== 'undefined') {
      localStorage.setItem('aaces_token', response.access_token);
      localStorage.setItem('refresh_token', response.refresh_token);
      localStorage.setItem('aaces_user', JSON.stringify(response.user));
    }
  }

  private clearTokens(): void {
    this.token = null;
    this.refreshToken = null;
    this.user = null;

    if (typeof window !== 'undefined') {
      localStorage.removeItem('aaces_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('aaces_user');
    }
  }

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const response = await axios.post<AuthResponse>(
        `/api/v1/auth/login`,
        { correo: credentials.email, password: credentials.password }
      );

      const data = response.data;
      this.saveTokens(data);
      if (typeof window !== 'undefined') {
        localStorage.setItem('aaces_token', data.access_token);
        try {
          const parts = data.access_token.split('.');
          const payload = JSON.parse(typeof atob === 'function' ? atob(parts[1]) : Buffer.from(parts[1], 'base64').toString('utf-8'));
          localStorage.setItem('aaces_user', JSON.stringify({ id: payload.sub, email: payload.email, nombre: payload.name, rol: payload.role === 'admin' ? 'admin' : 'cliente' }));
        } catch {}
      }
      return data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.detail || 'Error al iniciar sesión');
      }
      throw new Error('Error de conexión');
    }
  }

  async logout(): Promise<void> {
    try {
      if (this.token) {
        await axios.post(
          `/api/v1/auth/logout`,
          {},
          {
            headers: {
              Authorization: `Bearer ${this.token}`
            }
          }
        );
      }
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    } finally {
      this.clearTokens();
    }
  }

  async refreshAccessToken(): Promise<string> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await axios.post<AuthResponse>(
        `/api/v1/auth/refresh`,
        {},
        { headers: { Authorization: `Bearer ${this.refreshToken}` } }
      );

      this.saveTokens(response.data);
      return response.data.access_token;
    } catch {
      this.clearTokens();
      throw new Error('Sesión expirada');
    }
  }

  getToken(): string | null {
    return this.token;
  }

  getUser(): User | null {
    return this.user;
  }

  getUserRole(): 'admin' | 'cliente' | null {
    return this.user?.rol || null;
  }

  isAuthenticated(): boolean {
    return !!this.token;
  }

  isAdmin(): boolean {
    return this.user?.rol === 'admin';
  }

  isCliente(): boolean {
    return this.user?.rol === 'cliente';
  }

  getAuthHeaders(): Record<string, string> {
    if (!this.token) {
      return {};
    }
    return {
      Authorization: `Bearer ${this.token}`
    };
  }
}

export const authService = AuthService.getInstance();
