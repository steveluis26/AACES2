import { api } from './api';

export interface Usuario {
  id: number;
  username: string;
  email: string;
  rol: 'admin' | 'cliente';
  nombre: string;
  apellido: string;
  telefono?: string;
  direccion?: string;
  empresa?: string;
  activo: boolean;
  fecha_creacion: string;
  ultimo_acceso?: string;
}

export interface CrearUsuarioDTO {
  username: string;
  email: string;
  password: string;
  rol: 'admin' | 'cliente';
  nombre: string;
  apellido: string;
  telefono?: string;
  direccion?: string;
  empresa?: string;
}

export interface ActualizarUsuarioDTO {
  email?: string;
  nombre?: string;
  apellido?: string;
  telefono?: string;
  direccion?: string;
  empresa?: string;
  activo?: boolean;
}

export interface CambiarPasswordDTO {
  password_actual: string;
  password_nuevo: string;
}

export interface ResetPasswordDTO {
  email: string;
}

class UsuarioService {
  async obtenerUsuarios(activos?: boolean): Promise<Usuario[]> {
    try {
      const params = activos !== undefined ? { activos } : {};
      const response = await api.get('/usuarios', { params });
      return response.data;
    } catch (error: any) {
      console.error('Error obteniendo usuarios:', error);
      
      if (error.response?.status === 403) {
        throw new Error('No tiene permisos para ver usuarios');
      }
      
      throw new Error('Error al obtener la lista de usuarios');
    }
  }

  async obtenerUsuario(id: number): Promise<Usuario> {
    try {
      const response = await api.get(`/usuarios/${id}`);
      return response.data;
    } catch (error: any) {
      console.error('Error obteniendo usuario:', error);
      
      if (error.response?.status === 403) {
        throw new Error('No tiene permisos para ver este usuario');
      }
      
      if (error.response?.status === 404) {
        throw new Error('Usuario no encontrado');
      }
      
      throw new Error('Error al obtener el usuario');
    }
  }

  async crearUsuario(usuario: CrearUsuarioDTO): Promise<Usuario> {
    try {
      const response = await api.post('/usuarios', usuario);
      return response.data;
    } catch (error: any) {
      console.error('Error creando usuario:', error);
      
      if (error.response?.status === 403) {
        throw new Error('No tiene permisos para crear usuarios');
      }
      
      if (error.response?.status === 409) {
        const mensaje = error.response.data?.detail;
        if (mensaje?.includes('username')) {
          throw new Error('El nombre de usuario ya existe');
        }
        if (mensaje?.includes('email')) {
          throw new Error('El email ya está registrado');
        }
        throw new Error('El usuario ya existe');
      }
      
      if (error.response?.status === 422) {
        throw new Error('Datos de usuario inválidos');
      }
      
      throw new Error('Error al crear el usuario');
    }
  }

  async actualizarUsuario(id: number, datos: ActualizarUsuarioDTO): Promise<Usuario> {
    try {
      const response = await api.put(`/usuarios/${id}`, datos);
      return response.data;
    } catch (error: any) {
      console.error('Error actualizando usuario:', error);
      
      if (error.response?.status === 403) {
        throw new Error('No tiene permisos para actualizar usuarios');
      }
      
      if (error.response?.status === 404) {
        throw new Error('Usuario no encontrado');
      }
      
      if (error.response?.status === 409) {
        throw new Error('El email ya está registrado por otro usuario');
      }
      
      if (error.response?.status === 422) {
        throw new Error('Datos de usuario inválidos');
      }
      
      throw new Error('Error al actualizar el usuario');
    }
  }

  async eliminarUsuario(id: number): Promise<void> {
    try {
      await api.delete(`/usuarios/${id}`);
    } catch (error: any) {
      console.error('Error eliminando usuario:', error);
      
      if (error.response?.status === 403) {
        throw new Error('No tiene permisos para eliminar usuarios');
      }
      
      if (error.response?.status === 404) {
        throw new Error('Usuario no encontrado');
      }
      
      if (error.response?.status === 409) {
        throw new Error('No se puede eliminar el usuario porque tiene certificados asociados');
      }
      
      throw new Error('Error al eliminar el usuario');
    }
  }

  async cambiarPassword(id: number, datos: CambiarPasswordDTO): Promise<void> {
    try {
      await api.put(`/usuarios/${id}/cambiar-password`, datos);
    } catch (error: any) {
      console.error('Error cambiando password:', error);
      
      if (error.response?.status === 403) {
        throw new Error('No tiene permisos para cambiar la contraseña de este usuario');
      }
      
      if (error.response?.status === 404) {
        throw new Error('Usuario no encontrado');
      }
      
      if (error.response?.status === 400) {
        throw new Error('La contraseña actual es incorrecta');
      }
      
      if (error.response?.status === 422) {
        throw new Error('La nueva contraseña no cumple los requisitos');
      }
      
      throw new Error('Error al cambiar la contraseña');
    }
  }

  async resetPassword(datos: ResetPasswordDTO): Promise<void> {
    try {
      await api.post('/usuarios/reset-password', datos);
    } catch (error: any) {
      console.error('Error reseteando password:', error);
      
      if (error.response?.status === 404) {
        throw new Error('Usuario no encontrado con ese email');
      }
      
      throw new Error('Error al resetear la contraseña');
    }
  }

  async obtenerPerfil(): Promise<Usuario> {
    try {
      const response = await api.get('/usuarios/perfil');
      return response.data;
    } catch (error: any) {
      console.error('Error obteniendo perfil:', error);
      
      if (error.response?.status === 401) {
        throw new Error('No autorizado');
      }
      
      throw new Error('Error al obtener el perfil');
    }
  }

  async actualizarPerfil(datos: ActualizarUsuarioDTO): Promise<Usuario> {
    try {
      const response = await api.put('/usuarios/perfil', datos);
      return response.data;
    } catch (error: any) {
      console.error('Error actualizando perfil:', error);
      
      if (error.response?.status === 401) {
        throw new Error('No autorizado');
      }
      
      if (error.response?.status === 409) {
        throw new Error('El email ya está registrado por otro usuario');
      }
      
      if (error.response?.status === 422) {
        throw new Error('Datos de perfil inválidos');
      }
      
      throw new Error('Error al actualizar el perfil');
    }
  }

  async cambiarPasswordPerfil(datos: CambiarPasswordDTO): Promise<void> {
    try {
      await api.put('/usuarios/perfil/cambiar-password', datos);
    } catch (error: any) {
      console.error('Error cambiando password del perfil:', error);
      
      if (error.response?.status === 401) {
        throw new Error('No autorizado');
      }
      
      if (error.response?.status === 400) {
        throw new Error('La contraseña actual es incorrecta');
      }
      
      if (error.response?.status === 422) {
        throw new Error('La nueva contraseña no cumple los requisitos');
      }
      
      throw new Error('Error al cambiar la contraseña');
    }
  }
}

export const usuarioService = new UsuarioService();