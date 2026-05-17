import { useState, useCallback, useEffect } from 'react';
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

export interface UseAuthReturn {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (displayName: string, email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
  updateDisplayName: (displayName: string) => void;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser]       = useState<AuthUser | null>(loadStoredUser);
  const [loading, setLoading] = useState(true); // checking refresh token on mount

  // On mount: attempt silent token refresh so the in-memory accessToken is valid
  useEffect(() => {
    const storedUser = loadStoredUser();
    if (!storedUser) {
      setLoading(false);
      return;
    }
    authService.refresh()
      .then(() => {
        // refresh() writes a fresh user payload (including uuid) to localStorage;
        // re-read it so we don't clobber the update with the stale storedUser.
        setUser(loadStoredUser() ?? storedUser);
      })
      .catch(() => {
        // Refresh failed — clear stale user
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback(async (email: string, password: string): Promise<AuthUser> => {
    const data = await authService.login(email, password);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (displayName: string, email: string, password: string): Promise<AuthUser> => {
    const data = await authService.register(displayName, email, password);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback((): void => {
    authService.logout();
    setUser(null);
  }, []);

  const updateDisplayName = useCallback((displayName: string): void => {
    setUser(prev => {
      if (!prev) return prev;
      const u: AuthUser = { ...prev, displayName };
      localStorage.setItem(USER_KEY, JSON.stringify(u));
      return u;
    });
  }, []);

  return { user, loading, login, register, logout, updateDisplayName };
}
