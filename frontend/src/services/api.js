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
  return r.status === 204 ? null : r.json();
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
// GET /api/v1/hands/{id} → { id, shuffleSeed, cards: number[], drawMode }
export const getHand = (handId) => get(`/hands/${handId}`);
// GET /api/v1/hands/{id}/leaderboard → LeaderboardEntry[]
export const getHandLeaderboard = (handId) => get(`/hands/${handId}/leaderboard`);

// ── Sessions ──────────────────────────────────────────────────────────────
// POST /api/v1/sessions → Session
export const createSession = (handId, userId, isDaily = false, dailyDate = null, isRanked = true) =>
  post('/sessions', { handId, userId, isDaily, dailyDate, isRanked });

// POST /api/v1/sessions/{id}/complete → { valid, message, moveCount, session }
export const completeSession = (id, moves, timeSeconds, turns) =>
  post(`/sessions/${id}/complete`, { moves, timeSeconds, turns });

// POST /api/v1/sessions/{id}/abandon
export const abandonSession = (id, moves, timeSeconds, turns) =>
  post(`/sessions/${id}/abandon`, { moves, timeSeconds, turns });

// ── Daily ─────────────────────────────────────────────────────────────────
export const getDaily        = (drawMode = 'draw3') => get(`/daily?drawMode=${drawMode}`);
export const getDailyCalendar = (drawMode = 'draw3', months = 4) => get(`/daily/calendar?drawMode=${drawMode}&months=${months}`);
export const getDailyByDate  = (date, drawMode = 'draw3') => get(`/daily/${date}?drawMode=${drawMode}`);

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
export const getSentInvites     = ()           => get('/friends/invites');
export const deleteSentInvite   = (id)         => del(`/friends/invites/${id}`);
export const previewInvite      = (token)      => get(`/friends/invites/preview/${token}`);

// ── Challenges (legacy 1-to-1) ────────────────────────────────────────────
export const getChallengeInbox  = ()                      => get('/challenges/inbox');
export const createChallenge    = (sessionId, challenged) => post('/challenges', { sessionId, challengedUserId: challenged });
export const playChallenge      = (challengeId)           => post(`/challenges/${challengeId}/play`, {});

// ── Social group challenges ───────────────────────────────────────────────
export const getSocialChallenges      = ()    => get('/social/challenges');
export const getSocialChallengeDetail = (id)  => get(`/social/challenges/${id}`);
export const createSocialChallenge    = (sessionId) => post('/social/challenges', { sessionId });
export const endSocialChallenge       = (id)  => post(`/social/challenges/${id}/end`, {});
export const resumeSocialChallenge    = (id)  => post(`/social/challenges/${id}/resume`, {});

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
// tzOffset = minutes east of UTC (pass -new Date().getTimezoneOffset())
export const getProfileHistory = (userId, days = 35, tzOffset = 0) =>
  get(`/profile/${userId}/history?days=${days}&tzOffset=${tzOffset}`);
export const getSessionsByDate = (userId, date, tzOffset = 0) =>
  get(`/profile/${userId}/sessions?date=${date}&tzOffset=${tzOffset}`);

// ── Profile stats / records (DEV-150, DEV-151) ────────────────────────────
export const getProfileStats   = () => get('/profile/stats');
export const getProfileRecords = () => get('/profile/records');
