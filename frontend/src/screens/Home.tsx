import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getProfile, getActiveSession } from '../services/api';
import type { ActiveSession } from '../types/api';
import './Home.css';

const DRAW_MODE_KEY = 'klondike_draw_mode';

// Shape returned by the profile endpoint (includes basic stats)
interface HomeStats {
  gamesPlayed?: number;
  gamesWon?: number;
  bestMoves?: number | null;
}

const fmtTime = (s: number): string => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

export function Home(): React.JSX.Element {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<HomeStats | null>(null);
  const [activeGame, setActiveGame] = useState<ActiveSession | null>(null);
  const [drawMode, setDrawModeState] = useState<string>(
    () => localStorage.getItem(DRAW_MODE_KEY) || 'draw3'
  );

  useEffect(() => { document.title = 'Klondike Pro'; }, []);
  useEffect(() => {
    if (user) getProfile(user.id).then(data => setStats(data as unknown as HomeStats)).catch(() => {});
  }, [user]);

  // DEV-338: surface an in-progress random hand (possibly paused on another
  // device) so it can be resumed here with its move history + clock intact.
  useEffect(() => {
    if (!user) return;
    getActiveSession()
      .then(res => {
        const r = res.random;
        setActiveGame(r && (r.moves ?? 0) > 0 ? r : null);
      })
      .catch(() => {});
  }, [user]);

  const selectDrawMode = (mode: string): void => {
    localStorage.setItem(DRAW_MODE_KEY, mode);
    setDrawModeState(mode);
  };

  const resumeActiveGame = (): void => {
    if (!activeGame) return;
    // Prefer the local game when it's the SAME session and at least as advanced —
    // server snapshots only happen on pause/hide, so a live local game can be
    // ahead of the server. Replaying the server turns then would lose moves.
    let local: { sessionId?: string; moves?: number } | null = null;
    try { local = JSON.parse(localStorage.getItem('klondike_session') || 'null'); } catch { local = null; }
    const localIsFresher =
      !!local && local.sessionId === activeGame.sessionUuid &&
      (local.moves ?? 0) >= (activeGame.moves ?? 0);
    if (localIsFresher) {
      navigate('/game', { state: { resumeLocal: true } });
    } else {
      navigate('/game', { state: { resumeServer: activeGame } });
    }
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
        {activeGame && (
          <button
            className="btn-primary btn-large home-resume-btn"
            onClick={resumeActiveGame}
            aria-label={`Resume game in progress: ${activeGame.moves} moves, ${fmtTime(activeGame.timeSeconds ?? 0)}`}
          >
            <span aria-hidden="true">↩️</span> Resume Game
            <span className="home-resume-meta">
              {activeGame.moves} moves · {fmtTime(activeGame.timeSeconds ?? 0)} · {(activeGame.drawMode || 'draw3').toUpperCase()}
            </span>
          </button>
        )}

        <button className="btn-primary btn-large" onClick={() => navigate('/game', { state: { drawMode } })}>
          <span aria-hidden="true">🃏</span> New Game
        </button>

        {/* Draw mode toggle */}
        <div className="draw-mode-toggle" role="group" aria-label="Draw mode">
          <button
            className={`draw-mode-pill${drawMode === 'draw1' ? ' draw-mode-pill--active' : ''}`}
            onClick={() => selectDrawMode('draw1')}
            aria-pressed={drawMode === 'draw1'}
          >
            Draw 1
          </button>
          <button
            className={`draw-mode-pill${drawMode === 'draw3' ? ' draw-mode-pill--active' : ''}`}
            onClick={() => selectDrawMode('draw3')}
            aria-pressed={drawMode === 'draw3'}
          >
            Draw 3
          </button>
        </div>

        <button className="btn-secondary btn-large" onClick={() => navigate('/daily')}>
          <span aria-hidden="true">🌅</span> Daily Challenge
        </button>
        <button className="btn-secondary btn-large" onClick={() => navigate('/friends')}>
          <span aria-hidden="true">👥</span> Social &amp; League
        </button>
      </div>
    </div>
  );
}
