import { create } from 'zustand';
import * as authService from '../services/auth';
import type { AuthUser } from '../types/api';

const USER_KEY = 'klondike_user';

function loadStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (displayName: string, email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
  updateDisplayName: (displayName: string) => void;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user:    loadStoredUser(),
  loading: true,

  login: async (email: string, password: string): Promise<AuthUser> => {
    const data = await authService.login(email, password);
    set({ user: data.user });
    return data.user;
  },

  register: async (displayName: string, email: string, password: string): Promise<AuthUser> => {
    const data = await authService.register(displayName, email, password);
    set({ user: data.user });
    return data.user;
  },

  logout: (): void => {
    authService.logout();
    set({ user: null });
  },

  updateDisplayName: (displayName: string): void => {
    const prev = get().user;
    if (!prev) return;
    const u: AuthUser = { ...prev, displayName };
    localStorage.setItem(USER_KEY, JSON.stringify(u));
    set({ user: u });
  },
}));

// Module-level IIFE: attempt silent token refresh once when the module loads.
// Running this here (rather than in a useEffect) ensures it fires exactly once
// regardless of how many components call useAuth().
void (async () => {
  const stored = loadStoredUser();
  if (!stored) {
    useAuthStore.setState({ loading: false });
    return;
  }
  try {
    await authService.refresh();
    // refresh() writes a fresh user payload to localStorage — re-read it.
    useAuthStore.setState({ user: loadStoredUser() ?? stored });
  } catch {
    useAuthStore.setState({ user: null });
  } finally {
    useAuthStore.setState({ loading: false });
  }
})();
