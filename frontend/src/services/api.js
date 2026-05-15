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
export const getHand = (handUuid) => get(`/hands/${handUuid}`);
// GET /api/v1/hands/{id}/leaderboard → LeaderboardEntry[]
export const getHandLeaderboard = (handUuid) => get(`/hands/${handUuid}/leaderboard`);

// ── Sessions ──────────────────────────────────────────────────────────────
// POST /api/v1/sessions → Session
export const createSession = (handUuid, userId, isDaily = false, dailyDate = null, isRanked = true) =>
  post('/sessions', { handUuid, userId, isDaily, dailyDate, isRanked });

// POST /api/v1/sessions/{uuid}/complete → { valid, message, moveCount, session }
export const completeSession = (uuid, moves, timeSeconds, turns) =>
  post(`/sessions/${uuid}/complete`, { moves, timeSeconds, turns });

// POST /api/v1/sessions/{uuid}/abandon
export const abandonSession = (uuid, moves, timeSeconds, turns) =>
  post(`/sessions/${uuid}/abandon`, { moves, timeSeconds, turns });

// GET /api/v1/sessions/active → { daily: ActiveSession|null, random: ActiveSession|null }
// Always 200 — check each field for null individually.
export const getActiveSession = () => get('/sessions/active');

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

// Friend requests (direct in-app, used from league member list)
export const sendFriendRequest          = (targetUserId) => post('/friends/requests', { targetUserId });
export const getReceivedFriendRequests  = ()             => get('/friends/requests/received');
export const acceptFriendRequest        = (id)           => post(`/friends/requests/${id}/accept`, {});
export const declineFriendRequest       = (id)           => del(`/friends/requests/${id}`);

// Custom named leagues
export const getCustomLeagues       = ()                    => get('/custom-leagues');
export const createCustomLeague     = (name, memberIds)     => post('/custom-leagues', { name, memberIds });
export const getCustomLeagueDetail  = (id)                  => get(`/custom-leagues/${id}`);
export const getCustomLeaderboard   = (id, period = 'week') => get(`/custom-leagues/${id}/leaderboard?period=${period}`);
export const deleteCustomLeague     = (id)                  => del(`/custom-leagues/${id}`);
export const addLeagueMembers       = (id, userIds)         => post(`/custom-leagues/${id}/members`, { userIds });
export const removeLeagueMember     = (id, userId)          => del(`/custom-leagues/${id}/members/${userId}`);

// ── Challenges (legacy 1-to-1) ────────────────────────────────────────────
export const getChallengeInbox  = ()                      => get('/challenges/inbox');
export const createChallenge    = (sessionUuid, challenged) => post('/challenges', { sessionUuid, challengedUserId: challenged });
export const playChallenge      = (challengeId)           => post(`/challenges/${challengeId}/play`, {});

// ── Social group challenges ───────────────────────────────────────────────
export const getSocialChallenges      = ()    => get('/social/challenges');
export const getSocialChallengeDetail = (id)  => get(`/social/challenges/${id}`);
export const getPendingChallengeCount = ()    => get('/social/challenges/pending-count');
// invitedUserIds / invitedLeagueIds: explicit selections from picker, or null to invite all friends
export const createSocialChallenge    = (sessionUuid, invitedUserIds = null, invitedLeagueIds = null) =>
  post('/social/challenges', { sessionUuid, invitedUserIds, invitedLeagueIds });
export const addChallengeParticipants = (id, userIds) => post(`/social/challenges/${id}/participants`, { userIds });
export const endSocialChallenge       = (id)  => post(`/social/challenges/${id}/end`, {});
export const resumeSocialChallenge    = (id)  => post(`/social/challenges/${id}/resume`, {});
export const deleteSocialChallenge    = (id)  => del(`/social/challenges/${id}`);
export const hideSocialChallenge      = (id)  => post(`/social/challenges/${id}/hide`, {});

// ── Replay (DEV-219) ──────────────────────────────────────────────────────
// GET /api/v1/sessions/:uuid/replay → ReplayResponse
export const getSessionReplay = (sessionUuid) => get(`/sessions/${sessionUuid}/replay`);

// ── Global leaderboard (DEV-222 / DEV-224) ────────────────────────────────
export const getGlobalLeaderboard = (period = 'weekly', drawMode = 'draw3', sort = 'moves') =>
  get(`/leaderboard/global?period=${period}&drawMode=${drawMode}&sort=${sort}`);

export const getGlobalRank = (userUuid, period = 'weekly', drawMode = 'draw3', sort = 'moves') =>
  get(`/leaderboard/global/${userUuid}/rank?period=${period}&drawMode=${drawMode}&sort=${sort}`);

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

// ── Account management ────────────────────────────────────────────────────
export const changePassword = (currentPassword, newPassword) =>
  patch('/profile/password', { currentPassword, newPassword });

export const deleteAccount = (password) =>
  fetch(BASE + '/profile', {
    method: 'DELETE',
    headers: authHeaders(),
    body: JSON.stringify({ password }),
  }).then(r => {
    if (!r.ok) throw new Error(r.status);
    return null;
  });
