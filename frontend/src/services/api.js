import { accessToken, refresh, setAccessToken } from './auth';

const BASE = '/api/v1';

// ── Auth-aware fetch helpers ───────────────────────────────────────────────

function authHeaders(extra = {}) {
  const headers = { 'Content-Type': 'application/json', ...extra };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
  return headers;
}

async function handleResponse(r, retry) {
  if (r.status === 401 && retry) {
    // Try token refresh once
    try {
      await refresh();
    } catch {
      // refresh failed → redirect to login
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }
    return retry();
  }
  if (!r.ok) throw new Error(r.status);
  return r.json();
}

const get = (path) => {
  const doFetch = () =>
    fetch(BASE + path, { headers: authHeaders() })
      .then(r => handleResponse(r, null));
  return fetch(BASE + path, { headers: authHeaders() })
    .then(r => handleResponse(r, doFetch));
};

const post = (path, body) => {
  const doFetch = () =>
    fetch(BASE + path, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    }).then(r => handleResponse(r, null));
  return fetch(BASE + path, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  }).then(r => handleResponse(r, doFetch));
};

const patch = (path, body) => {
  const doFetch = () =>
    fetch(BASE + path, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(body),
    }).then(r => handleResponse(r, null));
  return fetch(BASE + path, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(body),
  }).then(r => handleResponse(r, doFetch));
};

const del = (path) => {
  const doFetch = () =>
    fetch(BASE + path, { method: 'DELETE', headers: authHeaders() })
      .then(r => handleResponse(r, null));
  return fetch(BASE + path, { method: 'DELETE', headers: authHeaders() })
    .then(r => {
      if (r.status === 401) {
        return handleResponse(r, doFetch);
      }
      if (!r.ok) throw new Error(r.status);
      return r.status === 204 ? null : r.json();
    });
};

// keep setAccessToken importable from one place for convenience
export { setAccessToken };

// ── Hands ─────────────────────────────────────────────────────────────────
// POST /api/v1/hands → { id, shuffleSeed, cards: number[] }
export const createHand = (drawMode = 'draw3') => post('/hands', { drawMode });

// ── Sessions ──────────────────────────────────────────────────────────────
// POST /api/v1/sessions → Session
export const createSession = (handId, userId, isDaily = false, dailyDate = null) =>
  post('/sessions', { handId, userId, isDaily, dailyDate });

// POST /api/v1/sessions/{id}/complete → { valid, message, moveCount, session }
export const completeSession = (id, moves, timeSeconds, turns) =>
  post(`/sessions/${id}/complete`, { moves, timeSeconds, turns });

// POST /api/v1/sessions/{id}/abandon
export const abandonSession = (id, moves, timeSeconds, turns) =>
  post(`/sessions/${id}/abandon`, { moves, timeSeconds, turns });

// ── Daily ─────────────────────────────────────────────────────────────────
export const getDaily        = (drawMode = 'draw3') => get(`/daily?drawMode=${drawMode}`);
export const getDailyByDate  = (date) => get(`/daily/${date}`);

// ── Leaderboard ───────────────────────────────────────────────────────────
export const getDailyLeaderboard = (date, sort = 'moves', drawMode = 'draw3') =>
  get(`/leaderboard/daily/${date}/${sort}?drawMode=${drawMode}`);

export const getMyDailyRank = (date, userId, sort = 'moves', drawMode = 'draw3') =>
  get(`/leaderboard/daily/${date}/${userId}/${sort}?drawMode=${drawMode}`);

// ── Profile ───────────────────────────────────────────────────────────────
export const getProfile   = (userId)       => get(`/profile/${userId}`);
export const patchProfile = (userId, body) => patch(`/profile/${userId}`, body);

// ── Friends ───────────────────────────────────────────────────────────────
export const getFriends         = ()           => get('/friends');
export const createFriendInvite = ()           => post('/friends/invite', {});
export const acceptFriendInvite = (token)      => post(`/friends/invite/${token}/accept`, {});
export const removeFriend       = (friendId)   => del(`/friends/${friendId}`);

// ── Challenges ────────────────────────────────────────────────────────────
export const getChallengeInbox  = ()                      => get('/challenges/inbox');
export const createChallenge    = (sessionId, challenged) => post('/challenges', { sessionId, challengedUserId: challenged });
export const playChallenge      = (challengeId)           => post(`/challenges/${challengeId}/play`, {});

// ── League ────────────────────────────────────────────────────────────────
export const getLeague = (period = 'weekly') =>
  get(`/leagues?period=${period}`);

// ── User (legacy path used for create/lookup) ─────────────────────────────
export const getUserByDisplayName = (name) =>
  fetch(`/user/displayname/${name}`, { headers: authHeaders() })
    .then(r => r.ok ? r.json() : null)
    .catch(() => null);

export const createUser = (displayName) =>
  fetch('/user', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ displayName }),
  }).then(r => r.json());

// ── Preferences ───────────────────────────────────────────────────────────
export const getPreferences  = ()       => get('/profile/preferences');
export const patchPreferences = (body)  => patch('/profile/preferences', body);

// ── Profile history / sessions ────────────────────────────────────────────
export const getProfileHistory = (userId, days = 35) =>
  get(`/profile/${userId}/history?days=${days}`);
export const getSessionsByDate = (userId, date) =>
  get(`/profile/${userId}/sessions?date=${date}`);

// ── Profile stats / records (DEV-150, DEV-151) ────────────────────────────
export const getProfileStats   = () => get('/profile/stats');
export const getProfileRecords = () => get('/profile/records');
