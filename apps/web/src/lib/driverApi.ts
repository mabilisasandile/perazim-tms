import axios from 'axios';

export const driverApi = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
});

driverApi.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        await axios.post('/api/v1/drivers/token/refresh', {}, { withCredentials: true });
        return driverApi(original);
      } catch {
        if (typeof window !== 'undefined' && window.location.pathname.startsWith('/driver')) {
          window.location.href = '/drivers/d_login';
        }
      }
    }
    return Promise.reject(error);
  }
);
