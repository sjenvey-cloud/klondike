import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import {
  getSessionsByDate, getHandLeaderboard,
  createSocialChallenge, getFriends, getCustomLeagues,
} from '../../services/api';
import { ConnectButton } from '../ConnectButton/ConnectButton';
import type { DaySession, DailyLeaderboardEntry, FriendResponse, CustomLeagueListEntry } from '../../types/api';
import './DayDetail.css';

function formatTime(seconds: number | null | undefined): string {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatTimestamp(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  try {
    const utc = isoString.endsWith('Z') ? isoString : isoString + 'Z';
    const d = new Date(utc);
    return d.toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

const STATUS_LABELS: Record<string, string> = {
  won:       'Won',
  abandoned: 'Abandoned',
  active:    'Active',
  complete:  'Won',
};

function TrophyIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 11c-2.761 0-5-2.239-5-5V2h10v4c0 2.761-2.239 5-5 5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
      <path d="M3 4H1.5A1.5 1.5 0 0 0 0 5.5v.5a3 3 0 0 0 3 3M13 4h1.5A1.5 1.5 0 0 1 16 5.5v.5a3 3 0 0 1-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M6 11v2M10 11v2M4 14h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

function GroupIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M1 13.5C1 11.015 3.239 9 6 9s5 2.015 5 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <circle cx="11.5" cy="5.5" r="2" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M13.5 13.5c0-2.209-1.791-4-4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeDasharray="2 1.2"/>
    </svg>
  );
}

function CalendarIcon({ className, title }: { className?: string; title?: string }): React.JSX.Element {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <title>{title}</title>
      <rect x="1" y="3" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M1 7h14" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M5 1v4M11 1v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <circle cx="5.5" cy="11" r="1" fill="currentColor"/>
      <circle cx="8" cy="11" r="1" fill="currentColor"/>
      <circle cx="10.5" cy="11" r="1" fill="currentColor"/>
    </svg>
  );
}

interface DayDetailProps {
  date: string;
  onClose: () => void;
}

export function DayDetail({ date, onClose }: DayDetailProps): React.JSX.Element | null {
  const { user } = useAuth();
  const navigate = useNavigate();

  const drawerRef = useRef<HTMLDivElement>(null);

  // Panel 1 state
  const [sessions, setSessions]             = useState<DaySession[]>([]);
  const [loading, setLoading]               = useState(true);
  const [handWinCounts, setHandWinCounts]   = useState<Record<string, number>>({});
  // handUuids where the current user appears in the all-time leaderboard.
  // Used to show a ✓ even when the specific session on this day was abandoned
  // (e.g. user won the same hand on a different day).
  const [userWonHands, setUserWonHands]     = useState<Set<string>>(new Set());
  const [selectedSession, setSelectedSession] = useState<DaySession | null>(null);

  // Panel 2 state
  const [handLeaderboard, setHandLeaderboard] = useState<DailyLeaderboardEntry[]>([]);
  const [lbLoading, setLbLoading]             = useState(false);

  // Challenge picker state
  const [pickerOpen, setPickerOpen]           = useState(false);
  const [pickerLoading, setPickerLoading]     = useState(false);
  const [pickerFriends, setPickerFriends]     = useState<FriendResponse[]>([]);
  const [pickerLeagues, setPickerLeagues]     = useState<CustomLeagueListEntry[]>([]);
  const [pickerUserIds, setPickerUserIds]     = useState<Set<number>>(new Set());
  const [pickerLeagueIds, setPickerLeagueIds] = useState<Set<number>>(new Set());
  const [challenging, setChallenging]         = useState(false);
  const [challengeMsg, setChallengeMsg]       = useState<string | null>(null);

  // Load sessions for the day
  useEffect(() => {
    if (!user || !date) return;
    setLoading(true);
    setSelectedSession(null);
    setPickerOpen(false);
    setChallengeMsg(null);
    const tzOffset = -new Date().getTimezoneOffset();
    getSessionsByDate(user.id, date, tzOffset)
      .then(data => {
        const list = Array.isArray(data) ? data : [];
        setSessions(list);
        const uniqueHandIds = [...new Set(list.map(s => s.handUuid).filter(Boolean))];
        if (uniqueHandIds.length > 0) {
          Promise.all(uniqueHandIds.map(id =>
            getHandLeaderboard(id)
              .then(lb => ({
                id,
                count:   Array.isArray(lb) ? lb.length : 0,
                // Check if the current user appears in the all-time leaderboard
                // for this hand (their win may be from a different calendar day).
                userWon: Array.isArray(lb) && lb.some(e => e.userUuid === user?.uuid),
              }))
              .catch(() => ({ id, count: 0, userWon: false }))
          )).then(results => {
            const countMap: Record<string, number> = {};
            const wonSet   = new Set<string>();
            results.forEach(({ id, count, userWon }) => {
              countMap[id] = count;
              if (userWon) wonSet.add(id);
            });
            setHandWinCounts(countMap);
            setUserWonHands(wonSet);
          });
        }
      })
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, [user, date]);

  // Load leaderboard when a session is selected
  useEffect(() => {
    if (!selectedSession?.handUuid) return;
    setLbLoading(true);
    setHandLeaderboard([]);
    setPickerOpen(false);
    setChallengeMsg(null);
    getHandLeaderboard(selectedSession.handUuid)
      .then(lb => setHandLeaderboard(Array.isArray(lb) ? lb : []))
      .catch(() => setHandLeaderboard([]))
      .finally(() => setLbLoading(false));
  }, [selectedSession]);

  // Auto-focus first focusable element on mount and whenever the panel switches
  useEffect(() => {
    const first = drawerRef.current?.querySelector<HTMLElement>(
      'button, [href], input, [tabindex]:not([tabindex="-1"])'
    );
    first?.focus();
  }, [selectedSession]);

  const handleBackdropClick = useCallback((e: React.MouseEvent<HTMLDivElement>): void => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  const handleRedeal = useCallback((session: DaySession): void => {
    onClose();
    navigate('/game', {
      state: { replayHandId: session.handUuid, replayDrawMode: session.drawMode },
    });
  }, [onClose, navigate]);

  const handleWatchReplay = useCallback((session: DaySession): void => {
    onClose();
    navigate(`/replay/${session.uuid}`);
  }, [onClose, navigate]);

  // Open the challenge picker — loads friends + leagues
  const handleOpenPicker = useCallback(async (): Promise<void> => {
    setPickerOpen(true);
    setPickerLoading(true);
    setPickerUserIds(new Set());
    setPickerLeagueIds(new Set());
    setChallengeMsg(null);
    try {
      const [friends, leagues] = await Promise.all([
        getFriends().then(r => r?.items ?? []).catch(() => [] as FriendResponse[]),
        getCustomLeagues().catch(() => [] as CustomLeagueListEntry[]),
      ]);
      setPickerFriends(Array.isArray(friends) ? friends : []);
      setPickerLeagues(Array.isArray(leagues) ? leagues : []);
    } finally {
      setPickerLoading(false);
    }
  }, []);

  const toggleUser = useCallback((id: number): void => {
    setPickerUserIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const toggleLeague = useCallback((id: number): void => {
    setPickerLeagueIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleSendChallenge = useCallback(async (): Promise<void> => {
    if (challenging || !selectedSession) return;
    setChallenging(true);
    setChallengeMsg(null);
    try {
      await createSocialChallenge(
        selectedSession.uuid,
        [...pickerUserIds],
        [...pickerLeagueIds],
      );
      const total = pickerUserIds.size + pickerLeagueIds.size;
      setChallengeMsg(
        total === 0
          ? 'Challenge created!'
          : `Challenge sent to ${total} recipient${total !== 1 ? 's' : ''}!`
      );
      setPickerOpen(false);
    } catch {
      setChallengeMsg('Could not create challenge. Try again.');
    } finally {
      setChallenging(false);
    }
  }, [challenging, selectedSession, pickerUserIds, pickerLeagueIds]);

  useFocusTrap(!!date, drawerRef);

  if (!date) return null;

  const isHandDetail = !!selectedSession;

  return (
    <div
      className="day-detail-backdrop"
      onClick={handleBackdropClick}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={isHandDetail ? 'day-detail-hand-title' : 'day-detail-list-title'}
        className={`day-detail-drawer${isHandDetail ? ' day-detail-drawer--detail' : ''}`}
        ref={drawerRef}
      >

        {/* ── Panel 1: session list ── */}
        {!isHandDetail && (
          <>
            <div className="day-detail-header">
              <h3 id="day-detail-list-title" className="day-detail-title">{date}</h3>
              <button className="day-detail-close" onClick={onClose} aria-label="Close">×</button>
            </div>
            <div className="day-detail-body">
              {loading && <p className="day-detail-empty">Loading…</p>}
              {!loading && sessions.length === 0 && (
                <p className="day-detail-empty">No sessions on this day.</p>
              )}
              {!loading && sessions.map((s, i) => {
                const status = s.status || (s.won ? 'won' : 'abandoned');
                // Show ✓ if this session was won, OR if the user has any all-time
                // win for this hand (they may have won it on a different calendar day).
                const isWon  = status === 'won' || status === 'complete' || userWonHands.has(s.handUuid);
                const winCount = handWinCounts[s.handUuid] ?? null;
                const othersWon = winCount !== null && winCount > 0;

                return (
                  <button
                    key={s.id ?? i}
                    className={`day-detail-session day-detail-session--btn${isWon ? ' day-detail-session--won' : ''}`}
                    onClick={() => setSelectedSession(s)}
                  >
                    <div className="day-detail-session-row">
                      <div className="day-detail-session-left">
                        <span className="day-detail-mode-badge">
                          {s.drawMode === 'draw1' ? 'Draw 1' : 'Draw 3'}
                        </span>
                        <span className="day-detail-session-time">
                          {formatTimestamp(s.startedAt)}
                        </span>
                        {s.moves != null && (
                          <span className="day-detail-session-meta">
                            {s.moves} moves · {formatTime(s.timeSeconds ?? s.duration)}
                          </span>
                        )}
                      </div>
                      <div className="day-detail-session-right">
                        {s.isDaily && (
                          <CalendarIcon className="day-detail-daily-icon" title="Daily challenge" />
                        )}
                        {isWon && <span className="day-detail-won-check">✓</span>}
                        {othersWon && winCount !== null && (
                          <span className="day-detail-solved-badge" title={`${winCount} player${winCount === 1 ? '' : 's'} solved this deal`}>
                            <GroupIcon className="day-detail-solved-icon" />
                            {winCount}
                          </span>
                        )}
                        <span className="day-detail-chevron">›</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* ── Panel 2: hand detail + leaderboard ── */}
        {isHandDetail && (() => {
          const s = selectedSession!;
          const status = s.status || (s.won ? 'won' : 'abandoned');
          const isWon  = status === 'won' || status === 'complete';
          const isDaily = !!s.isDaily;
          const myEntry = handLeaderboard.find(e => e.userId === user?.id);

          return (
            <>
              <div className="day-detail-header">
                <button className="day-detail-back" onClick={() => { setSelectedSession(null); setPickerOpen(false); setChallengeMsg(null); }} aria-label="Back">
                  ‹ Back
                </button>
                <span id="day-detail-hand-title" className="day-detail-mode-title">
                  {s.drawMode === 'draw1' ? 'Draw 1' : 'Draw 3'}
                </span>
                <button className="day-detail-close" onClick={onClose} aria-label="Close">×</button>
              </div>

              <div className="day-detail-body">
                {/* Play this hand again */}
                <button className="btn-primary day-detail-replay-btn" onClick={() => handleRedeal(s)}>
                  ↺ Play This Hand
                </button>

                {/* Watch step-through replay — only available for won sessions */}
                {isWon && s.uuid && (
                  <button className="day-detail-watch-btn" onClick={() => handleWatchReplay(s)}>
                    ▶ Watch Replay
                  </button>
                )}

                {/* Challenge — only for won, non-daily sessions */}
                {isWon && !isDaily && (
                  pickerOpen ? (
                    <div className="day-detail-picker">
                      <div className="day-detail-picker-header">
                        <span className="day-detail-picker-title">⚔ Create Challenge</span>
                        <button className="day-detail-picker-cancel" onClick={() => setPickerOpen(false)}>
                          Cancel
                        </button>
                      </div>

                      {pickerLoading ? (
                        <p className="day-detail-empty">Loading…</p>
                      ) : (
                        <>
                          {pickerFriends.length > 0 && (
                            <>
                              <p className="day-detail-picker-label">Friends</p>
                              <div className="day-detail-picker-list">
                                {pickerFriends.map(f => (
                                  <label key={f.userId} className="day-detail-picker-row">
                                    <input
                                      type="checkbox"
                                      checked={pickerUserIds.has(f.userId)}
                                      onChange={() => toggleUser(f.userId)}
                                    />
                                    <span className="day-detail-picker-name">{f.displayName}</span>
                                  </label>
                                ))}
                              </div>
                            </>
                          )}

                          {pickerLeagues.length > 0 && (
                            <>
                              <p className="day-detail-picker-label">Leagues</p>
                              <div className="day-detail-picker-list">
                                {pickerLeagues.map(l => (
                                  <label key={l.id} className="day-detail-picker-row">
                                    <input
                                      type="checkbox"
                                      checked={pickerLeagueIds.has(l.id)}
                                      onChange={() => toggleLeague(l.id)}
                                    />
                                    <span className="day-detail-picker-name">
                                      {l.name}
                                      <span className="day-detail-picker-meta"> · {l.memberCount} member{l.memberCount !== 1 ? 's' : ''}</span>
                                    </span>
                                  </label>
                                ))}
                              </div>
                            </>
                          )}

                          {pickerFriends.length === 0 && pickerLeagues.length === 0 && (
                            <p className="day-detail-empty">Add friends or create a league to challenge others.</p>
                          )}

                          <button
                            className="btn-primary day-detail-picker-send"
                            onClick={handleSendChallenge}
                            disabled={challenging}
                          >
                            {challenging
                              ? 'Sending…'
                              : pickerUserIds.size + pickerLeagueIds.size === 0
                                ? 'Send to Everyone'
                                : `Challenge ${pickerUserIds.size + pickerLeagueIds.size} selected`}
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    <button
                      className="day-detail-challenge-btn"
                      onClick={handleOpenPicker}
                    >
                      ⚔ Create Challenge
                    </button>
                  )
                )}

                {challengeMsg && (
                  <p role="status" aria-live="polite" className="day-detail-challenge-msg">{challengeMsg}</p>
                )}

                {/* Your result summary */}
                <div className="day-detail-your-result">
                  <span className="day-detail-your-label">Your attempt</span>
                  <span className={`day-detail-status day-detail-status--${status}`}>
                    {STATUS_LABELS[status] || status}
                  </span>
                  {isWon && (
                    <>
                      <span className="day-detail-your-stat">{s.moves ?? s.moveCount ?? '—'} moves</span>
                      <span className="day-detail-your-sep">·</span>
                      <span className="day-detail-your-stat">{formatTime(s.timeSeconds ?? s.duration)}</span>
                      {myEntry && (
                        <span className="day-detail-your-rank">#{myEntry.rank}</span>
                      )}
                    </>
                  )}
                </div>

                {/* Leaderboard */}
                <div className="day-detail-lb-header">
                  <TrophyIcon className="day-detail-lb-trophy" />
                  <span>Deal Leaderboard</span>
                </div>

                {lbLoading && <p className="day-detail-empty">Loading…</p>}

                {!lbLoading && handLeaderboard.length === 0 && (
                  <p className="day-detail-empty">No one has solved this deal yet.</p>
                )}

                {!lbLoading && handLeaderboard.length > 0 && (
                  <table className="day-detail-lb-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Player</th>
                        <th>Moves</th>
                        <th>Time</th>
                        <th aria-label="Connect"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {handLeaderboard.map(row => (
                        <tr
                          key={row.userId ?? row.userUuid}
                          className={user && row.userId === user.id ? 'day-detail-lb-me' : ''}
                        >
                          <td>{row.rank}</td>
                          <td>{row.displayName}</td>
                          <td>{row.moves}</td>
                          <td>{formatTime(row.timeSeconds)}</td>
                          <td className="day-detail-lb-connect">
                            {row.userUuid && !(user && row.userUuid === user.uuid) && (
                              <ConnectButton userUuid={row.userUuid} />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
}
