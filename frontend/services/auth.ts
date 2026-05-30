const API_URL = '';

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export interface User {
  id: number;
  email: string;
  rol: string;
  nombre: string;
}

class AuthService {
  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await fetch(`/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        correo: email,
        password,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Error al iniciar sesión');
    }

    return await response.json();
  }

  logout(): void {
    localStorage.removeItem('aaces_token');
    localStorage.removeItem('aaces_user');
  }

  getCurrentUser(): User | null {
    const token = localStorage.getItem('aaces_token');
    if (!token) return null;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return {
        id: payload.sub,
        email: payload.email,
        rol: payload.rol,
        nombre: payload.nombre,
      };
    } catch {
      return null;
    }
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  isAuthenticated(): boolean {
    const token = this.getToken();
    if (!token) return false;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Date.now() / 1000;
      return payload.exp > currentTime;
    } catch {
      return false;
    }
  }

  isAdmin(): boolean {
    const user = this.getCurrentUser();
    return user?.rol === 'admin';
  }

  isClient(): boolean {
    const user = this.getCurrentUser();
    return user?.rol === 'cliente';
  }
}

export const authService = new AuthService();