import React, { useContext, useEffect, useState, useCallback } from 'react';
import { AuthContext } from '../App';
import {
  getFriends, getLeague, getChallengeInbox,
  createFriendInvite, removeFriend, playChallenge,
} from '../services/api';
import './Friends.css';

const TABS = ['Friends', 'League', 'Challenges'];

export function Friends() {
  const { user } = useContext(AuthContext);
  const [tab, setTab] = useState('Friends');
  const [friends, setFriends] = useState([]);
  const [league, setLeague] = useState([]);
  const [inbox, setInbox] = useState([]);
  const [period, setPeriod] = useState('week');
  const [inviteLink, setInviteLink] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    getFriends().then(setFriends).catch(() => {});
    getChallengeInbox().then(setInbox).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!user) return;
    getLeague(period).then(setLeague).catch(() => {});
  }, [user, period]);

  const handleInvite = async () => {
    const res = await createFriendInvite();
    setInviteLink(res.inviteUrl);
    setCopied(false);
  };

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [inviteLink]);

  const handleRemove = async (friendId) => {
    await removeFriend(friendId);
    setFriends(prev => prev.filter(f => f.userId !== friendId));
  };

  if (!user) {
    return (
      <div className="screen friends-screen friends-center">
        <p>Sign in from the Profile tab to see social features.</p>
      </div>
    );
  }

  return (
    <div className="screen friends-screen">
      <div className="tab-bar">
        {TABS.map(t => (
          <button key={t} className={`tab-btn${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t}
            {t === 'Challenges' && inbox.length > 0 && (
              <span className="badge">{inbox.length}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'Friends' && (
        <div className="tab-content">
          <button className="btn-primary invite-btn" onClick={handleInvite}>
            + Invite a Friend
          </button>
          {inviteLink && (
            <div className="invite-link-box">
              <p className="invite-label">Share this invite link:</p>
              <div className="invite-link-row">
                <code className="invite-link">{inviteLink}</code>
                <div className="invite-actions">
                  <button
                    className={`invite-action-btn${copied ? ' copied' : ''}`}
                    onClick={handleCopy}
                    title="Copy link"
                    aria-label="Copy invite link"
                  >
                    {copied ? (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path d="M3 8l3.5 3.5L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <rect x="5" y="5" width="8" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                        <path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v7A1.5 1.5 0 0 0 3.5 12H5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    )}
                    <span className="invite-action-label">{copied ? 'Copied!' : 'Copy'}</span>
                  </button>
                  <a
                    className="invite-action-btn"
                    href={`sms:?body=${encodeURIComponent('Join me on Klondike Pro! Accept my friend invite: ' + inviteLink)}`}
                    title="Send via text message"
                    aria-label="Send invite via text message"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M13 1H3a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2l1.5 2.5a.5.5 0 0 0 .866 0L9 12h4a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                      <circle cx="5.5" cy="6.5" r="1" fill="currentColor"/>
                      <circle cx="8" cy="6.5" r="1" fill="currentColor"/>
                      <circle cx="10.5" cy="6.5" r="1" fill="currentColor"/>
                    </svg>
                    <span className="invite-action-label">Text</span>
                  </a>
                </div>
              </div>
            </div>
          )}
          <div className="friends-list">
            {friends.length === 0 && (
              <p className="empty-state">No friends yet. Invite someone to get started!</p>
            )}
            {friends.map(f => (
              <div key={f.userId} className="friend-row">
                <div className="friend-info">
                  <span className="friend-name">{f.displayName}</span>
                  {f.gamesCompletedToday > 0 && (
                    <span className="friend-stat">{f.gamesCompletedToday} won today</span>
                  )}
                </div>
                <button className="btn-danger-sm" onClick={() => handleRemove(f.userId)}>Remove</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'League' && (
        <div className="tab-content">
          <div className="period-toggle">
            {['week', 'month', 'alltime'].map(p => (
              <button key={p} className={`period-btn${period === p ? ' active' : ''}`} onClick={() => setPeriod(p)}>
                {p === 'alltime' ? 'All Time' : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
          <table className="lb-table">
            <thead>
              <tr><th>#</th><th>Player</th><th>Wins</th><th>Best</th></tr>
            </thead>
            <tbody>
              {league.map((row, i) => (
                <tr key={row.userId} className={row.userId === user.id ? 'lb-me' : ''}>
                  <td>{i + 1}</td>
                  <td>{row.displayName}</td>
                  <td>{row.wins}</td>
                  <td>{row.bestMoves ?? '—'}</td>
                </tr>
              ))}
              {league.length === 0 && (
                <tr><td colSpan={4} className="lb-empty">No data for this period.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'Challenges' && (
        <div className="tab-content">
          {inbox.length === 0 && (
            <p className="empty-state">No challenges yet.</p>
          )}
          {inbox.map(c => (
            <div key={c.challengeId} className="challenge-row">
              <div>
                <span className="friend-name">{c.challengerDisplayName}</span> challenged you!
                <div className="challenge-stat">
                  {c.moves} moves · {c.timeSeconds ? `${Math.floor(c.timeSeconds / 60)}:${String(c.timeSeconds % 60).padStart(2,'0')}` : '—'}
                </div>
              </div>
              <button
                className="btn-primary"
                style={{ fontSize: 13, padding: '6px 12px' }}
                onClick={() => playChallenge(c.challengeId)
                  .then(res => { window.location.href = `/game?challengeSession=${res.sessionId}`; })
                  .catch(() => {})}
              >
                Accept
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
