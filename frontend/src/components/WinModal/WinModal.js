import React from 'react';
import { useHistory } from 'react-router-dom';
import { Confetti } from './Confetti';
import './WinModal.css';

export function WinModal({ moves, timeFormatted, result, onNewGame }) {
  const history = useHistory();
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
            <button className="btn-secondary" onClick={() => history.push('/daily')}>
              Leaderboard
            </button>
            <button className="btn-secondary" onClick={() => history.push('/profile')}>
              My Stats
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
