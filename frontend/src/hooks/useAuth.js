import { useState, useCallback } from 'react';
import { getUserByDisplayName, createUser } from '../services/api';

const STORAGE_KEY = 'klondike_user';

function loadStored() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; }
}

export function useAuth() {
  const [user, setUser] = useState(loadStored);  // { id, displayName }

  const login = useCallback(async (displayName) => {
    let found = await getUserByDisplayName(displayName);
    if (!found) found = await createUser(displayName);
    const u = { id: found.id, displayName: found.displayName };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }, []);

  const updateDisplayName = useCallback((displayName) => {
    setUser(prev => {
      const u = { ...prev, displayName };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
      return u;
    });
  }, []);

  return { user, login, logout, updateDisplayName };
}
