import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../App';
import { getDaily, getDailyLeaderboard, getMyDailyRank } from '../services/api';
import { localDateString } from '../services/dateUtils';
import { Game } from './Game';
import { DailyCalendar } from '../components/DailyCalendar/DailyCalendar';
import { DailyWinModal } from '../components/DailyWinModal/DailyWinModal';
import './Daily.css';

function formatTime(s) {
  if (!s) return '—';
  const m   = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export function Daily() {
  const { user }   = useContext(AuthContext);
  const navigate   = useNavigate();
  const [daily,      setDaily]      = useState(null);
  const [dailyError, setDailyError] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [myRank,      setMyRank]      = useState(null);
  const [sort,        setSort]        = useState('moves');
  const [view,        setView]        = useState('board'); // 'board' | 'leaderboard' | 'calendar'

  // Set when the user wins the daily — triggers DailyWinModal
  const [dailyWinData, setDailyWinData] = useState(null);

  const today   = localDateString(new Date());
  const drawMode = daily?.hand?.drawMode || 'draw3';

  // Load today's daily hand once
  useEffect(() => {
    getDaily()
      .then(data => { setDaily(data); setDailyError(false); })
      .catch(() => setDailyError(true));
  }, []);

  // Fetch leaderboard whenever the leaderboard tab is active or sort changes
  useEffect(() => {
    if (view !== 'leaderboard') return;
    getDailyLeaderboard(today, sort, drawMode).then(setLeaderboard).catch(() => {});
  }, [today, sort, view, drawMode]);

  useEffect(() => {
    if (view !== 'leaderboard') return;
    if (user) getMyDailyRank(today, user.id, sort, drawMode).then(setMyRank).catch(() => {});
  }, [today, user, sort, view, drawMode]);

  // Called by DailyWinModal to navigate within or away from the daily screen
  const handleWinNavigate = (dest) => {
    setDailyWinData(null);
    if (dest === 'leaderboard') { setView('leaderboard'); return; }
    if (dest === 'calendar')    { setView('calendar');    return; }
    if (dest === 'game')        { navigate('/game');       return; }
    if (dest === 'home')        { navigate('/');           return; }
    if (dest === 'profile')     { navigate('/profile');    return; }
  };

  return (
    <div className="screen daily-screen">

      {/* ── Header: always visible ──────────────────────────────────────── */}
      <div className="daily-header">
        <div>
          <h2 className="daily-title">Daily Challenge</h2>
          <p className="daily-date">{today}</p>
        </div>
        <div className="daily-tabs">
          <button
            className={`daily-tab${view === 'board' ? ' active' : ''}`}
            onClick={() => setView('board')}
          >Game</button>
          <button
            className={`daily-tab${view === 'leaderboard' ? ' active' : ''}`}
            onClick={() => setView('leaderboard')}
          >Leaderboard</button>
          <button
            className={`daily-tab${view === 'calendar' ? ' active' : ''}`}
            onClick={() => setView('calendar')}
          >Calendar</button>
        </div>
      </div>

      {/* ── Board tab ───────────────────────────────────────────────────── */}

      {/* Error state (board tab only) */}
      {view === 'board' && dailyError && (
        <div className="daily-unavailable">
          <div className="daily-unavailable-box">
            <div className="daily-unavailable-icon">🃏</div>
            <h3 className="daily-unavailable-title">No Daily Challenge Available</h3>
            <p className="daily-unavailable-body">
              We couldn't load today's challenge. Please check your connection and try again.
            </p>
            <button
              className="daily-unavailable-btn"
              onClick={() => {
                setDailyError(false);
                getDaily()
                  .then(data => { setDaily(data); setDailyError(false); })
                  .catch(() => setDailyError(true));
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Loading state (board tab only) */}
      {view === 'board' && !dailyError && !daily && (
        <div className="daily-loading">Loading today's challenge…</div>
      )}

      {/* Game — mounted once when daily data is ready, hidden (not unmounted)
          when switching to other tabs so the session is preserved across tab switches. */}
      {!dailyError && daily && (
        <div className={view === 'board' ? 'daily-board-wrap' : 'daily-board-wrap daily-board-wrap--hidden'}>
          <Game
            dailyHand={daily.hand}
            isRanked={!daily.userHasRankedAttempt}
            onShowLeaderboard={() => setView('leaderboard')}
            onDailyWin={setDailyWinData}
          />
        </div>
      )}

      {/* ── Leaderboard tab ─────────────────────────────────────────────── */}
      {view === 'leaderboard' && (
        <div className="leaderboard">
          {myRank && (
            <div className="my-rank-bar">
              Your rank: <strong>#{myRank.rank}</strong>
              {myRank.moves && <> · {myRank.moves} moves · {formatTime(myRank.timeSeconds)}</>}
            </div>
          )}

          <div className="sort-row">
            <span className="sort-label">Sort by:</span>
            <button className={`sort-btn${sort === 'moves' ? ' active' : ''}`} onClick={() => setSort('moves')}>Moves</button>
            <button className={`sort-btn${sort === 'time'  ? ' active' : ''}`} onClick={() => setSort('time')}>Time</button>
          </div>

          <table className="lb-table">
            <thead>
              <tr><th>#</th><th>Player</th><th>Moves</th><th>Time</th></tr>
            </thead>
            <tbody>
              {leaderboard.map((row, i) => (
                <tr key={row.userUuid} className={user && row.userUuid === user.uuid ? 'lb-me' : ''}>
                  <td>{i + 1}</td>
                  <td>{row.displayName}</td>
                  <td>{row.moves}</td>
                  <td>{formatTime(row.timeSeconds)}</td>
                </tr>
              ))}
              {leaderboard.length === 0 && (
                <tr><td colSpan={4} className="lb-empty">No entries yet — be the first!</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Calendar tab ────────────────────────────────────────────────── */}
      {view === 'calendar' && (
        <DailyCalendar drawMode={drawMode} />
      )}

      {/* ── Daily win modal ─────────────────────────────────────────────── */}
      {dailyWinData && (
        <DailyWinModal
          moves={dailyWinData.moves}
          timeFormatted={dailyWinData.timeFormatted}
          rank={dailyWinData.rank}
          date={today}
          drawMode={drawMode}
          userUuid={user?.uuid}
          onNavigate={handleWinNavigate}
        />
      )}

    </div>
  );
}
