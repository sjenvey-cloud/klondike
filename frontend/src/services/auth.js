const BASE     = '/api/v1/auth';
const USER_KEY = 'klondike_user';

// In-memory access token — NOT stored in localStorage (XSS protection)
export let accessToken = null;

export function setAccessToken(t) {
  accessToken = t;
}

export async function register(displayName, email, password) {
  const r = await fetch(`${BASE}/register`, {
    method: 'POST',
    credentials: 'include',                           // send/receive HttpOnly refresh cookie
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName, email, password }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.message || 'Registration failed');
  }
  const data = await r.json();
  accessToken = data.accessToken;
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  return data;
}

export async function login(email, password) {
  const r = await fetch(`${BASE}/login`, {
    method: 'POST',
    credentials: 'include',                           // send/receive HttpOnly refresh cookie
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.message || 'Login failed');
  }
  const data = await r.json();
  accessToken = data.accessToken;
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  return data;
}

export async function refresh() {
  // Refresh token is an HttpOnly cookie — browser sends it automatically with credentials: 'include'
  const r = await fetch(`${BASE}/refresh`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!r.ok) {
    localStorage.removeItem(USER_KEY);
    throw new Error('Refresh failed');
  }
  const data = await r.json();
  accessToken = data.accessToken;
  return data.accessToken;
}

export function logout() {
  fetch(`${BASE}/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
  accessToken = null;
  localStorage.removeItem(USER_KEY);
}
