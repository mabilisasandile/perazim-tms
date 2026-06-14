import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { driverApi } from '../lib/driverApi';

export interface DriverUser {
  id: number;
  name: string;
  email: string;
  mobile: string;
  age: number | null;
  address: string | null;
  licenseNo: string;
  licenseExpiry: string | null;
  totalExperience: string | null;
  dateOfJoining: string | null;
  isActive: boolean;
  assignedVehicleId: number | null;
  assignedTrailerId: number | null;
}

interface DriverAuthState {
  driver: DriverUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
}

export const useDriverAuthStore = create<DriverAuthState>()(
  persist(
    (set, get) => ({
      driver: null,
      isLoading: false,

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const { data } = await driverApi.post('/drivers/login', { email, password });
          set({ driver: data.driver });
        } finally {
          set({ isLoading: false });
        }
      },

      logout: async () => {
        await driverApi.post('/drivers/logout');
        set({ driver: null });
      },

      fetchMe: async () => {
        if (get().isLoading) return;
        set({ isLoading: true });
        try {
          const { data } = await driverApi.get('/drivers/portal/me');
          set({ driver: data });
        } catch {
          set({ driver: null });
        } finally {
          set({ isLoading: false });
        }
      },
    }),
    {
      name: 'perazim-driver',
      partialize: (s) => ({ driver: s.driver }),
    }
  )
);
