// ── Shared ──────────────────────────────────────────────────────────────────

export interface PagedResponse<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: number;
  uuid: string;
  displayName: string;
  email: string;
  avatarUrl?: string | null;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

// ── Preferences ───────────────────────────────────────────────────────────────

export interface UserPreferences {
  cardBackColour: string;
  cardBackPattern: string | null;
  feltColour: string;
  animationsEnabled: boolean;
  cardFaceDesign: string;
  cardStyle: string;
  stockSide: 'left' | 'right';
  animationSpeed: 'slow' | 'normal' | 'fast';
  winAnimation: 'confetti' | 'simple';
  drawModeDefault?: string;
}

// ── Profile ───────────────────────────────────────────────────────────────────

export interface ProfileResponse {
  id: number;
  uuid: string;
  displayName: string;
  avatarUrl?: string | null;
  createdAt?: string;
}

export interface AvatarUploadResponse {
  uploadUrl: string;
  cdnUrl: string;
  publicUrl?: string;
}

export interface StatsResponse {
  totalWins: number;
  totalGames: number;
  winRate: number;
  avgMoves: number | null;
  avgTime: number | null;
}

export interface RecordsResponse {
  bestMovesDraw1: number | null;
  bestMovesDraw3: number | null;
  bestTimeDraw1: number | null;
  bestTimeDraw3: number | null;
}

// ── Typed profile stats (actual server shape) ─────────────────────────────────

export interface ProfileModeStats {
  gamesPlayed: number;
  wins: number;
  winRate: number;
  avgMoves: number | null;
  avgTimeSeconds: number | null;
}

export interface ProfileStatsResponse {
  draw1: ProfileModeStats | null;
  draw3: ProfileModeStats | null;
}

export interface RecordEntry {
  moves: number;
  timeSeconds: number;
  drawMode: string;
}

export interface ProfileRecordsResponse {
  fewestMoves: RecordEntry | null;
  fastestTime: RecordEntry | null;
}

// ── Hands & Sessions ──────────────────────────────────────────────────────────

export interface HandResponse {
  uuid: string;
  shuffleSeed: number;
  cards: number[];
  drawMode: string;
}

export interface SessionSummary {
  uuid: string;
  status: string;
  moves: number | null;
  timeSeconds: number | null;
  completedAt: string | null;
  isRanked: boolean;
}

export interface CreateSessionResponse {
  session: SessionSummary;
}

export interface CompleteSessionResponse {
  valid: boolean;
  message: string;
  moveCount: number;
  rank: number | null;
  session: SessionSummary;
}

export interface ActiveSession {
  sessionUuid: string;
  handUuid: string;
  drawMode: string;
  isDaily: boolean;
  dailyDate: string | null;
}

export interface ActiveSessionsResponse {
  daily: ActiveSession | null;
  random: ActiveSession | null;
}

// ── Session with full context (returned by getSessionsByDate) ─────────────────

export interface DaySession {
  id?: number;
  uuid: string;
  handUuid: string;
  drawMode: string;
  status: string;
  won?: boolean;
  isDaily?: boolean;
  isRanked?: boolean;
  moves: number | null;
  moveCount?: number | null;
  timeSeconds: number | null;
  duration?: number | null;
  startedAt?: string;
  completedAt?: string | null;
}

// ── Daily ─────────────────────────────────────────────────────────────────────

export interface DailyHandResponse {
  uuid: string;
  date: string;
  cards: number[];
  drawMode: string;
}

export interface DailyCalendarEntry {
  date: string;
  played: boolean;
  won: boolean;
  moves: number | null;
  timeSeconds: number | null;
}

export interface DayHistory {
  date: string;
  sessions: SessionSummary[];
}

// ── Leaderboard ───────────────────────────────────────────────────────────────

export interface GlobalLeaderboardEntry {
  rank: number;
  userUuid: string;
  displayName: string;
  moves: number;
  timeSeconds: number;
}

export interface DailyLeaderboardEntry {
  rank: number;
  userUuid: string;
  userId?: number;
  displayName: string;
  moves: number;
  timeSeconds: number;
  sessionUuid?: string;
}

export interface LeagueEntry {
  rank: number;
  userId: number;
  displayName: string;
  wins: number;
  bestMoves: number | null;
  isFriend?: boolean;
  hasPendingRequest?: boolean;
}

// ── Friends ───────────────────────────────────────────────────────────────────

export interface FriendResponse {
  userId: number;
  displayName: string;
  avatarUrl?: string | null;
  gamesCompletedToday?: number;
}

export interface InviteResponse {
  token: string;
  url: string;
  inviteUrl: string;
  expiresAt: string;
}

export interface SentInviteResponse {
  id: number;
  token: string;
  inviteUrl: string;
  createdAt: string;
  expiresAt: string;
}

export interface InvitePreviewResponse {
  inviterDisplayName: string;
  displayName?: string;
  avatarUrl?: string | null;
}

export interface FriendRequestEntry {
  id: number;
  fromUserId: number;
  displayName: string;
  requesterDisplayName: string;
  avatarUrl?: string | null;
  createdAt: string;
}

// ── Social challenges ─────────────────────────────────────────────────────────

export interface SocialChallengeListEntry {
  id: number;
  sessionUuid: string;
  creatorDisplayName: string;
  creatorUuid: string;
  creatorUserId?: number;
  handUuid?: string;
  drawMode?: string;
  createdAt: string;
  status: string;
  participantCount: number;
  winnerCount?: number;
  myMoves: number | null;
  myTimeSeconds: number | null;
  myStatus: string | null;
  isCreator?: boolean;
  userHasWon?: boolean;
}

export interface SocialLeaderboardEntry {
  rank: number;
  userUuid: string;
  userId?: number;
  displayName: string;
  moves: number | null;
  timeSeconds: number | null;
  status: string;
  isCreator?: boolean;
}

export interface SocialChallengeDetail {
  id: number;
  sessionUuid: string;
  handUuid: string;
  drawMode?: string;
  creatorDisplayName: string;
  creatorUuid: string;
  creatorUserId?: number;
  createdAt: string;
  status: string;
  leaderboard: SocialLeaderboardEntry[];
}

export interface PendingCountResponse {
  count: number;
}

// ── Custom leagues ────────────────────────────────────────────────────────────

export interface CustomLeagueListEntry {
  id: number;
  name: string;
  memberCount: number;
  createdAt: string;
  isCreator?: boolean;
}

export interface CustomLeagueMemberEntry {
  userId: number;
  displayName: string;
  avatarUrl?: string | null;
  wins: number;
  bestMoves: number | null;
  isFriend?: boolean;
  hasPendingRequest?: boolean;
}

export interface CustomLeagueDetail {
  id: number;
  name: string;
  members: CustomLeagueMemberEntry[];
  createdAt: string;
  isCreator?: boolean;
  creatorUserId?: number;
}

// ── Replay ────────────────────────────────────────────────────────────────────

export interface ReplayMove {
  type: 'draw' | 'wt' | 'wf' | 'tt' | 'tf' | 'ft';
  col?: number;
  fromCol?: number;
  fromIdx?: number;
  toCol?: number;
  fi?: number;
}

export interface ReplayResponse {
  sessionUuid: string;
  handUuid: string;
  cards: number[];
  drawMode: string;
  moves: ReplayMove[];
  moveCount: number;
  timeSeconds: number;
}
