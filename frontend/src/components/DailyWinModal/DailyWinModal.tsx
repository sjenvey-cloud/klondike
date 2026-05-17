import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDailyLeaderboard } from '../../services/api';
import type { DailyLeaderboardEntry } from '../../types/api';
import { Confetti } from '../WinModal/Confetti';
import './DailyWinModal.css';

function formatTime(s: number | null | undefined): string {
  if (s == null || s === 0) return '—';
  const m   = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

type DailyWinDest = 'leaderboard' | 'calendar' | 'game' | 'home' | 'profile' | 'replay';

interface DailyWinModalProps {
  moves: number;
  timeFormatted: string;
  rank: number | null;
  date: string;
  drawMode: string;
  userUuid?: string;
  sessionUuid?: string | null;
  onNavigate: (dest: DailyWinDest) => void;
  winAnimation?: 'confetti' | 'simple';
}

export function DailyWinModal({
  moves,
  timeFormatted,
  rank,
  date,
  drawMode,
  userUuid,
  sessionUuid,
  onNavigate,
  winAnimation = 'confetti',
}: DailyWinModalProps): React.JSX.Element {
  const navigate  = useNavigate();
  const modalRef  = useRef<HTMLDivElement>(null);
  const [leaderboard, setLeaderboard] = useState<DailyLeaderboardEntry[]>([]);
  const [sort,        setSort]        = useState('moves');
  const [lbLoading,   setLbLoading]   = useState(true);

  // Auto-focus first interactive element on mount
  useEffect(() => {
    const first = modalRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    first?.focus();
  }, []);

  useEffect(() => {
    setLbLoading(true);
    getDailyLeaderboard(date, sort, drawMode)
      .then(data => setLeaderboard(Array.isArray(data) ? data : []))
      .catch(() => setLeaderboard([]))
      .finally(() => setLbLoading(false));
  }, [date, sort, drawMode]);

  const handleNavigate = (dest: DailyWinDest): void => {
    if (dest === 'game')    { onNavigate(dest); navigate('/game');   return; }
    if (dest === 'home')    { onNavigate(dest); navigate('/');       return; }
    if (dest === 'profile') { onNavigate(dest); navigate('/profile'); return; }
    if (dest === 'replay' && sessionUuid) {
      onNavigate(dest); navigate(`/replay/${sessionUuid}`); return;
    }
    onNavigate(dest);
  };

  return (
    <>
      {winAnimation === 'confetti' && <Confetti />}
      <div className="dwm-overlay">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="dwm-dialog-title"
          className="dwm-modal"
          ref={modalRef}
        >
          <div className="dwm-trophy" aria-hidden="true">🏆</div>
          <h2 id="dwm-dialog-title" className="dwm-title">Daily Challenge Complete!</h2>
          <p className="dwm-date">{date}</p>

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
