import React, { useContext, useEffect, useState, useCallback } from 'react';
import { AuthContext } from '../App';
import { getGlobalLeaderboard, getGlobalRank } from '../services/api';
import './Leaderboard.css';

const DRAW_MODE_KEY = 'klondike_draw_mode';

function formatTime(s) {
  if (s == null || s === 0) return '—';
  const m   = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

const PERIODS = [
  { value: 'weekly',   label: 'Weekly'    },
  { value: 'monthly',  label: 'Monthly'   },
  { value: 'all-time', label: 'All Time'  },
];

/**
 * DEV-223: Global Rankings screen.
 *
 * Displays the top 50 ranked wins (one per user) across all hands for the
 * selected period, draw mode, and sort. Also shows the authenticated user's
 * own rank via a pinned banner at the top if they are not in the visible list.
 */
export function Leaderboard() {
  const { user } = useContext(AuthContext);

  const [period,   setPeriod]   = useState('weekly');
  const [drawMode, setDrawMode] = useState(
    () => localStorage.getItem(DRAW_MODE_KEY) || 'draw3'
  );
  const [sort,     setSort]     = useState('moves');

  const [board,    setBoard]    = useState([]);
  const [myRank,   setMyRank]   = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const boardPromise = getGlobalLeaderboard(period, drawMode, sort)
      .then(data => setBoard(Array.isArray(data) ? data : []))
      .catch(() => { setBoard([]); setError('Failed to load leaderboard.'); });

    const rankPromise = user?.uuid
      ? getGlobalRank(user.uuid, period, drawMode, sort)
          .then(data => setMyRank(data))
          .catch(() => setMyRank(null))
      : Promise.resolve(setMyRank(null));

    Promise.all([boardPromise, rankPromise]).finally(() => setLoading(false));
  }, [period, drawMode, sort, user]);

  useEffect(() => { load(); }, [load]);

  const isOnBoard = myRank != null && board.some(r => r.userUuid === user?.uuid);

  return (
    <div className="screen lb-screen">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="lb-header">
        <h1 className="lb-title">🏆 Global Rankings</h1>
      </header>

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div className="lb-filters">
        {/* Period */}
        <div className="lb-pill-group">
          {PERIODS.map(p => (
            <button
              key={p.value}
              className={`lb-pill${period === p.value ? ' lb-pill--active' : ''}`}
              onClick={() => setPeriod(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Draw mode + sort on one row */}
        <div className="lb-filter-row">
          <div className="lb-pill-group lb-pill-group--sm">
            <button
              className={`lb-pill lb-pill--sm${drawMode === 'draw3' ? ' lb-pill--active' : ''}`}
              onClick={() => setDrawMode('draw3')}
            >Draw 3</button>
            <button
              className={`lb-pill lb-pill--sm${drawMode === 'draw1' ? ' lb-pill--active' : ''}`}
              onClick={() => setDrawMode('draw1')}
            >Draw 1</button>
          </div>

          <div className="lb-pill-group lb-pill-group--sm">
            <button
              className={`lb-pill lb-pill--sm${sort === 'moves' ? ' lb-pill--active' : ''}`}
              onClick={() => setSort('moves')}
            >Moves</button>
            <button
              className={`lb-pill lb-pill--sm${sort === 'time' ? ' lb-pill--active' : ''}`}
              onClick={() => setSort('time')}
            >Time</button>
          </div>
        </div>
      </div>

      {/* ── My rank banner (shown only when not in top 50) ──────────────── */}
      {myRank && !isOnBoard && (
        <div className="lb-my-rank">
          <span className="lb-my-rank-label">Your rank</span>
          <span className="lb-my-rank-value">#{myRank.rank}</span>
          <span className="lb-my-rank-stats">
            {myRank.moves} moves · {formatTime(myRank.timeSeconds)}
          </span>
        </div>
      )}

      {/* ── Table ───────────────────────────────────────────────────────── */}
      {loading ? (
        <p className="lb-empty">Loading…</p>
      ) : error ? (
        <p className="lb-empty lb-error">{error}</p>
      ) : board.length === 0 ? (
        <div className="lb-empty-state">
          <p className="lb-empty">No wins recorded yet for this period.</p>
          <p className="lb-empty-sub">Win a ranked game to appear here!</p>
        </div>
      ) : (
        <div className="lb-table-wrap">
          <table className="lb-table">
            <thead>
              <tr>
                <th className="lb-col-rank">#</th>
                <th className="lb-col-name">Player</th>
                <th className="lb-col-num">Moves</th>
                <th className="lb-col-num">Time</th>
              </tr>
            </thead>
            <tbody>
              {board.map(row => (
                <tr
                  key={row.userUuid}
                  className={row.userUuid === user?.uuid ? 'lb-row-me' : ''}
                >
                  <td className="lb-col-rank">{row.rank}</td>
                  <td className="lb-col-name">{row.displayName}</td>
                  <td className="lb-col-num">{row.moves}</td>
                  <td className="lb-col-num">{formatTime(row.timeSeconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* My rank footer (when in top 50, show it explicitly at bottom too) */}
      {myRank && isOnBoard && (
        <p className="lb-my-rank-footer">
          Your rank: <strong>#{myRank.rank}</strong>
        </p>
      )}

    </div>
  );
}
