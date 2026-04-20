import React, { useEffect, useState, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../App';
import { getSessionsByDate, getHandLeaderboard, createSocialChallenge } from '../../services/api';
import './DayDetail.css';

function formatTime(seconds) {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatTimestamp(isoString) {
  if (!isoString) return '—';
  try {
    // Server returns LocalDateTime without timezone suffix; treat as UTC
    const utc = isoString.endsWith('Z') ? isoString : isoString + 'Z';
    const d = new Date(utc);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

const STATUS_LABELS = {
  won:       'Won',
  abandoned: 'Abandoned',
  active:    'Active',
  complete:  'Won',
};

// Trophy icon — inline SVG, no external dependency
function TrophyIcon({ className }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 11c-2.761 0-5-2.239-5-5V2h10v4c0 2.761-2.239 5-5 5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
      <path d="M3 4H1.5A1.5 1.5 0 0 0 0 5.5v.5a3 3 0 0 0 3 3M13 4h1.5A1.5 1.5 0 0 1 16 5.5v.5a3 3 0 0 1-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M6 11v2M10 11v2M4 14h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

// People/group icon for "others solved"
function GroupIcon({ className }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M1 13.5C1 11.015 3.239 9 6 9s5 2.015 5 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <circle cx="11.5" cy="5.5" r="2" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M13.5 13.5c0-2.209-1.791-4-4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeDasharray="2 1.2"/>
    </svg>
  );
}

export function DayDetail({ date, onClose }) {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [sessions, setSessions]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [handWinCounts, setHandWinCounts] = useState({}); // handId → leaderboard entry count
  const [selectedSession, setSelectedSession] = useState(null);
  const [handLeaderboard, setHandLeaderboard] = useState([]);
  const [lbLoading, setLbLoading]       = useState(false);
  const [challenging, setChallenging]   = useState(false);
  const [challengeMsg, setChallengeMsg] = useState(null);

  // Load sessions for the day
  useEffect(() => {
    if (!user || !date) return;
    setLoading(true);
    setSelectedSession(null);
    const tzOffset = -new Date().getTimezoneOffset();
    getSessionsByDate(user.id, date, tzOffset)
      .then(data => {
        const list = Array.isArray(data) ? data : [];
        setSessions(list);
        // Pre-fetch leaderboard counts for unique hands
        const uniqueHandIds = [...new Set(list.map(s => s.handId).filter(Boolean))];
        if (uniqueHandIds.length > 0) {
          Promise.all(uniqueHandIds.map(id =>
            getHandLeaderboard(id)
              .then(lb => ({ id, count: Array.isArray(lb) ? lb.length : 0 }))
              .catch(() => ({ id, count: 0 }))
          )).then(results => {
            const map = {};
            results.forEach(({ id, count }) => { map[id] = count; });
            setHandWinCounts(map);
          });
        }
      })
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, [user, date]);

  // Load full leaderboard when a session is selected
  useEffect(() => {
    if (!selectedSession?.handId) return;
    setLbLoading(true);
    setHandLeaderboard([]);
    getHandLeaderboard(selectedSession.handId)
      .then(lb => setHandLeaderboard(Array.isArray(lb) ? lb : []))
      .catch(() => setHandLeaderboard([]))
      .finally(() => setLbLoading(false));
  }, [selectedSession]);

  const handleBackdropClick = useCallback((e) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  const handleReplay = useCallback((session) => {
    onClose();
    navigate('/game', {
      state: { replayHandId: session.handId, replayDrawMode: session.drawMode },
    });
  }, [onClose, navigate]);

  const handleChallenge = useCallback(async (session) => {
    if (challenging) return;
    setChallenging(true);
    setChallengeMsg(null);
    try {
      await createSocialChallenge(session.id);
      setChallengeMsg('Challenge sent to your friends!');
    } catch {
      setChallengeMsg('Could not create challenge. Try again.');
    } finally {
      setChallenging(false);
    }
  }, [challenging]);

  if (!date) return null;

  const isHandDetail = !!selectedSession;

  return (
    <div className="day-detail-backdrop" onClick={handleBackdropClick}>
      <div className={`day-detail-drawer${isHandDetail ? ' day-detail-drawer--detail' : ''}`}>

        {/* ── Panel 1: session list ── */}
        {!isHandDetail && (
          <>
            <div className="day-detail-header">
              <h3 className="day-detail-title">{date}</h3>
              <button className="day-detail-close" onClick={onClose} aria-label="Close">×</button>
            </div>
            <div className="day-detail-body">
              {loading && <p className="day-detail-empty">Loading…</p>}
              {!loading && sessions.length === 0 && (
                <p className="day-detail-empty">No sessions on this day.</p>
              )}
              {!loading && sessions.map((s, i) => {
                const status = s.status || (s.won ? 'won' : 'abandoned');
                const isWon  = status === 'won' || status === 'complete';
                const winCount = handWinCounts[s.handId] ?? null;
                const othersWon = winCount !== null && winCount > 0;

                return (
                  <button
                    key={s.id || i}
                    className={`day-detail-session day-detail-session--btn${isWon ? ' day-detail-session--won' : ''}`}
                    onClick={() => setSelectedSession(s)}
                  >
                    <div className="day-detail-session-row">
                      <div className="day-detail-session-left">
                        <span className="day-detail-mode-badge">
                          {s.drawMode === 'draw1' ? 'Draw 1' : 'Draw 3'}
                        </span>
                        {s.moves != null && (
                          <span className="day-detail-session-meta" style={{ gap: 0 }}>
                            {s.moves} moves · {formatTime(s.timeSeconds ?? s.duration)}
                          </span>
                        )}
                      </div>
                      <div className="day-detail-session-right">
                        {isWon && <span className="day-detail-won-check">✓</span>}
                        {othersWon && (
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
          const s = selectedSession;
          const status = s.status || (s.won ? 'won' : 'abandoned');
          const isWon  = status === 'won' || status === 'complete';
          const myEntry = handLeaderboard.find(e => e.userId === user?.id);

          return (
            <>
              <div className="day-detail-header">
                <button className="day-detail-back" onClick={() => setSelectedSession(null)} aria-label="Back">
                  ‹ Back
                </button>
                <span className="day-detail-mode-title">
                  {s.drawMode === 'draw1' ? 'Draw 1' : 'Draw 3'}
                </span>
                <button className="day-detail-close" onClick={onClose} aria-label="Close">×</button>
              </div>

              <div className="day-detail-body">
                {/* Replay CTA */}
                <button className="btn-primary day-detail-replay-btn" onClick={() => handleReplay(s)}>
                  ↺ Play This Hand
                </button>

                {/* Challenge friends — only shown for won sessions */}
                {isWon && (
                  <button
                    className="day-detail-challenge-btn"
                    onClick={() => handleChallenge(s)}
                    disabled={challenging}
                  >
                    {challenging ? 'Sending…' : '⚔ Challenge Friends'}
                  </button>
                )}
                {challengeMsg && (
                  <p className="day-detail-challenge-msg">{challengeMsg}</p>
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
                      </tr>
                    </thead>
                    <tbody>
                      {handLeaderboard.map(row => (
                        <tr
                          key={row.userId}
                          className={user && row.userId === user.id ? 'day-detail-lb-me' : ''}
                        >
                          <td>{row.rank}</td>
                          <td>{row.displayName}</td>
                          <td>{row.moves}</td>
                          <td>{formatTime(row.timeSeconds)}</td>
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
