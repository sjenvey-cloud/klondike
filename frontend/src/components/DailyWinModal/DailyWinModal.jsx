import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDailyLeaderboard } from '../../services/api';
import { Confetti } from '../WinModal/Confetti';
import './DailyWinModal.css';

function formatTime(s) {
  if (s == null || s === 0) return '—';
  const m   = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

/**
 * DailyWinModal
 *
 * Shown by Daily.jsx when the user completes today's daily challenge.
 * Fetches and displays today's leaderboard inline, then offers navigation
 * to the full leaderboard, calendar, a new regular game, home, or profile.
 *
 * Props:
 *   moves         – number of moves taken
 *   timeFormatted – formatted time string (e.g. "2:34")
 *   rank          – leaderboard rank number, or null if unranked
 *   date          – ISO date string for today (e.g. "2026-05-08")
 *   drawMode      – "draw1" | "draw3"
 *   userId        – authenticated user's id (for row highlight)
 *   onNavigate    – callback(destination) where destination is one of:
 *                   'leaderboard' | 'calendar' | 'game' | 'home' | 'profile'
 */
export function DailyWinModal({ moves, timeFormatted, rank, date, drawMode, userUuid, sessionUuid, onNavigate, winAnimation = 'confetti' }) {
  const navigate = useNavigate();
  const [leaderboard, setLeaderboard] = useState([]);
  const [sort,        setSort]        = useState('moves');
  const [lbLoading,   setLbLoading]   = useState(true);

  useEffect(() => {
    setLbLoading(true);
    getDailyLeaderboard(date, sort, drawMode)
      .then(data => setLeaderboard(Array.isArray(data) ? data : []))
      .catch(() => setLeaderboard([]))
      .finally(() => setLbLoading(false));
  }, [date, sort, drawMode]);

  const handleNavigate = (dest) => {
    if (dest === 'game')    { onNavigate(dest); navigate('/game');                     return; }
    if (dest === 'home')    { onNavigate(dest); navigate('/');                         return; }
    if (dest === 'profile') { onNavigate(dest); navigate('/profile');                  return; }
    if (dest === 'replay' && sessionUuid) {
      onNavigate(dest); navigate(`/replay/${sessionUuid}`); return;
    }
    // 'leaderboard' and 'calendar' stay on the /daily route — handled by Daily.jsx
    onNavigate(dest);
  };

  return (
    <>
      {winAnimation === 'confetti' && <Confetti />}
      <div className="dwm-overlay">
        <div className="dwm-modal">

          {/* ── Header ─────────────────────────────────────────────────────── */}
          <div className="dwm-trophy">🏆</div>
          <h2 className="dwm-title">Daily Challenge Complete!</h2>
          <p className="dwm-date">{date}</p>

          {/* ── Stats ──────────────────────────────────────────────────────── */}
          <div className="dwm-stats">
            <div className="dwm-stat">
              <span className="dwm-stat-value">{moves}</span>
              <span className="dwm-stat-label">Moves</span>
            </div>
            <div className="dwm-stat">
              <span className="dwm-stat-value">{timeFormatted}</span>
              <span className="dwm-stat-label">Time</span>
            </div>
            {rank && (
              <div className="dwm-stat">
                <span className="dwm-stat-value">#{rank}</span>
                <span className="dwm-stat-label">Rank</span>
              </div>
            )}
          </div>

          {/* ── Leaderboard ────────────────────────────────────────────────── */}
          <div className="dwm-leaderboard">
            <div className="dwm-lb-top">
              <span className="dwm-lb-title">Leaderboard</span>
              <div className="dwm-sort-row">
                <button
                  className={`dwm-sort-btn${sort === 'moves' ? ' active' : ''}`}
                  onClick={() => setSort('moves')}
                >Moves</button>
                <button
                  className={`dwm-sort-btn${sort === 'time' ? ' active' : ''}`}
                  onClick={() => setSort('time')}
                >Time</button>
              </div>
            </div>

            {lbLoading ? (
              <p className="dwm-lb-empty">Loading…</p>
            ) : leaderboard.length === 0 ? (
              <p className="dwm-lb-empty">No entries yet — you could be first!</p>
            ) : (
              <table className="dwm-lb-table">
                <thead>
                  <tr><th>#</th><th>Player</th><th>Moves</th><th>Time</th></tr>
                </thead>
                <tbody>
                  {leaderboard.slice(0, 5).map(row => (
                    <tr key={row.userUuid} className={row.userUuid === userUuid ? 'dwm-lb-me' : ''}>
                      <td>{row.rank}</td>
                      <td className="dwm-lb-name">{row.displayName}</td>
                      <td>{row.moves}</td>
                      <td>{formatTime(row.timeSeconds)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* ── Navigation ─────────────────────────────────────────────────── */}
          <div className="dwm-actions">
            <button className="btn-primary" onClick={() => handleNavigate('leaderboard')}>
              Full Leaderboard
            </button>
            {sessionUuid && (
              <button className="dwm-replay-btn" onClick={() => handleNavigate('replay')}>
                ▶ Watch My Replay
              </button>
            )}
            <div className="dwm-secondary-row">
              <button className="btn-secondary" onClick={() => handleNavigate('calendar')}>Calendar</button>
              <button className="btn-secondary" onClick={() => handleNavigate('game')}>New Game</button>
            </div>
            <div className="dwm-secondary-row">
              <button className="btn-secondary" onClick={() => handleNavigate('home')}>Home</button>
              <button className="btn-secondary" onClick={() => handleNavigate('profile')}>Profile</button>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
