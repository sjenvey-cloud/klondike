import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Confetti } from './Confetti';
import { getFriends, getCustomLeagues, createSocialChallenge } from '../../services/api';
import type { FriendResponse, CustomLeagueListEntry, CompleteSessionResponse } from '../../types/api';
import './WinModal.css';

interface WinModalProps {
  moves: number;
  timeFormatted: string;
  result: CompleteSessionResponse | null;
  sessionUuid?: string | null;
  onNewGame: () => void;
  onShowLeaderboard: () => void;
  winAnimation?: 'confetti' | 'simple';
}

export function WinModal({
  moves,
  timeFormatted,
  result,
  sessionUuid,
  onNewGame,
  onShowLeaderboard,
  winAnimation = 'confetti',
}: WinModalProps): React.JSX.Element {
  const navigate = useNavigate();
  const rank = result?.rank ?? null;

  const [view, setView] = useState<'win' | 'challenge'>('win');
  const modalRef = useRef<HTMLDivElement>(null);

  // Auto-focus first interactive element when modal opens or view changes
  useEffect(() => {
    const first = modalRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    first?.focus();
  }, [view]);

  const [friends,        setFriends]        = useState<FriendResponse[]>([]);
  const [leagues,        setLeagues]        = useState<CustomLeagueListEntry[]>([]);
  const [pickerLoading,  setPickerLoading]  = useState(false);
  const [selectedUsers,  setSelectedUsers]  = useState<Set<number>>(new Set());
  const [selectedLeagues, setSelectedLeagues] = useState<Set<number>>(new Set());
  const [sending,        setSending]        = useState(false);
  const [challengeMsg,   setChallengeMsg]   = useState<string | null>(null);

  const openChallengePicker = useCallback(async (): Promise<void> => {
    setView('challenge');
    setPickerLoading(true);
    setSelectedUsers(new Set());
    setSelectedLeagues(new Set());
    setChallengeMsg(null);
    try {
      const [f, l] = await Promise.all([
        getFriends().then(r => r?.items ?? []).catch((): FriendResponse[] => []),
        getCustomLeagues().catch((): CustomLeagueListEntry[] => []),
      ]);
      setFriends(Array.isArray(f) ? f : []);
      setLeagues(Array.isArray(l) ? l : []);
    } finally {
      setPickerLoading(false);
    }
  }, []);

  const toggleUser = useCallback((id: number): void => {
    setSelectedUsers(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const toggleLeague = useCallback((id: number): void => {
    setSelectedLeagues(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleSendChallenge = useCallback(async (): Promise<void> => {
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

  if (view === 'challenge') {
    return (
      <div className="win-overlay" aria-hidden="false">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="win-challenge-title"
          className="win-modal win-modal--challenge"
          ref={modalRef}
        >
          <div className="win-challenge-header">
            <button className="win-back-btn" onClick={() => { setView('win'); setChallengeMsg(null); }}>
              ← Back
            </button>
            <h2 id="win-challenge-title" className="win-challenge-title">Create Challenge</h2>
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

  return (
    <>
      {winAnimation === 'confetti' && <Confetti />}
      <div className="win-overlay">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="win-dialog-title"
          className="win-modal"
          ref={modalRef}
        >
          <div className="win-trophy" aria-hidden="true">🏆</div>
          <h2 id="win-dialog-title" className="win-title">You Win!</h2>

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
