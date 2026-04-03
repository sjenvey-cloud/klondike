const BASE = '/api/v1';

const get = (path) =>
  fetch(BASE + path).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });

const post = (path, body) =>
  fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });

const patch = (path, body) =>
  fetch(BASE + path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });

const del = (path) =>
  fetch(BASE + path, { method: 'DELETE' })
    .then(r => { if (!r.ok) throw new Error(r.status); return r.status === 204 ? null : r.json(); });

// ── Hands ─────────────────────────────────────────────────────────────────
// POST /api/v1/hands → { id, shuffleSeed, cards: number[] }
export const createHand = () => post('/hands', {});

// ── Sessions ──────────────────────────────────────────────────────────────
// POST /api/v1/sessions → Session
export const createSession = (handId, userId) => post('/sessions', { handId, userId });

// POST /api/v1/sessions/{id}/complete → { valid, message, moveCount, session }
export const completeSession = (id, moves, timeSeconds, turns) =>
  post(`/sessions/${id}/complete`, { moves, timeSeconds, turns });

// POST /api/v1/sessions/{id}/abandon
export const abandonSession = (id, moves, timeSeconds, turns) =>
  post(`/sessions/${id}/abandon`, { moves, timeSeconds, turns });

// ── Daily ─────────────────────────────────────────────────────────────────
export const getDaily        = ()     => get('/daily');
export const getDailyByDate  = (date) => get(`/daily/${date}`);

// ── Leaderboard ───────────────────────────────────────────────────────────
export const getDailyLeaderboard = (date, sort = 'moves') =>
  get(`/leaderboard/daily/${date}/${sort}`);

export const getMyDailyRank = (date, userId, sort = 'moves') =>
  get(`/leaderboard/daily/${date}/${sort}/rank/${userId}`);

// ── Profile ───────────────────────────────────────────────────────────────
export const getProfile   = (userId)      => get(`/profile/${userId}`);
export const patchProfile = (userId, body) => patch(`/profile/${userId}`, body);

// ── Friends ───────────────────────────────────────────────────────────────
export const getFriends        = (userId)  => get(`/friends/${userId}`);
export const createFriendInvite = (userId) => post(`/friends/invite`, { userId });
export const acceptFriendInvite = (token)  => post(`/friends/accept/${token}`, {});
export const removeFriend       = (userId, friendId) => del(`/friends/${userId}/${friendId}`);

// ── Challenges ────────────────────────────────────────────────────────────
export const getChallengeInbox  = (userId)                => get(`/challenges/inbox/${userId}`);
export const createChallenge    = (sessionId, challenged) => post('/challenges', { sessionId, challengedUserId: challenged });

// ── League ────────────────────────────────────────────────────────────────
export const getLeague = (userId, period = 'week') =>
  get(`/league/${userId}?period=${period}`);

// ── User (legacy path used for create/lookup) ─────────────────────────────
export const getUserByDisplayName = (name) =>
  fetch(`/user/displayname/${name}`).then(r => r.ok ? r.json() : null).catch(() => null);

export const createUser = (displayName) =>
  fetch('/user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName }),
  }).then(r => r.json());
