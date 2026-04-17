import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Confetti } from './Confetti';
import './WinModal.css';

export function WinModal({ moves, timeFormatted, result, onNewGame, onShowLeaderboard }) {
  const navigate = useNavigate();
  const rank = result?.rank || null;

  return (
    <>
      <Confetti />
      <div className="win-overlay">
        <div className="win-modal">
          <div className="win-trophy">🏆</div>
          <h2 className="win-title">You Win!</h2>

          <div className="win-stats">
            <div className="win-stat">
              <span className="win-stat-value">{moves}</span>
              <span className="win-stat-label">Moves</span>
            </div>
            <div className="win-stat">
              <span className="win-stat-value">{timeFormatted}</span>
              <span className="win-stat-label">Time</span>
            </div>
            {rank && (
              <div className="win-stat">
                <span className="win-stat-value">#{rank}</span>
                <span className="win-stat-label">Rank</span>
              </div>
            )}
          </div>

          <div className="win-buttons">
            <button className="btn-primary" onClick={onNewGame}>
              New Game
            </button>
            {onShowLeaderboard ? (
              <button className="btn-secondary" onClick={onShowLeaderboard}>
                Leaderboard
              </button>
            ) : (
              <button className="btn-secondary" onClick={() => navigate('/daily')}>
                Daily
              </button>
            )}
            <button className="btn-secondary" onClick={() => navigate('/profile')}>
              My Stats
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
