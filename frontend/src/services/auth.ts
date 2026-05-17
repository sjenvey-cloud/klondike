import type { AuthResponse, AuthUser } from '../types/api';

const BASE     = '/api/v1/auth';
const USER_KEY = 'klondike_user';

// In-memory access token — NOT stored in localStorage (XSS protection)
export let accessToken: string | null = null;

export function setAccessToken(t: string | null): void {
  accessToken = t;
}

export async function register(displayName: string, email: string, password: string): Promise<AuthResponse> {
  const r = await fetch(`${BASE}/register`, {
    method: 'POST',
    credentials: 'include',                           // send/receive HttpOnly refresh cookie
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName, email, password }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? 'Registration failed');
  }
  const data = await r.json() as AuthResponse;
  accessToken = data.accessToken;
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  return data;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const r = await fetch(`${BASE}/login`, {
    method: 'POST',
    credentials: 'include',                           // send/receive HttpOnly refresh cookie
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? 'Login failed');
  }
  const data = await r.json() as AuthResponse;
  accessToken = data.accessToken;
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  return data;
}

export async function refresh(): Promise<string> {
  // Refresh token is an HttpOnly cookie — browser sends it automatically with credentials: 'include'
  const r = await fetch(`${BASE}/refresh`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!r.ok) {
    localStorage.removeItem(USER_KEY);
    throw new Error('Refresh failed');
  }
  const data = await r.json() as { accessToken: string; user?: AuthUser };
  accessToken = data.accessToken;
  // Persist the fresh user payload so callers always have an up-to-date user
  // object (e.g. uuid added in V17) even for sessions predating the migration.
  if (data.user) {
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  }
  return data.accessToken;
}

export function logout(): void {
  fetch(`${BASE}/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
  accessToken = null;
  localStorage.removeItem(USER_KEY);
}
