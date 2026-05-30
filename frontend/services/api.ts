import axios from 'axios';

const baseURL = '';

export const api = axios.create({
  baseURL: `/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;