import React, { useContext, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../App';
import {
  getFriends, getLeague,
  createFriendInvite, acceptFriendInvite, removeFriend,
  getSentInvites, deleteSentInvite, previewInvite,
  getSocialChallenges, getSocialChallengeDetail,
  endSocialChallenge, resumeSocialChallenge,
} from '../services/api';
import { getPendingInviteToken, clearPendingInviteToken } from './AcceptInvite';
import './Friends.css';

const TABS = ['Friends', 'League', 'Challenges'];

function formatTime(s) {
  if (!s) return '—';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch { return ''; }
}

function timeUntil(iso) {
  // Backend returns LocalDateTime without Z; treat as UTC
  const diff = new Date(iso + 'Z') - new Date();
  if (diff <= 0) return 'Expired';
  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return `${hours}h left`;
  return `${Math.floor(hours / 24)}d left`;
}

export function Friends() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [tab, setTab] = useState('Friends');

  // Friends list
  const [friends, setFriends] = useState([]);

  // Invite generation (new link)
  const [inviteLink, setInviteLink]   = useState('');
  const [copied, setCopied]           = useState(false);

  // Sent invites panel
  const [sentInvites, setSentInvites]       = useState([]);
  const [copiedInviteId, setCopiedInviteId] = useState(null);

  // Received invite panel (from sessionStorage after login-via-link flow)
  const [pendingInvite, setPendingInvite]       = useState(null); // { token, inviterDisplayName }
  const [acceptingReceived, setAcceptingReceived] = useState(false);
  const [inviteMsg, setInviteMsg]               = useState(null);

  // League
  const [league, setLeague]   = useState([]);
  const [period, setPeriod]   = useState('week');

  // Social challenges
  const [challenges, setChallenges]             = useState([]);
  const [selectedChallenge, setSelectedChallenge] = useState(null);
  const [detailLoading, setDetailLoading]       = useState(false);
  const [actionBusy, setActionBusy]             = useState(false);

  // ── Load friends, sent invites, and check for pending received invite ──
  useEffect(() => {
    if (!user) return;
    getFriends().then(setFriends).catch(() => {});
    getSentInvites().then(setSentInvites).catch(() => {});

    // If the user arrived here after clicking an invite link and then
    // logging in, a token will be in sessionStorage. Preview it so we can
    // show "X wants to be your friend" with accept/decline.
    const token = getPendingInviteToken();
    if (token) {
      previewInvite(token)
        .then(data => setPendingInvite({ token, inviterDisplayName: data.inviterDisplayName }))
        .catch(() => clearPendingInviteToken()); // stale / expired — discard silently
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    getLeague(period).then(setLeague).catch(() => {});
  }, [user, period]);

  useEffect(() => {
    if (!user || tab !== 'Challenges') return;
    getSocialChallenges().then(setChallenges).catch(() => {});
  }, [user, tab]);

  // ── Invite generation ──────────────────────────────────────────────────
  const handleInvite = async () => {
    const res = await createFriendInvite();
    setInviteLink(res.inviteUrl);
    setCopied(false);
    // Refresh the sent invites list to include the new one
    getSentInvites().then(setSentInvites).catch(() => {});
  };

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [inviteLink]);

  // ── Sent invites management ────────────────────────────────────────────
  const handleCopySentInvite = useCallback((id, url) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedInviteId(id);
      setTimeout(() => setCopiedInviteId(null), 2000);
    });
  }, []);

  const handleDeleteSentInvite = useCallback(async (id) => {
    try {
      await deleteSentInvite(id);
      setSentInvites(prev => prev.filter(i => i.id !== id));
    } catch {}
  }, []);

  // ── Received invite actions ────────────────────────────────────────────
  const handleAcceptReceived = useCallback(async () => {
    if (!pendingInvite || acceptingReceived) return;
    setAcceptingReceived(true);
    const name = pendingInvite.inviterDisplayName;
    try {
      await acceptFriendInvite(pendingInvite.token);
      clearPendingInviteToken();
      setPendingInvite(null);
      setInviteMsg(`You are now friends with ${name}!`);
      setTimeout(() => setInviteMsg(null), 4000);
      getFriends().then(setFriends).catch(() => {});
    } catch {
      clearPendingInviteToken();
      setPendingInvite(null);
      setInviteMsg('Could not accept invite — it may have expired.');
      setTimeout(() => setInviteMsg(null), 4000);
    } finally {
      setAcceptingReceived(false);
    }
  }, [pendingInvite, acceptingReceived]);

  const handleDeclineReceived = useCallback(() => {
    clearPendingInviteToken();
    setPendingInvite(null);
  }, []);

  // ── Friends list ───────────────────────────────────────────────────────
  const handleRemove = async (friendId) => {
    await removeFriend(friendId);
    setFriends(prev => prev.filter(f => f.userId !== friendId));
  };

  // ── Social challenges ──────────────────────────────────────────────────
  const openChallenge = useCallback(async (id) => {
    setDetailLoading(true);
    setSelectedChallenge(null);
    try {
      const detail = await getSocialChallengeDetail(id);
      setSelectedChallenge(detail);
    } catch {} finally {
      setDetailLoading(false);
    }
  }, []);

  const handleEndChallenge = useCallback(async (id) => {
    if (actionBusy) return;
    setActionBusy(true);
    try {
      await endSocialChallenge(id);
      const [detail, list] = await Promise.all([
        getSocialChallengeDetail(id),
        getSocialChallenges(),
      ]);
      setSelectedChallenge(detail);
      setChallenges(list);
    } catch {} finally {
      setActionBusy(false);
    }
  }, [actionBusy]);

  const handleResumeChallenge = useCallback(async (id) => {
    if (actionBusy) return;
    setActionBusy(true);
    try {
      await resumeSocialChallenge(id);
      const [detail, list] = await Promise.all([
        getSocialChallengeDetail(id),
        getSocialChallenges(),
      ]);
      setSelectedChallenge(detail);
      setChallenges(list);
    } catch {} finally {
      setActionBusy(false);
    }
  }, [actionBusy]);

  const handlePlayChallenge = useCallback((challenge) => {
    navigate('/game', {
      state: { replayHandId: challenge.handId, replayDrawMode: challenge.drawMode },
    });
  }, [navigate]);

  const newChallengeCount = challenges.filter(
    c => c.status === 'active' && !c.isCreator && !c.userHasWon
  ).length;

  // ── Guard ──────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="screen friends-screen friends-center">
        <p>Sign in from the Profile tab to see social features.</p>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="screen friends-screen">
      <div className="tab-bar">
        {TABS.map(t => (
          <button
            key={t}
            className={`tab-btn${tab === t ? ' active' : ''}`}
            onClick={() => { setTab(t); setSelectedChallenge(null); }}
          >
            {t}
            {t === 'Challenges' && newChallengeCount > 0 && (
              <span className="badge">{newChallengeCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Friends tab ── */}
      {tab === 'Friends' && (
        <div className="tab-content">

          {/* Received invite (sessionStorage → login flow) */}
          {pendingInvite && (
            <div className="received-invite-card">
              <div className="received-invite-info">
                <span className="received-invite-icon">🤝</span>
                <div>
                  <span className="received-invite-name">{pendingInvite.inviterDisplayName}</span>
                  <span className="received-invite-sub"> wants to be your friend</span>
                </div>
              </div>
              <div className="received-invite-actions">
                <button
                  className="btn-primary received-invite-accept"
                  onClick={handleAcceptReceived}
                  disabled={acceptingReceived}
                >
                  {acceptingReceived ? '…' : 'Accept'}
                </button>
                <button className="received-invite-decline" onClick={handleDeclineReceived}>
                  Decline
                </button>
              </div>
            </div>
          )}

          {inviteMsg && <p className="invite-msg">{inviteMsg}</p>}

          {/* Generate new invite */}
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

          {/* Pending sent invites */}
          {sentInvites.length > 0 && (
            <div className="sent-invites-section">
              <p className="sent-invites-header">Pending Invites</p>
              {sentInvites.map(inv => (
                <div key={inv.id} className="sent-invite-row">
                  <div className="sent-invite-info">
                    <span className="sent-invite-expire">{timeUntil(inv.expiresAt)}</span>
                    <span className="sent-invite-date">Sent {formatDate(inv.createdAt)}</span>
                  </div>
                  <div className="sent-invite-btns">
                    <button
                      className={`invite-action-btn${copiedInviteId === inv.id ? ' copied' : ''}`}
                      onClick={() => handleCopySentInvite(inv.id, inv.inviteUrl)}
                      title="Copy invite link"
                    >
                      {copiedInviteId === inv.id ? (
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                          <path d="M3 8l3.5 3.5L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                          <rect x="5" y="5" width="8" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                          <path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v7A1.5 1.5 0 0 0 3.5 12H5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                      )}
                      <span className="invite-action-label">
                        {copiedInviteId === inv.id ? 'Copied' : 'Copy'}
                      </span>
                    </button>
                    <button
                      className="sent-invite-delete-btn"
                      onClick={() => handleDeleteSentInvite(inv.id)}
                      title="Delete invite"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Friends list */}
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

      {/* ── League tab ── */}
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

      {/* ── Challenges tab — list ── */}
      {tab === 'Challenges' && !selectedChallenge && (
        <div className="tab-content">
          {challenges.length === 0 && !detailLoading && (
            <p className="empty-state">
              No challenges yet. Win a deal in your Profile and tap ⚔ Challenge Friends.
            </p>
          )}
          {challenges.map(c => {
            const isNew = !c.isCreator && !c.userHasWon && c.status === 'active';
            return (
              <button key={c.id} className="sc-card" onClick={() => openChallenge(c.id)}>
                <div className="sc-card-top">
                  <span className="sc-mode-badge">
                    {c.drawMode === 'draw1' ? 'Draw 1' : 'Draw 3'}
                  </span>
                  <span className={`sc-status-badge sc-status-badge--${c.status}`}>
                    {c.status === 'active' ? 'Active' : 'Ended'}
                  </span>
                  {isNew && <span className="sc-new-badge">New</span>}
                </div>
                <div className="sc-card-mid">
                  <span className="sc-creator">
                    {c.isCreator ? 'You' : c.creatorDisplayName}
                  </span>
                  <span className="sc-date">{formatDate(c.createdAt)}</span>
                </div>
                <div className="sc-card-bot">
                  {c.winnerCount}/{c.participantCount + 1} completed · ›
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Challenges tab — detail ── */}
      {tab === 'Challenges' && selectedChallenge && (() => {
        const ch = selectedChallenge;
        const isCreator   = ch.creatorUserId === user?.id;
        const myEntry     = ch.leaderboard.find(e => e.userId === user?.id);
        const userHasWon  = myEntry?.moves != null;
        const canPlay     = ch.status === 'active' && !userHasWon;

        return (
          <div className="tab-content sc-detail">
            <div className="sc-detail-header">
              <button className="sc-back-btn" onClick={() => setSelectedChallenge(null)}>
                ‹ Challenges
              </button>
              <span className={`sc-status-badge sc-status-badge--${ch.status}`}>
                {ch.status === 'active' ? 'Active' : 'Ended'}
              </span>
            </div>

            <div className="sc-detail-meta">
              <span className="sc-mode-badge">
                {ch.drawMode === 'draw1' ? 'Draw 1' : 'Draw 3'}
              </span>
              <span className="sc-meta-text">
                Created by <strong>{isCreator ? 'you' : ch.creatorDisplayName}</strong> on {formatDate(ch.createdAt)}
              </span>
            </div>

            {myEntry && userHasWon && (
              <div className="sc-my-rank-bar">
                Your rank: <strong>#{myEntry.rank}</strong>
                {' · '}{myEntry.moves} moves · {formatTime(myEntry.timeSeconds)}
              </div>
            )}

            <div className="sc-action-row">
              {canPlay && (
                <button className="btn-primary sc-play-btn" onClick={() => handlePlayChallenge(ch)}>
                  ▶ Play Challenge
                </button>
              )}
              {isCreator && ch.status === 'active' && (
                <button className="sc-end-btn" onClick={() => handleEndChallenge(ch.id)} disabled={actionBusy}>
                  {actionBusy ? 'Updating…' : 'End Challenge'}
                </button>
              )}
              {isCreator && ch.status === 'ended' && (
                <button className="sc-resume-btn" onClick={() => handleResumeChallenge(ch.id)} disabled={actionBusy}>
                  {actionBusy ? 'Updating…' : 'Resume Challenge'}
                </button>
              )}
            </div>

            <table className="lb-table sc-lb-table">
              <thead>
                <tr><th>#</th><th>Player</th><th>Moves</th><th>Time</th></tr>
              </thead>
              <tbody>
                {ch.leaderboard.map(row => (
                  <tr
                    key={row.userId}
                    className={[
                      row.userId === user?.id ? 'lb-me' : '',
                      row.moves == null ? 'sc-lb-unplayed' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    <td>{row.moves != null ? row.rank : '—'}</td>
                    <td>
                      {row.displayName}
                      {row.isCreator && <span className="sc-creator-badge"> ★</span>}
                    </td>
                    <td>{row.moves ?? '—'}</td>
                    <td>{formatTime(row.timeSeconds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })()}

      {tab === 'Challenges' && detailLoading && (
        <div className="tab-content">
          <p className="empty-state">Loading challenge…</p>
        </div>
      )}
    </div>
  );
}
