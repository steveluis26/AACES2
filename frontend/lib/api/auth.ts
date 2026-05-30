import axios from 'axios';

export const authApi = {
  async login(email: string, password: string) {
    const res = await axios.post(`/api/v1/auth/login`, { correo: email, password });
    return res.data;
  },
  async logout() {
    await axios.post(`/api/v1/auth/logout`);
  },
  async refreshToken(token: string) {
    const res = await axios.post(`/api/v1/auth/refresh`, { token });
    return res.data;
  },
};
