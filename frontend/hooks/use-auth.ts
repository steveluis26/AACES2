'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api/auth';
import { useToast } from './use-toast';

export interface User {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  rol: 'admin' | 'cliente';
  activo: boolean;
  fecha_creacion: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

const TOKEN_KEY = 'aaces_token';
const USER_KEY = 'aaces_user';

export function useAuth() {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  // Initialize auth state from localStorage on mount
  useEffect(() => {
    const initializeAuth = () => {
      try {
        const token = localStorage.getItem(TOKEN_KEY);
        const userStr = localStorage.getItem(USER_KEY);

        if (token && userStr) {
          const user = JSON.parse(userStr) as User;
          
          // Verify token is not expired
          const parts = token.split('.');
          let exp = 0;
          if (parts.length === 3) {
            try {
              const payload = JSON.parse(typeof atob === 'function' ? atob(parts[1]) : Buffer.from(parts[1], 'base64').toString('utf-8'));
              exp = payload.exp ?? 0;
            } catch {}
          }
          const currentTime = Date.now() / 1000;

          if (exp === 0 || exp > currentTime) {
            setAuthState({
              user,
              token,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
          } else {
            // Token expired
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
            setAuthState({
              user: null,
              token: null,
              isAuthenticated: false,
              isLoading: false,
              error: null,
            });
          }
        } else {
          setAuthState(prev => ({ ...prev, isLoading: false }));
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setAuthState({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
          error: 'Error al inicializar la sesión',
        });
      }
    };

    initializeAuth();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await authApi.login(email, password);
      const { access_token, user } = response;

      // Store token and user data
      localStorage.setItem(TOKEN_KEY, access_token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));

      setAuthState({
        user,
        token: access_token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      showSuccess('Inicio de sesión exitoso');

      // Redirect based on role
      if (user.rol === 'admin') {
        router.push('/admin/dashboard');
      } else {
        router.push('/cliente/dashboard');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al iniciar sesión';
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: message,
      }));
      throw error;
    }
  }, [router, showSuccess]);

  const logout = useCallback(async () => {
    try {
      // Call logout endpoint if available
      if (authState.token) {
        await authApi.logout();
      }
    } catch (error) {
      console.error('Error during logout:', error);
    } finally {
      // Clear local storage
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);

      setAuthState({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });

      showSuccess('Sesión cerrada exitosamente');
      router.push('/login');
    }
  }, [authState.token, router, showSuccess]);

  const updateUser = useCallback((userData: Partial<User>) => {
    setAuthState(prev => {
      if (!prev.user) return prev;
      
      const updatedUser = { ...prev.user, ...userData };
      localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
      
      return {
        ...prev,
        user: updatedUser,
      };
    });
  }, []);

  const refreshToken = useCallback(async () => {
    if (!authState.token) return;

    try {
      const response = await authApi.refreshToken(authState.token);
      const { access_token } = response;

      localStorage.setItem(TOKEN_KEY, access_token);
      setAuthState(prev => ({ ...prev, token: access_token }));
    } catch (error) {
      console.error('Error refreshing token:', error);
      await logout();
    }
  }, [authState.token, logout]);

  return {
    ...authState,
    login,
    logout,
    updateUser,
    refreshToken,
  };
}