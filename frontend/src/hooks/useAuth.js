import { useState, useCallback, useEffect } from 'react';
import * as authService from '../services/auth';

const USER_KEY = 'klondike_user';

function loadStoredUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; }
}

export function useAuth() {
  const [user, setUser]       = useState(loadStoredUser);
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
        setUser(loadStoredUser() || storedUser);
      })
      .catch(() => {
        // Refresh failed — clear stale user
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback(async (email, password) => {
    const data = await authService.login(email, password);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (displayName, email, password) => {
    const data = await authService.register(displayName, email, password);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    authService.logout();
    setUser(null);
  }, []);

  const updateDisplayName = useCallback((displayName) => {
    setUser(prev => {
      const u = { ...prev, displayName };
      localStorage.setItem(USER_KEY, JSON.stringify(u));
      return u;
    });
  }, []);

  return { user, loading, login, register, logout, updateDisplayName };
}
