import { create } from 'zustand';
import { readDriverToken, writeDriverToken, driverLogout, type DriverProfile } from '@/api/driver';
import { stopDriverTracking } from '@/background/driverLocation';

/**
 * The driver session, beside (never inside) the user session: a print shop's rider holds a
 * token of their own and lands in /(driver). Hydrated once at start, like the auth store.
 */
interface DriverState {
  hydrated: boolean;
  token: string | null;
  driver: DriverProfile | null;
  hydrate: () => Promise<void>;
  signIn: (token: string, driver: DriverProfile) => Promise<void>;
  setDriver: (driver: DriverProfile) => void;
  signOut: () => Promise<void>;
}

export const useDriverStore = create<DriverState>((set, get) => ({
  hydrated: false,
  token: null,
  driver: null,
  hydrate: async () => {
    const token = await readDriverToken();
    set({ token, hydrated: true });
  },
  signIn: async (token, driver) => {
    await writeDriverToken(token);
    set({ token, driver, hydrated: true });
  },
  setDriver: (driver) => set({ driver }),
  signOut: async () => {
    await stopDriverTracking();
    if (get().token) await driverLogout();
    await writeDriverToken(null);
    set({ token: null, driver: null });
  },
}));
