import axios from 'axios';

export const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true, // send cookies on every request
});

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        await axios.post('/api/v1/auth/refresh', {}, { withCredentials: true });
        return api(original);
      } catch {
        // Only redirect to login when the user is inside a protected route.
        // Public pages (/, /login, etc.) should not be redirected.
        if (typeof window !== 'undefined' && window.location.pathname.startsWith('/app')) {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);
