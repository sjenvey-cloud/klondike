import React, { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../App';
import {
  getFriends, getLeague, getChallengeInbox,
  createFriendInvite, removeFriend,
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

  useEffect(() => {
    if (!user) return;
    getFriends().then(setFriends).catch(() => {});
    getChallengeInbox(user.id).then(setInbox).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!user) return;
    getLeague(user.id, period).then(setLeague).catch(() => {});
  }, [user, period]);

  const handleInvite = async () => {
    const res = await createFriendInvite();
    setInviteLink(res.inviteUrl);
  };

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
              <p className="invite-label">Share this link:</p>
              <code className="invite-link">{inviteLink}</code>
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
            <div key={c.id} className="challenge-row">
              <div>
                <span className="friend-name">{c.challengerDisplayName}</span> challenged you!
                <div className="challenge-stat">
                  {c.moves} moves · {c.timeSeconds ? `${Math.floor(c.timeSeconds / 60)}:${String(c.timeSeconds % 60).padStart(2,'0')}` : '—'}
                </div>
              </div>
              <button className="btn-primary" style={{ fontSize: 13, padding: '6px 12px' }}>
                Accept
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
