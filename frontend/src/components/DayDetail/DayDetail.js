import React, { useEffect, useState, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../App';
import { getSessionsByDate } from '../../services/api';
import './DayDetail.css';

function formatTime(seconds) {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatTimestamp(isoString) {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

const STATUS_LABELS = {
  won:       'Won',
  abandoned: 'Abandoned',
  active:    'Active',
  complete:  'Won',
};

export function DayDetail({ date, onClose }) {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !date) return;
    setLoading(true);
    getSessionsByDate(user.id, date)
      .then(data => setSessions(Array.isArray(data) ? data : []))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, [user, date]);

  const handleBackdropClick = useCallback((e) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  const handlePlayAgain = useCallback((seed) => {
    onClose();
    navigate(`/game?seed=${seed}`);
  }, [onClose, navigate]);

  if (!date) return null;

  return (
    <div className="day-detail-backdrop" onClick={handleBackdropClick}>
      <div className="day-detail-drawer">
        <div className="day-detail-header">
          <h3 className="day-detail-title">{date}</h3>
          <button className="day-detail-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="day-detail-body">
          {loading && (
            <p className="day-detail-empty">Loading…</p>
          )}

          {!loading && sessions.length === 0 && (
            <p className="day-detail-empty">No sessions on this day.</p>
          )}

          {!loading && sessions.map((s, i) => {
            const status = s.status || (s.won ? 'won' : 'abandoned');
            const isWon = status === 'won' || status === 'complete';
            return (
              <div key={s.id || i} className={`day-detail-session${isWon ? ' day-detail-session--won' : ''}`}>
                <div className="day-detail-session-row">
                  <span className="day-detail-session-time">{formatTimestamp(s.startedAt || s.createdAt)}</span>
                  <span className={`day-detail-status day-detail-status--${status}`}>
                    {STATUS_LABELS[status] || status}
                  </span>
                </div>
                <div className="day-detail-session-row day-detail-session-meta">
                  <span>{s.moveCount ?? s.moves ?? '—'} moves</span>
                  <span>Duration: {formatTime(s.timeSeconds ?? s.duration)}</span>
                </div>
                {isWon && s.shuffleSeed && (
                  <button
                    className="btn-secondary day-detail-play-again"
                    onClick={() => handlePlayAgain(s.shuffleSeed)}
                  >
                    Play Again
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
