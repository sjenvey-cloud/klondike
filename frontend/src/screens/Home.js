import React, { useContext, useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { AuthContext } from '../App';
import { getProfile } from '../services/api';
import './Home.css';

const DRAW_MODE_KEY = 'klondike_draw_mode';

export function Home() {
  const { user } = useContext(AuthContext);
  const history = useHistory();
  const [stats, setStats] = useState(null);
  const [drawMode, setDrawModeState] = useState(
    () => localStorage.getItem(DRAW_MODE_KEY) || 'draw3'
  );

  useEffect(() => {
    if (user) getProfile(user.id).then(setStats).catch(() => {});
  }, [user]);

  const selectDrawMode = (mode) => {
    localStorage.setItem(DRAW_MODE_KEY, mode);
    setDrawModeState(mode);
  };

  return (
    <div className="screen home-screen">
      <header className="home-header">
        <h1 className="home-title">Klondike Pro</h1>
        <p className="home-subtitle">Server Validated</p>
      </header>

      {user && (
        <div className="home-welcome">
          Welcome back, <strong>{user.displayName}</strong>
        </div>
      )}

      {stats && (
        <div className="home-stats">
          <div className="home-stat">
            <span className="home-stat-value">{stats.gamesPlayed ?? 0}</span>
            <span className="home-stat-label">Played</span>
          </div>
          <div className="home-stat">
            <span className="home-stat-value">{stats.gamesWon ?? 0}</span>
            <span className="home-stat-label">Won</span>
          </div>
          <div className="home-stat">
            <span className="home-stat-value">
              {stats.gamesPlayed ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100) : 0}%
            </span>
            <span className="home-stat-label">Win Rate</span>
          </div>
          {stats.bestMoves && (
            <div className="home-stat">
              <span className="home-stat-value">{stats.bestMoves}</span>
              <span className="home-stat-label">Best Moves</span>
            </div>
          )}
        </div>
      )}

      <div className="home-actions">
        <button className="btn-primary btn-large" onClick={() => history.push('/game', { drawMode })}>
          🃏 New Game
        </button>

        {/* Draw mode toggle */}
        <div className="draw-mode-toggle">
          <button
            className={`draw-mode-pill${drawMode === 'draw1' ? ' draw-mode-pill--active' : ''}`}
            onClick={() => selectDrawMode('draw1')}
          >
            Draw 1
          </button>
          <button
            className={`draw-mode-pill${drawMode === 'draw3' ? ' draw-mode-pill--active' : ''}`}
            onClick={() => selectDrawMode('draw3')}
          >
            Draw 3
          </button>
        </div>

        <button className="btn-secondary btn-large" onClick={() => history.push('/daily')}>
          🌅 Daily Challenge
        </button>
        <button className="btn-secondary btn-large" onClick={() => history.push('/friends')}>
          👥 Social & League
        </button>
      </div>
    </div>
  );
}
