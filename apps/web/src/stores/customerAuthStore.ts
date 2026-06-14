import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { customerApi } from '../lib/customerApi';

export interface CustomerUser {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
}

interface CustomerAuthState {
  customer: CustomerUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
  update: (data: Partial<Pick<CustomerUser, 'name' | 'phone' | 'address'>>) => Promise<void>;
}

export const useCustomerAuthStore = create<CustomerAuthState>()(
  persist(
    (set, get) => ({
      customer: null,
      isLoading: false,

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const { data } = await customerApi.post('/customers/login', { email, password });
          set({ customer: data.customer });
        } finally {
          set({ isLoading: false });
        }
      },

      logout: async () => {
        await customerApi.post('/customers/logout');
        set({ customer: null });
      },

      fetchMe: async () => {
        if (get().isLoading) return;
        set({ isLoading: true });
        try {
          const { data } = await customerApi.get('/customers/portal/me');
          set({ customer: data });
        } catch {
          set({ customer: null });
        } finally {
          set({ isLoading: false });
        }
      },

      update: async (data) => {
        const { data: updated } = await customerApi.put('/customers/portal/me', data);
        set({ customer: updated });
      },
    }),
    {
      name: 'perazim-customer',
      partialize: (s) => ({ customer: s.customer }),
    }
  )
);
