import { accessToken, refresh, setAccessToken } from './auth';
import type {
  HandResponse,
  CreateSessionResponse,
  CompleteSessionResponse,
  ActiveSessionsResponse,
  DailyHandResponse,
  DailyCalendarEntry,
  DailyLeaderboardEntry,
  GlobalLeaderboardEntry,
  LeagueEntry,
  ProfileResponse,
  UserPreferences,
  AvatarUploadResponse,
  StatsResponse,
  RecordsResponse,
  PagedResponse,
  FriendResponse,
  InviteResponse,
  SentInviteResponse,
  InvitePreviewResponse,
  FriendRequestEntry,
  SocialChallengeListEntry,
  SocialChallengeDetail,
  PendingCountResponse,
  CustomLeagueListEntry,
  CustomLeagueDetail,
  ReplayResponse,
  DaySession,
} from '../types/api';

const BASE = '/api/v1';

// ── Network retry ──────────────────────────────────────────────────────────

/**
 * Retry a fetch-based operation on network failure only (TypeError: Failed to fetch).
 * HTTP error responses (4xx / 5xx) are never retried — they carry server-side meaning
 * and retrying would not help.
 *
 * Delays are exponential: baseDelayMs × 2^attempt  (0.8s, 1.6s, 3.2s …).
 *
 * @param fn          Zero-arg factory that fires the request each attempt
 * @param maxAttempts Total attempts before giving up (default 3)
 * @param baseDelayMs Initial wait before the second attempt in ms (default 800)
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 800,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      // TypeError means the fetch itself never reached the server (offline,
      // DNS, connection reset, etc.).  HTTP-level errors are plain Error
      // instances thrown by handleResponse and should not be retried.
      if (!(err instanceof TypeError)) throw err;
      if (attempt < maxAttempts - 1) {
        await new Promise<void>(resolve =>
          setTimeout(resolve, baseDelayMs * 2 ** attempt),
        );
      }
    }
  }
  throw lastErr;
}

// ── Auth-aware fetch helpers ───────────────────────────────────────────────

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...extra };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
  return headers;
}

async function handleResponse(r: Response, retry: (() => Promise<unknown>) | null): Promise<unknown> {
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
  if (!r.ok) throw new Error(String(r.status));
  return r.status === 204 ? null : r.json();
}

const get = (path: string): Promise<unknown> => {
  const doFetch = () =>
    fetch(BASE + path, { headers: authHeaders() })
      .then(r => handleResponse(r, null));
  return fetch(BASE + path, { headers: authHeaders() })
    .then(r => handleResponse(r, doFetch));
};

const post = (path: string, body: unknown): Promise<unknown> => {
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

const patch = (path: string, body: unknown): Promise<unknown> => {
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

const del = (path: string): Promise<unknown> => {
  const doFetch = () =>
    fetch(BASE + path, { method: 'DELETE', headers: authHeaders() })
      .then(r => handleResponse(r, null));
  return fetch(BASE + path, { method: 'DELETE', headers: authHeaders() })
    .then(r => {
      if (r.status === 401) {
        return handleResponse(r, doFetch);
      }
      if (!r.ok) throw new Error(String(r.status));
      return r.status === 204 ? null : r.json();
    });
};

// keep setAccessToken importable from one place for convenience
export { setAccessToken };

// ── Hands ─────────────────────────────────────────────────────────────────
// POST /api/v1/hands → { id, shuffleSeed, cards: number[] }
export const createHand = (drawMode = 'draw3'): Promise<HandResponse> =>
  post('/hands', { drawMode }) as Promise<HandResponse>;
// GET /api/v1/hands/{id} → { id, shuffleSeed, cards: number[], drawMode }
export const getHand = (handUuid: string): Promise<HandResponse> =>
  get(`/hands/${handUuid}`) as Promise<HandResponse>;
// GET /api/v1/hands/{id}/leaderboard → LeaderboardEntry[]
export const getHandLeaderboard = (handUuid: string): Promise<DailyLeaderboardEntry[]> =>
  get(`/hands/${handUuid}/leaderboard`) as Promise<DailyLeaderboardEntry[]>;

// ── Sessions ──────────────────────────────────────────────────────────────
// POST /api/v1/sessions → Session
export const createSession = (
  handUuid: string,
  userId: number,
  isDaily = false,
  dailyDate: string | null = null,
  isRanked = true,
): Promise<CreateSessionResponse> =>
  post('/sessions', { handUuid, userId, isDaily, dailyDate, isRanked }) as Promise<CreateSessionResponse>;

// POST /api/v1/sessions/{uuid}/complete → { valid, message, moveCount, session }
// Retried up to 4 times on network failure — submitting a win is too important to drop
// on the first flaky request.  The endpoint is effectively idempotent (same UUID + turns
// → same result), so retrying is safe even if the server processed a previous attempt
// but the response never reached the client.
export const completeSession = (
  uuid: string,
  moves: number,
  timeSeconds: number,
  turns: string,
): Promise<CompleteSessionResponse> =>
  withRetry(
    () => post(`/sessions/${uuid}/complete`, { moves, timeSeconds, turns }),
    4,    // attempts: immediate, +0.8 s, +1.6 s, +3.2 s  (~5.6 s total)
    800,
  ) as Promise<CompleteSessionResponse>;

// POST /api/v1/sessions/{uuid}/abandon
export const abandonSession = (
  uuid: string,
  moves: number,
  timeSeconds: number,
  turns: string,
): Promise<null> =>
  post(`/sessions/${uuid}/abandon`, { moves, timeSeconds, turns }) as Promise<null>;

// POST /api/v1/sessions/{uuid}/progress (DEV-338)
// Snapshot the in-progress move history + elapsed time so the hand can be resumed
// on another device. Sent when the tab is hidden/closed.
export const saveSessionProgress = (
  uuid: string,
  moves: number,
  timeSeconds: number,
  turns: string,
): Promise<null> =>
  post(`/sessions/${uuid}/progress`, { moves, timeSeconds, turns }) as Promise<null>;

// GET /api/v1/sessions/active → { daily: ActiveSession|null, random: ActiveSession|null }
// Always 200 — check each field for null individually.
export const getActiveSession = (): Promise<ActiveSessionsResponse> =>
  get('/sessions/active') as Promise<ActiveSessionsResponse>;

// ── Daily ─────────────────────────────────────────────────────────────────
// Retried silently so transient connectivity blips don't immediately surface
// the "Daily Challenge not available" error screen.
export const getDaily = (drawMode = 'draw3'): Promise<DailyHandResponse> =>
  withRetry(
    () => get(`/daily?drawMode=${drawMode}`),
    3,   // attempts: immediate, +0.8 s, +1.6 s  (~2.4 s max before error UI shows)
    800,
  ) as Promise<DailyHandResponse>;
export const getDailyCalendar = (drawMode = 'draw3', months = 4): Promise<DailyCalendarEntry[]> =>
  get(`/daily/calendar?drawMode=${drawMode}&months=${months}`) as Promise<DailyCalendarEntry[]>;
export const getDailyByDate = (date: string, drawMode = 'draw3'): Promise<DailyHandResponse> =>
  get(`/daily/${date}?drawMode=${drawMode}`) as Promise<DailyHandResponse>;

// ── Leaderboard ───────────────────────────────────────────────────────────
export const getDailyLeaderboard = (
  date: string,
  sort = 'moves',
  drawMode = 'draw3',
): Promise<DailyLeaderboardEntry[]> =>
  get(`/leaderboard/daily/${date}/${sort}?drawMode=${drawMode}`) as Promise<DailyLeaderboardEntry[]>;

export const getMyDailyRank = (
  date: string,
  userId: string,
  sort = 'moves',
  drawMode = 'draw3',
): Promise<DailyLeaderboardEntry | null> =>
  get(`/leaderboard/daily/${date}/${userId}/${sort}?drawMode=${drawMode}`) as Promise<DailyLeaderboardEntry | null>;

// ── Profile ───────────────────────────────────────────────────────────────
export const getProfile   = (userId: number | string): Promise<ProfileResponse> =>
  get(`/profile/${userId}`) as Promise<ProfileResponse>;
export const patchProfile = (userId: number | string, body: Partial<ProfileResponse>): Promise<ProfileResponse> =>
  patch(`/profile/${userId}`, body) as Promise<ProfileResponse>;
export const getMyProfile = (): Promise<ProfileResponse> =>
  get('/profile') as Promise<ProfileResponse>;

// ── Avatar (DEV-229) ──────────────────────────────────────────────────────
// Step 1: get a presigned S3 PUT URL
export const requestAvatarUpload = (contentType: string): Promise<AvatarUploadResponse> =>
  post('/profile/avatar', { contentType }) as Promise<AvatarUploadResponse>;
// Step 2 (after PUT to S3): persist the CDN URL on the account
export const confirmAvatarUpload = (avatarUrl: string): Promise<ProfileResponse> =>
  patch('/profile/avatar', { avatarUrl }) as Promise<ProfileResponse>;

// ── Friends ───────────────────────────────────────────────────────────────
export const getFriends         = (): Promise<PagedResponse<FriendResponse>> =>
  get('/friends') as Promise<PagedResponse<FriendResponse>>;
export const createFriendInvite = (): Promise<InviteResponse> =>
  post('/friends/invite', {}) as Promise<InviteResponse>;
export const acceptFriendInvite = (token: string): Promise<null> =>
  post(`/friends/invite/${token}/accept`, {}) as Promise<null>;
export const removeFriend       = (friendId: number): Promise<null> =>
  del(`/friends/${friendId}`) as Promise<null>;
export const getSentInvites     = (): Promise<SentInviteResponse[]> =>
  get('/friends/invites') as Promise<SentInviteResponse[]>;
export const deleteSentInvite   = (id: number): Promise<null> =>
  del(`/friends/invites/${id}`) as Promise<null>;
export const previewInvite      = (token: string): Promise<InvitePreviewResponse> =>
  get(`/friends/invites/preview/${token}`) as Promise<InvitePreviewResponse>;

// Friend requests (direct in-app, used from league member list)
export const sendFriendRequest         = (targetUserId: number): Promise<null> =>
  post('/friends/requests', { targetUserId }) as Promise<null>;
export const getReceivedFriendRequests = (): Promise<FriendRequestEntry[]> =>
  get('/friends/requests/received') as Promise<FriendRequestEntry[]>;
export const acceptFriendRequest       = (id: number): Promise<null> =>
  post(`/friends/requests/${id}/accept`, {}) as Promise<null>;
export const declineFriendRequest      = (id: number): Promise<null> =>
  del(`/friends/requests/${id}`) as Promise<null>;

// Custom named leagues
export const getCustomLeagues      = (): Promise<CustomLeagueListEntry[]> =>
  get('/custom-leagues') as Promise<CustomLeagueListEntry[]>;
export const createCustomLeague    = (name: string, memberIds: number[]): Promise<CustomLeagueDetail> =>
  post('/custom-leagues', { name, memberIds }) as Promise<CustomLeagueDetail>;
export const getCustomLeagueDetail = (id: number): Promise<CustomLeagueDetail> =>
  get(`/custom-leagues/${id}`) as Promise<CustomLeagueDetail>;
export const getCustomLeaderboard  = (id: number, period = 'week'): Promise<LeagueEntry[]> =>
  get(`/custom-leagues/${id}/leaderboard?period=${period}`) as Promise<LeagueEntry[]>;
export const deleteCustomLeague    = (id: number): Promise<null> =>
  del(`/custom-leagues/${id}`) as Promise<null>;
export const addLeagueMembers      = (id: number, userIds: number[]): Promise<null> =>
  post(`/custom-leagues/${id}/members`, { userIds }) as Promise<null>;
export const removeLeagueMember    = (id: number, userId: number): Promise<null> =>
  del(`/custom-leagues/${id}/members/${userId}`) as Promise<null>;

// ── Challenges (legacy 1-to-1) ────────────────────────────────────────────
export const getChallengeInbox = (): Promise<unknown> =>
  get('/challenges/inbox');
export const createChallenge   = (sessionUuid: string, challenged: number): Promise<unknown> =>
  post('/challenges', { sessionUuid, challengedUserId: challenged });
export const playChallenge     = (challengeId: number): Promise<unknown> =>
  post(`/challenges/${challengeId}/play`, {});

// ── Social group challenges ───────────────────────────────────────────────
export const getSocialChallenges      = (): Promise<SocialChallengeListEntry[]> =>
  get('/social/challenges') as Promise<SocialChallengeListEntry[]>;
export const getSocialChallengeDetail = (id: number): Promise<SocialChallengeDetail> =>
  get(`/social/challenges/${id}`) as Promise<SocialChallengeDetail>;
export const getPendingChallengeCount = (): Promise<PendingCountResponse> =>
  get('/social/challenges/pending-count') as Promise<PendingCountResponse>;
// invitedUserIds / invitedLeagueIds: explicit selections from picker, or null to invite all friends
export const createSocialChallenge    = (
  sessionUuid: string,
  invitedUserIds: number[] | null = null,
  invitedLeagueIds: number[] | null = null,
): Promise<SocialChallengeDetail> =>
  post('/social/challenges', { sessionUuid, invitedUserIds, invitedLeagueIds }) as Promise<SocialChallengeDetail>;
export const addChallengeParticipants = (id: number, userIds: number[]): Promise<null> =>
  post(`/social/challenges/${id}/participants`, { userIds }) as Promise<null>;
export const endSocialChallenge       = (id: number): Promise<null> =>
  post(`/social/challenges/${id}/end`, {}) as Promise<null>;
export const resumeSocialChallenge    = (id: number): Promise<null> =>
  post(`/social/challenges/${id}/resume`, {}) as Promise<null>;
export const deleteSocialChallenge    = (id: number): Promise<null> =>
  del(`/social/challenges/${id}`) as Promise<null>;
export const hideSocialChallenge      = (id: number): Promise<null> =>
  post(`/social/challenges/${id}/hide`, {}) as Promise<null>;

// ── Replay (DEV-219) ──────────────────────────────────────────────────────
// GET /api/v1/sessions/:uuid/replay → ReplayResponse
export const getSessionReplay = (sessionUuid: string): Promise<ReplayResponse> =>
  get(`/sessions/${sessionUuid}/replay`) as Promise<ReplayResponse>;

// ── Global leaderboard (DEV-222 / DEV-224) ────────────────────────────────
export const getGlobalLeaderboard = (
  period = 'weekly',
  drawMode = 'draw3',
  sort = 'moves',
): Promise<PagedResponse<GlobalLeaderboardEntry>> =>
  get(`/leaderboard/global?period=${period}&drawMode=${drawMode}&sort=${sort}`) as Promise<PagedResponse<GlobalLeaderboardEntry>>;

export const getGlobalRank = (
  userUuid: string,
  period = 'weekly',
  drawMode = 'draw3',
  sort = 'moves',
): Promise<GlobalLeaderboardEntry | null> =>
  get(`/leaderboard/global/${userUuid}/rank?period=${period}&drawMode=${drawMode}&sort=${sort}`) as Promise<GlobalLeaderboardEntry | null>;

// ── League ────────────────────────────────────────────────────────────────
export const getLeague = (period = 'weekly'): Promise<PagedResponse<LeagueEntry>> =>
  get(`/leagues?period=${period}`) as Promise<PagedResponse<LeagueEntry>>;

// ── User (legacy path used for create/lookup) ─────────────────────────────
export const getUserByDisplayName = (name: string): Promise<ProfileResponse | null> =>
  fetch(`/user/displayname/${name}`, { headers: authHeaders() })
    .then(r => r.ok ? r.json() as Promise<ProfileResponse> : null)
    .catch(() => null);

export const createUser = (displayName: string): Promise<ProfileResponse> =>
  fetch('/user', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ displayName }),
  }).then(r => r.json() as Promise<ProfileResponse>);

// ── Preferences ───────────────────────────────────────────────────────────
export const getPreferences   = (): Promise<UserPreferences> =>
  get('/profile/preferences') as Promise<UserPreferences>;
export const patchPreferences = (body: Partial<UserPreferences>): Promise<UserPreferences> =>
  patch('/profile/preferences', body) as Promise<UserPreferences>;

// ── Profile history / sessions ────────────────────────────────────────────
// tzOffset = minutes east of UTC (pass -new Date().getTimezoneOffset())
export const getProfileHistory = (userId: number | string, days = 35, tzOffset = 0): Promise<unknown> =>
  get(`/profile/${userId}/history?days=${days}&tzOffset=${tzOffset}`);
export const getSessionsByDate = (userId: number | string, date: string, tzOffset = 0): Promise<DaySession[]> =>
  get(`/profile/${userId}/sessions?date=${date}&tzOffset=${tzOffset}`) as Promise<DaySession[]>;

// ── Profile stats / records (DEV-150, DEV-151) ────────────────────────────
export const getProfileStats   = (): Promise<StatsResponse> =>
  get('/profile/stats') as Promise<StatsResponse>;
export const getProfileRecords = (): Promise<RecordsResponse> =>
  get('/profile/records') as Promise<RecordsResponse>;

// ── Account management ────────────────────────────────────────────────────
export const changePassword = (currentPassword: string, newPassword: string): Promise<null> =>
  patch('/profile/password', { currentPassword, newPassword }) as Promise<null>;

export const deleteAccount = (password: string): Promise<null> =>
  fetch(BASE + '/profile', {
    method: 'DELETE',
    headers: authHeaders(),
    body: JSON.stringify({ password }),
  }).then(r => {
    if (!r.ok) throw new Error(String(r.status));
    return null;
  });
