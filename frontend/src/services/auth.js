const BASE = '/api/v1/auth';
const REFRESH_KEY = 'klondike_refresh';
const USER_KEY    = 'klondike_user';

// In-memory access token — NOT stored in localStorage (XSS protection)
export let accessToken = null;

export function setAccessToken(t) {
  accessToken = t;
}

export async function register(displayName, email, password) {
  const r = await fetch(`${BASE}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName, email, password }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.message || 'Registration failed');
  }
  const data = await r.json();
  accessToken = data.accessToken;
  localStorage.setItem(REFRESH_KEY, data.refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  return data;
}

export async function login(email, password) {
  const r = await fetch(`${BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.message || 'Login failed');
  }
  const data = await r.json();
  accessToken = data.accessToken;
  localStorage.setItem(REFRESH_KEY, data.refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  return data;
}

export async function refresh() {
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) throw new Error('No refresh token');
  const r = await fetch(`${BASE}/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!r.ok) {
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    throw new Error('Refresh failed');
  }
  const data = await r.json();
  accessToken = data.accessToken;
  return data.accessToken;
}

export function logout() {
  accessToken = null;
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}
