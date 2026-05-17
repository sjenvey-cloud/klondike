import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../App';
import { getProfile } from '../services/api';
import './Home.css';

const DRAW_MODE_KEY = 'klondike_draw_mode';

// Shape returned by the profile endpoint (includes basic stats)
interface HomeStats {
  gamesPlayed?: number;
  gamesWon?: number;
  bestMoves?: number | null;
}

export function Home(): React.JSX.Element {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [stats, setStats] = useState<HomeStats | null>(null);
  const [drawMode, setDrawModeState] = useState<string>(
    () => localStorage.getItem(DRAW_MODE_KEY) || 'draw3'
  );

  useEffect(() => {
    if (user) getProfile(user.id).then(data => setStats(data as unknown as HomeStats)).catch(() => {});
  }, [user]);

  const selectDrawMode = (mode: string): void => {
    localStorage.setItem(DRAW_MODE_KEY, mode);
    setDrawModeState(mode);
  };

  return (
    <div className="screen home-screen">
      <header className="home-header">
        <h1 className="home-title">Klondike Pro</h1>
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
              {stats.gamesPlayed ? Math.round(((stats.gamesWon ?? 0) / stats.gamesPlayed) * 100) : 0}%
            </span>
            <span className="home-stat-label">Win Rate</span>
          </div>
          {stats.bestMoves != null && (
            <div className="home-stat">
              <span className="home-stat-value">{stats.bestMoves}</span>
              <span className="home-stat-label">Best Moves</span>
            </div>
          )}
        </div>
      )}

      <div className="home-actions">
        <button className="btn-primary btn-large" onClick={() => navigate('/game', { state: { drawMode } })}>
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

        <button className="btn-secondary btn-large" onClick={() => navigate('/daily')}>
          🌅 Daily Challenge
        </button>
        <button className="btn-secondary btn-large" onClick={() => navigate('/friends')}>
          👥 Social & League
        </button>
      </div>
    </div>
  );
}
