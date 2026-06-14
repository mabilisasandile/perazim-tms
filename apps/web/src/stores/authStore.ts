import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../lib/api';

interface User {
  id: number;
  name: string;
  email: string;
  username: string;
  permissions: Record<string, boolean>;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isLoading: false,

      login: async (username, password) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post('/auth/login', { username, password });
          set({ user: data.user });
        } finally {
          set({ isLoading: false });
        }
      },

      logout: async () => {
        await api.post('/auth/logout');
        set({ user: null });
      },

      fetchMe: async () => {
            // No stored session — skip the network call entirely.
            // Zustand persist rehydrates synchronously, so user is already set
            // (or null) by the time this runs.
            if (!get().user) return;
            // Prevent concurrent fetches (React StrictMode can mount twice)
            if (get().isLoading) return;
            set({ isLoading: true });
            try {
              const { data } = await api.get('/auth/me');
              set({ user: data });
            } catch {
              set({ user: null });
            } finally {
              set({ isLoading: false });
            }
      },

      hasPermission: (permission) => {
        return get().user?.permissions[permission] ?? false;
      },
    }),
    {
      name: 'perazim-auth',
      partialize: (state) => ({ user: state.user }),
    }
  )
);
