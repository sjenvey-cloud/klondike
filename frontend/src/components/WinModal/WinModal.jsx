import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Confetti } from './Confetti';
import { getFriends, getCustomLeagues, createSocialChallenge } from '../../services/api';
import './WinModal.css';

/**
 * Post-game modal for regular (non-daily) hands.
 * Actions: New Game · Leaderboard · Create Challenge · Replay · Home
 *
 * Props:
 *   moves           – integer move count
 *   timeFormatted   – "m:ss" string
 *   result          – server CompleteSessionResponse (may be null/empty on 422)
 *   sessionUuid     – UUID string for Replay and challenge creation
 *   onNewGame       – callback to start a fresh random hand
 *   onShowLeaderboard – callback to open the in-game leaderboard panel
 */
export function WinModal({ moves, timeFormatted, result, sessionUuid, onNewGame, onShowLeaderboard }) {
  const navigate = useNavigate();
  const rank = result?.rank || null;

  // 'win' | 'challenge'
  const [view, setView] = useState('win');

  // Challenge picker state
  const [friends,      setFriends]      = useState([]);
  const [leagues,      setLeagues]      = useState([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [selectedUsers,  setSelectedUsers]  = useState(new Set());
  const [selectedLeagues, setSelectedLeagues] = useState(new Set());
  const [sending,      setSending]      = useState(false);
  const [challengeMsg, setChallengeMsg] = useState(null);

  const openChallengePicker = useCallback(async () => {
    setView('challenge');
    setPickerLoading(true);
    setSelectedUsers(new Set());
    setSelectedLeagues(new Set());
    setChallengeMsg(null);
    try {
      const [f, l] = await Promise.all([
        getFriends().catch(() => []),
        getCustomLeagues().catch(() => []),
      ]);
      setFriends(Array.isArray(f) ? f : []);
      setLeagues(Array.isArray(l) ? l : []);
    } finally {
      setPickerLoading(false);
    }
  }, []);

  const toggleUser = useCallback((id) => {
    setSelectedUsers(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const toggleLeague = useCallback((id) => {
    setSelectedLeagues(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleSendChallenge = useCallback(async () => {
    if (sending || !sessionUuid) return;
    setSending(true);
    setChallengeMsg(null);
    try {
      await createSocialChallenge(
        sessionUuid,
        selectedUsers.size  > 0 ? [...selectedUsers]  : null,
        selectedLeagues.size > 0 ? [...selectedLeagues] : null,
      );
      const total = selectedUsers.size + selectedLeagues.size;
      setChallengeMsg(
        total === 0
          ? 'Challenge created!'
          : `Challenge sent to ${total} recipient${total !== 1 ? 's' : ''}!`
      );
    } catch {
      setChallengeMsg('Could not send challenge. Try again.');
    } finally {
      setSending(false);
    }
  }, [sending, sessionUuid, selectedUsers, selectedLeagues]);

  // ── Challenge picker view ─────────────────────────────────────────────

  if (view === 'challenge') {
    return (
      <div className="win-overlay">
        <div className="win-modal win-modal--challenge">
          <div className="win-challenge-header">
            <button className="win-back-btn" onClick={() => { setView('win'); setChallengeMsg(null); }}>
              ← Back
            </button>
            <h2 className="win-challenge-title">Create Challenge</h2>
          </div>

          {pickerLoading && <p className="win-picker-empty">Loading…</p>}

          {!pickerLoading && friends.length === 0 && leagues.length === 0 && (
            <p className="win-picker-empty">Add friends or join a league to send challenges.</p>
          )}

          {!pickerLoading && (friends.length > 0 || leagues.length > 0) && (
            <div className="win-picker-list">
              {leagues.length > 0 && (
                <>
                  <p className="win-picker-section">Leagues</p>
                  {leagues.map(lg => (
                    <label key={lg.id} className="win-picker-row">
                      <input
                        type="checkbox"
                        checked={selectedLeagues.has(lg.id)}
                        onChange={() => toggleLeague(lg.id)}
                      />
                      <span>{lg.name}</span>
                    </label>
                  ))}
                </>
              )}
              {friends.length > 0 && (
                <>
                  <p className="win-picker-section">Friends</p>
                  {friends.map(f => (
                    <label key={f.userId} className="win-picker-row">
                      <input
                        type="checkbox"
                        checked={selectedUsers.has(f.userId)}
                        onChange={() => toggleUser(f.userId)}
                      />
                      <span>{f.displayName}</span>
                    </label>
                  ))}
                </>
              )}
            </div>
          )}

          {challengeMsg && (
            <p className="win-challenge-msg">{challengeMsg}</p>
          )}

          {!pickerLoading && !challengeMsg && (
            <button
              className="btn-primary win-send-btn"
              onClick={handleSendChallenge}
              disabled={sending}
            >
              {sending ? 'Sending…' : 'Send Challenge'}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Win view ──────────────────────────────────────────────────────────

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
            <button className="btn-secondary" onClick={onShowLeaderboard}>
              Leaderboard
            </button>
            {sessionUuid && (
              <button className="btn-secondary" onClick={openChallengePicker}>
                Create Challenge
              </button>
            )}
            {sessionUuid && (
              <button className="btn-secondary" onClick={() => navigate(`/replay/${sessionUuid}`)}>
                Replay
              </button>
            )}
            <button className="btn-secondary" onClick={() => navigate('/')}>
              Home
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
