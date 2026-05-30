import api from './api';

const clientesService = {
  // Obtener todos los clientes (admin)
  getClientes: async () => {
    try {
      const response = await api.get('/clientes');
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || 'Error al obtener clientes',
      };
    }
  },

  // Obtener cliente por ID
  getClienteById: async (id) => {
    try {
      const response = await api.get(`/clientes/${id}`);
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || 'Error al obtener cliente',
      };
    }
  },

  // Crear cliente
  createCliente: async (clienteData) => {
    try {
      const response = await api.post('/clientes', clienteData);
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || 'Error al crear cliente',
      };
    }
  },

  // Actualizar cliente
  updateCliente: async (id, clienteData) => {
    try {
      const response = await api.put(`/clientes/${id}`, clienteData);
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || 'Error al actualizar cliente',
      };
    }
  },

  // Eliminar cliente
  deleteCliente: async (id) => {
    try {
      const response = await api.delete(`/clientes/${id}`);
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || 'Error al eliminar cliente',
      };
    }
  },
};

export default clientesService;