import React, { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../App';
import { getDaily, getDailyLeaderboard, getMyDailyRank } from '../services/api';
import { localDateString } from '../services/dateUtils';
import { Game } from './Game';
import './Daily.css';

function formatTime(s) {
  if (!s) return '—';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export function Daily() {
  const { user } = useContext(AuthContext);
  const [daily, setDaily] = useState(null);
  const [dailyError, setDailyError] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [myRank, setMyRank] = useState(null);
  const [sort, setSort] = useState('moves');
  const [view, setView] = useState('board'); // 'board' | 'leaderboard'
  const today = localDateString(new Date());

  useEffect(() => {
    getDaily()
      .then(data => { setDaily(data); setDailyError(false); })
      .catch(() => setDailyError(true));
  }, []);

  useEffect(() => {
    getDailyLeaderboard(today, sort).then(setLeaderboard).catch(() => {});
  }, [today, sort]);

  useEffect(() => {
    if (user) getMyDailyRank(today, user.id, sort).then(setMyRank).catch(() => {});
  }, [today, user, sort]);

  return (
    <div className="screen daily-screen">
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
        </div>
      </div>

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

      {view === 'board' && !dailyError && !daily && (
        <div className="daily-loading">Loading today's challenge…</div>
      )}

      {view === 'board' && !dailyError && daily && (
        <Game
          dailyHand={daily.hand}
          isRanked={!daily.userHasRankedAttempt}
          onShowLeaderboard={() => setView('leaderboard')}
        />
      )}

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
            <button className={`sort-btn${sort === 'time' ? ' active' : ''}`}  onClick={() => setSort('time')}>Time</button>
          </div>

          <table className="lb-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>Moves</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((row, i) => (
                <tr key={row.userId} className={user && row.userId === user.id ? 'lb-me' : ''}>
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
    </div>
  );
}
