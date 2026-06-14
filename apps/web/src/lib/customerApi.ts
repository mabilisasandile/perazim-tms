import axios from 'axios';

export const customerApi = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
});

customerApi.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        await axios.post('/api/v1/customers/token/refresh', {}, { withCredentials: true });
        return customerApi(original);
      } catch {
        if (typeof window !== 'undefined' && window.location.pathname.startsWith('/customer')) {
          window.location.href = '/';
        }
      }
    }
    return Promise.reject(error);
  }
);
