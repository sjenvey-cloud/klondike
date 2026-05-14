import React from 'react';
import './ResumeModal.css';

/**
 * DEV-203: App-level modal shown on boot when the server reports an active session.
 * Only displayed when the user is on the screen matching the session type:
 *   - /game  → random hand  → "Resume Game" / "Start New"
 *   - /daily → daily session → "Resume" / "Redeal"
 */
export function ResumeModal({ session, onResume, onStartNew, isDaily = false }) {
  return (
    <div className="resume-overlay">
      <div className="resume-modal">
        <div className="resume-icon">🃏</div>
        <h2 className="resume-title">Unfinished Game</h2>
        <p className="resume-body">
          You have a game in progress
          {session.moves > 0 ? ` — ${session.moves} move${session.moves !== 1 ? 's' : ''} played` : ''}.
          Would you like to continue?
        </p>
        <div className="resume-buttons">
          <button className="resume-btn resume-btn--primary" onClick={onResume}>
            Resume
          </button>
          <button className="resume-btn resume-btn--secondary" onClick={onStartNew}>
            {isDaily ? 'Redeal' : 'Start New'}
          </button>
        </div>
      </div>
    </div>
  );
}
