import { useAuthStore } from '../stores/authStore';
import type { AuthUser } from '../types/api';

export interface UseAuthReturn {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (displayName: string, email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
  updateDisplayName: (displayName: string) => void;
}

/** Thin wrapper around useAuthStore — preserves the original hook API. */
export function useAuth(): UseAuthReturn {
  return useAuthStore();
}
