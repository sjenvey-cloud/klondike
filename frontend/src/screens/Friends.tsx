import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  getFriends, getLeague,
  createFriendInvite, acceptFriendInvite, removeFriend,
  getSentInvites, deleteSentInvite, previewInvite,
  sendFriendRequest, getReceivedFriendRequests,
  acceptFriendRequest, declineFriendRequest,
  getCustomLeagues, createCustomLeague, getCustomLeagueDetail,
  getCustomLeaderboard, deleteCustomLeague, addLeagueMembers, removeLeagueMember,
  getSocialChallenges, getSocialChallengeDetail,
  addChallengeParticipants, endSocialChallenge, resumeSocialChallenge,
  deleteSocialChallenge, hideSocialChallenge,
} from '../services/api';
import { getPendingInviteToken, clearPendingInviteToken } from './AcceptInvite';
import type {
  FriendResponse,
  SentInviteResponse,
  FriendRequestEntry,
  LeagueEntry,
  CustomLeagueListEntry,
  CustomLeagueDetail,
  SocialChallengeListEntry,
  SocialChallengeDetail,
} from '../types/api';
import './Friends.css';

type LeagueView = 'list' | 'create' | 'detail' | 'add-members';

const TABS = ['Friends', 'Leagues', 'Challenges'] as const;
type FriendsTab = typeof TABS[number];

function formatTime(s: number | null | undefined): string {
  if (!s) return '—';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' }); }
  catch { return ''; }
}

function timeUntil(iso: string): string {
  const diff = new Date(iso + 'Z').getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return `${hours}h left`;
  return `${Math.floor(hours / 24)}d left`;
}

interface PendingInvite {
  token: string;
  inviterDisplayName: string;
}

export function Friends(): React.JSX.Element {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<FriendsTab>('Friends');

  // ── Friends tab state ──────────────────────────────────────────────
  const [friends, setFriends]                   = useState<FriendResponse[]>([]);
  const [inviteLink, setInviteLink]             = useState('');
  const [copied, setCopied]                     = useState(false);
  const [sentInvites, setSentInvites]           = useState<SentInviteResponse[]>([]);
  const [copiedInviteId, setCopiedInviteId]     = useState<number | null>(null);
  const [pendingInvite, setPendingInvite]       = useState<PendingInvite | null>(null);
  const [acceptingInvite, setAcceptingInvite]   = useState(false);
  const [inviteMsg, setInviteMsg]               = useState<string | null>(null);
  const [friendRequests, setFriendRequests]     = useState<FriendRequestEntry[]>([]);

  // ── Leagues tab state ──────────────────────────────────────────────
  // leagueView: 'list' | 'create' | 'detail' | 'add-members'
  const [leagueView, setLeagueView]             = useState<LeagueView>('list');
  const [friendsPeriod, setFriendsPeriod]       = useState('week');
  const [friendsLeague, setFriendsLeague]       = useState<LeagueEntry[]>([]);
  const [customLeagues, setCustomLeagues]       = useState<CustomLeagueListEntry[]>([]);
  const [leagueBusy, setLeagueBusy]             = useState(false);

  // Create league form
  const [createName, setCreateName]             = useState('');
  const [createSelected, setCreateSelected]     = useState<Set<number>>(new Set());

  // Detail view
  const [selectedLeague, setSelectedLeague]     = useState<CustomLeagueDetail | null>(null);
  const [leaderboard, setLeaderboard]           = useState<LeagueEntry[]>([]);
  const [detailPeriod, setDetailPeriod]         = useState('week');
  const [lbLoading, setLbLoading]               = useState(false);
  const [pendingRequests, setPendingRequests]   = useState<Set<number>>(new Set());

  // Add members form
  const [addSelected, setAddSelected]           = useState<Set<number>>(new Set());

  // ── Challenges tab state ───────────────────────────────────────────
  const [challenges, setChallenges]             = useState<SocialChallengeListEntry[]>([]);
  const [selectedChallenge, setSelectedChallenge] = useState<SocialChallengeDetail | null>(null);
  const [detailLoading, setDetailLoading]       = useState(false);
  const [actionBusy, setActionBusy]             = useState(false);
  // Add-participants picker (shown inside detail view)
  const [addPaxOpen, setAddPaxOpen]             = useState(false);
  const [addPaxSelected, setAddPaxSelected]     = useState<Set<number>>(new Set());
  // Swipe-to-action state
  const [swipedChallengeId, setSwipedChallengeId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId]     = useState<number | null>(null);
  const swipeTouchRef = useRef<{ startX: number; startY: number }>({ startX: 0, startY: 0 });

  // ── Initial data loads ─────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    getFriends().then(r => setFriends(r?.items ?? [])).catch(() => {});
    getSentInvites().then(setSentInvites).catch(() => {});
    getReceivedFriendRequests().then(setFriendRequests).catch(() => {});

    const token = getPendingInviteToken();
    if (token) {
      previewInvite(token)
        .then(d => setPendingInvite({ token, inviterDisplayName: d.inviterDisplayName }))
        .catch(() => clearPendingInviteToken());
    }
  }, [user]);

  useEffect(() => {
    if (!user || tab !== 'Leagues') return;
    getCustomLeagues().then(setCustomLeagues).catch(() => {});
  }, [user, tab]);

  useEffect(() => {
    if (!user || tab !== 'Leagues' || leagueView !== 'list') return;
    getLeague(friendsPeriod).then(r => setFriendsLeague(r?.items ?? [])).catch(() => {});
  }, [user, tab, leagueView, friendsPeriod]);

  useEffect(() => {
    if (!user || tab !== 'Challenges') return;
    getSocialChallenges().then(setChallenges).catch(() => {});
  }, [user, tab]);

  // Reload leaderboard when period changes in detail view
  useEffect(() => {
    if (!selectedLeague) return;
    setLbLoading(true);
    getCustomLeaderboard(selectedLeague.id, detailPeriod)
      .then(data => setLeaderboard(Array.isArray(data) ? data : []))
      .catch(() => setLeaderboard([]))
      .finally(() => setLbLoading(false));
  }, [selectedLeague, detailPeriod]);

  // ── Friends tab handlers ───────────────────────────────────────────
  const handleInvite = async (): Promise<void> => {
    const res = await createFriendInvite();
    setInviteLink(res.inviteUrl);
    setCopied(false);
    getSentInvites().then(setSentInvites).catch(() => {});
  };

  const handleCopy = useCallback((): void => {
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [inviteLink]);

  const handleCopySentInvite = useCallback((id: number, url: string): void => {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedInviteId(id);
      setTimeout(() => setCopiedInviteId(null), 2000);
    });
  }, []);

  const handleDeleteSentInvite = useCallback(async (id: number): Promise<void> => {
    await deleteSentInvite(id).catch(() => {});
    setSentInvites(prev => prev.filter(i => i.id !== id));
  }, []);

  const handleAcceptInvite = useCallback(async (): Promise<void> => {
    if (!pendingInvite || acceptingInvite) return;
    setAcceptingInvite(true);
    const name = pendingInvite.inviterDisplayName;
    try {
      await acceptFriendInvite(pendingInvite.token);
      clearPendingInviteToken();
      setPendingInvite(null);
      setInviteMsg(`You are now friends with ${name}!`);
      setTimeout(() => setInviteMsg(null), 4000);
      getFriends().then(r => setFriends(r?.items ?? [])).catch(() => {});
    } catch {
      clearPendingInviteToken();
      setPendingInvite(null);
      setInviteMsg('Could not accept invite — it may have expired.');
      setTimeout(() => setInviteMsg(null), 4000);
    } finally {
      setAcceptingInvite(false);
    }
  }, [pendingInvite, acceptingInvite]);

  const handleDeclineInvite = useCallback((): void => {
    clearPendingInviteToken();
    setPendingInvite(null);
  }, []);

  const handleAcceptFriendRequest = useCallback(async (id: number, name: string): Promise<void> => {
    await acceptFriendRequest(id).catch(() => {});
    setFriendRequests(prev => prev.filter(r => r.id !== id));
    getFriends().then(r => setFriends(r?.items ?? [])).catch(() => {});
    setInviteMsg(`You are now friends with ${name}!`);
    setTimeout(() => setInviteMsg(null), 4000);
  }, []);

  const handleDeclineFriendRequest = useCallback(async (id: number): Promise<void> => {
    await declineFriendRequest(id).catch(() => {});
    setFriendRequests(prev => prev.filter(r => r.id !== id));
  }, []);

  const handleRemoveFriend = async (friendId: number): Promise<void> => {
    await removeFriend(friendId);
    setFriends(prev => prev.filter(f => f.userId !== friendId));
  };

  // ── Leagues tab handlers ───────────────────────────────────────────
  const openLeagueDetail = useCallback(async (id: number): Promise<void> => {
    setLeagueBusy(true);
    setDetailPeriod('week');
    try {
      const detail = await getCustomLeagueDetail(id);
      setSelectedLeague(detail);
      setLeagueView('detail');
      // Build initial pending set from member data
      const pending = new Set(
        detail.members.filter(m => m.hasPendingRequest).map(m => m.userId)
      );
      setPendingRequests(pending);
    } catch {} finally {
      setLeagueBusy(false);
    }
  }, []);

  const handleCreateLeague = useCallback(async (): Promise<void> => {
    if (!createName.trim() || leagueBusy) return;
    setLeagueBusy(true);
    try {
      await createCustomLeague(createName.trim(), [...createSelected]);
      setCreateName('');
      setCreateSelected(new Set());
      const leagues = await getCustomLeagues();
      setCustomLeagues(leagues);
      setLeagueView('list');
    } catch {} finally {
      setLeagueBusy(false);
    }
  }, [createName, createSelected, leagueBusy]);

  const handleDeleteLeague = useCallback(async (id: number): Promise<void> => {
    await deleteCustomLeague(id).catch(() => {});
    setCustomLeagues(prev => prev.filter(l => l.id !== id));
    setSelectedLeague(null);
    setLeagueView('list');
  }, []);

  const handleRemoveLeagueMember = useCallback(async (leagueId: number, userId: number): Promise<void> => {
    await removeLeagueMember(leagueId, userId).catch(() => {});
    setSelectedLeague(prev => prev ? {
      ...prev,
      members: prev.members.filter(m => m.userId !== userId),
    } : prev);
  }, []);

  const handleAddMembers = useCallback(async (): Promise<void> => {
    if (!selectedLeague || addSelected.size === 0 || leagueBusy) return;
    setLeagueBusy(true);
    try {
      await addLeagueMembers(selectedLeague.id, [...addSelected]);
      const detail = await getCustomLeagueDetail(selectedLeague.id);
      setSelectedLeague(detail);
      setAddSelected(new Set());
      setLeagueView('detail');
    } catch {} finally {
      setLeagueBusy(false);
    }
  }, [selectedLeague, addSelected, leagueBusy]);

  const handleSendFriendRequest = useCallback(async (targetUserId: number): Promise<void> => {
    await sendFriendRequest(targetUserId).catch(() => {});
    setPendingRequests(prev => new Set([...prev, targetUserId]));
    // Also update the member entry in selectedLeague so the button updates
    setSelectedLeague(prev => prev ? {
      ...prev,
      members: prev.members.map(m =>
        m.userId === targetUserId ? { ...m, hasPendingRequest: true } : m
      ),
    } : prev);
  }, []);

  // ── Challenges tab handlers ────────────────────────────────────────
  const openChallenge = useCallback(async (id: number): Promise<void> => {
    setDetailLoading(true);
    setSelectedChallenge(null);
    try {
      setSelectedChallenge(await getSocialChallengeDetail(id));
    } catch {} finally {
      setDetailLoading(false);
    }
  }, []);

  const handleEndChallenge = useCallback(async (id: number): Promise<void> => {
    if (actionBusy) return;
    setActionBusy(true);
    try {
      await endSocialChallenge(id);
      const [detail, list] = await Promise.all([getSocialChallengeDetail(id), getSocialChallenges()]);
      setSelectedChallenge(detail);
      setChallenges(list);
    } catch {} finally { setActionBusy(false); }
  }, [actionBusy]);

  const handleResumeChallenge = useCallback(async (id: number): Promise<void> => {
    if (actionBusy) return;
    setActionBusy(true);
    try {
      await resumeSocialChallenge(id);
      const [detail, list] = await Promise.all([getSocialChallengeDetail(id), getSocialChallenges()]);
      setSelectedChallenge(detail);
      setChallenges(list);
    } catch {} finally { setActionBusy(false); }
  }, [actionBusy]);

  const handleAddParticipants = useCallback(async (challengeId: number): Promise<void> => {
    if (addPaxSelected.size === 0 || actionBusy) return;
    setActionBusy(true);
    try {
      await addChallengeParticipants(challengeId, [...addPaxSelected]);
      const [detail, list] = await Promise.all([getSocialChallengeDetail(challengeId), getSocialChallenges()]);
      setSelectedChallenge(detail);
      setChallenges(list);
      setAddPaxSelected(new Set());
      setAddPaxOpen(false);
    } catch {} finally { setActionBusy(false); }
  }, [addPaxSelected, actionBusy]);

  const handleDeleteChallenge = useCallback(async (id: number): Promise<void> => {
    if (actionBusy) return;
    setActionBusy(true);
    try {
      await deleteSocialChallenge(id);
      setChallenges(prev => prev.filter(c => c.id !== id));
      setDeleteConfirmId(null);
      setSwipedChallengeId(null);
    } catch {} finally { setActionBusy(false); }
  }, [actionBusy]);

  const handleHideChallenge = useCallback(async (id: number): Promise<void> => {
    if (actionBusy) return;
    setActionBusy(true);
    try {
      await hideSocialChallenge(id);
      setChallenges(prev => prev.filter(c => c.id !== id));
      setSwipedChallengeId(null);
    } catch {} finally { setActionBusy(false); }
  }, [actionBusy]);

  const newChallengeCount = challenges.filter(
    c => c.status === 'active' && !c.isCreator && !c.userHasWon
  ).length;

  // ── Guard ──────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="screen friends-screen friends-center">
        <p>Sign in from the Profile tab to see social features.</p>
      </div>
    );
  }

  // Members already in the selected league (for the add-members picker)
  const leagueMemberIds = selectedLeague
    ? new Set(selectedLeague.members.map(m => m.userId))
    : new Set<number>();

  // Friends not yet in the league (for add-members picker)
  const addableFriends = friends.filter(f => !leagueMemberIds.has(f.userId));

  // Friends not yet in the create form
  const friendsForCreate = friends;

  return (
    <div className="screen friends-screen">
      <div className="tab-bar">
        {TABS.map(t => (
          <button
            key={t}
            className={`tab-btn${tab === t ? ' active' : ''}`}
            onClick={() => {
              setTab(t);
              setSelectedChallenge(null);
              setSwipedChallengeId(null);
              setDeleteConfirmId(null);
              if (t === 'Leagues') {
                setLeagueView('list');
                setSelectedLeague(null);
              }
            }}
          >
            {t}
            {t === 'Challenges' && newChallengeCount > 0 && (
              <span className="tab-heart-badge" aria-label={`${newChallengeCount} new`}>♥</span>
            )}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          FRIENDS TAB
          ════════════════════════════════════════════════════════════════════ */}
      {tab === 'Friends' && (
        <div className="tab-content">

          {/* Received invite (sessionStorage token) */}
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
                <button className="btn-primary received-invite-accept" onClick={handleAcceptInvite} disabled={acceptingInvite}>
                  {acceptingInvite ? '…' : 'Accept'}
                </button>
                <button className="received-invite-decline" onClick={handleDeclineInvite}>Decline</button>
              </div>
            </div>
          )}

          {/* Received friend requests (from league "Add Friend" flow) */}
          {friendRequests.map(req => (
            <div key={req.id} className="received-invite-card">
              <div className="received-invite-info">
                <span className="received-invite-icon">👋</span>
                <div>
                  <span className="received-invite-name">{req.requesterDisplayName}</span>
                  <span className="received-invite-sub"> wants to be your friend</span>
                </div>
              </div>
              <div className="received-invite-actions">
                <button className="btn-primary received-invite-accept"
                  onClick={() => handleAcceptFriendRequest(req.id, req.requesterDisplayName)}>
                  Accept
                </button>
                <button className="received-invite-decline"
                  onClick={() => handleDeclineFriendRequest(req.id)}>
                  Decline
                </button>
              </div>
            </div>
          ))}

          {inviteMsg && <p className="invite-msg">{inviteMsg}</p>}

          {/* Generate invite link */}
          <button className="btn-primary invite-btn" onClick={handleInvite}>
            + Invite a Friend
          </button>

          {inviteLink && (
            <div className="invite-link-box">
              <p className="invite-label">Share this invite link:</p>
              <div className="invite-link-row">
                <code className="invite-link">{inviteLink}</code>
                <div className="invite-actions">
                  <button className={`invite-action-btn${copied ? ' copied' : ''}`} onClick={handleCopy} title="Copy link">
                    {copied
                      ? <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8l3.5 3.5L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      : <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="5" y="5" width="8" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v7A1.5 1.5 0 0 0 3.5 12H5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    }
                    <span className="invite-action-label">{copied ? 'Copied!' : 'Copy'}</span>
                  </button>
                  <a className="invite-action-btn"
                    href={`sms:?body=${encodeURIComponent('Join me on Klondike Pro! ' + inviteLink)}`}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M13 1H3a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2l1.5 2.5a.5.5 0 0 0 .866 0L9 12h4a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><circle cx="5.5" cy="6.5" r="1" fill="currentColor"/><circle cx="8" cy="6.5" r="1" fill="currentColor"/><circle cx="10.5" cy="6.5" r="1" fill="currentColor"/></svg>
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
                    <button className={`invite-action-btn${copiedInviteId === inv.id ? ' copied' : ''}`}
                      onClick={() => handleCopySentInvite(inv.id, inv.inviteUrl)}>
                      {copiedInviteId === inv.id
                        ? <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8l3.5 3.5L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        : <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="5" y="5" width="8" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v7A1.5 1.5 0 0 0 3.5 12H5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                      }
                      <span className="invite-action-label">{copiedInviteId === inv.id ? 'Copied' : 'Copy'}</span>
                    </button>
                    <button className="sent-invite-delete-btn" onClick={() => handleDeleteSentInvite(inv.id)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Friends list */}
          <div className="friends-list">
            {friends.length === 0 && <p className="empty-state">No friends yet. Invite someone!</p>}
            {friends.map(f => {
              const initials = f.displayName
                ? f.displayName.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
                : '?';
              return (
                <div key={f.userId} className="friend-row">
                  <div className="friend-avatar-bubble">
                    {f.avatarUrl
                      ? <img src={f.avatarUrl} className="friend-avatar-img" alt={f.displayName}
                          onError={e => {
                            const img = e.currentTarget;
                            img.style.display = 'none';
                            const sibling = img.nextSibling as HTMLElement | null;
                            if (sibling) sibling.style.display = 'flex';
                          }}
                        />
                      : null
                    }
                    <span className="friend-avatar-initials" style={f.avatarUrl ? { display: 'none' } : {}}>{initials}</span>
                  </div>
                  <div className="friend-info">
                    <span className="friend-name">{f.displayName}</span>
                    {(f.gamesCompletedToday ?? 0) > 0 && (
                      <span className="friend-stat">{f.gamesCompletedToday} won today</span>
                    )}
                  </div>
                  <button className="btn-danger-sm" onClick={() => handleRemoveFriend(f.userId)}>Remove</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          LEAGUES TAB — LIST VIEW
          ════════════════════════════════════════════════════════════════════ */}
      {tab === 'Leagues' && leagueView === 'list' && (
        <div className="tab-content">

          {/* ── Friends League ── */}
          <div className="league-section-header">Friends League</div>
          <div className="period-toggle">
            {['week', 'month', 'alltime'].map(p => (
              <button key={p} className={`period-btn${friendsPeriod === p ? ' active' : ''}`}
                onClick={() => setFriendsPeriod(p)}>
                {p === 'alltime' ? 'All Time' : p === 'week' ? 'Week' : 'Month'}
              </button>
            ))}
          </div>
          <table className="lb-table">
            <thead><tr><th>#</th><th>Player</th><th>Wins</th><th>Best</th></tr></thead>
            <tbody>
              {friendsLeague.map(row => (
                <tr key={row.userId} className={row.userId === user.id ? 'lb-me' : ''}>
                  <td>{row.rank}</td><td>{row.displayName}</td>
                  <td>{row.wins}</td><td>{row.bestMoves ?? '—'}</td>
                </tr>
              ))}
              {friendsLeague.length === 0 && (
                <tr><td colSpan={4} className="lb-empty">No data for this period.</td></tr>
              )}
            </tbody>
          </table>

          {/* ── My Leagues ── */}
          <div className="league-section-header league-section-header--spaced">
            My Leagues
            <button className="btn-primary league-create-btn" onClick={() => {
              setCreateName('');
              setCreateSelected(new Set());
              setLeagueView('create');
            }}>
              + Create League
            </button>
          </div>

          {customLeagues.length === 0 && (
            <p className="empty-state">No leagues yet. Create one to compete with a group!</p>
          )}
          {customLeagues.map(l => (
            <button key={l.id} className="league-card" onClick={() => openLeagueDetail(l.id)}>
              <div className="league-card-name">{l.name}</div>
              <div className="league-card-meta">
                {l.memberCount} member{l.memberCount !== 1 ? 's' : ''}
                {l.isCreator && <span className="league-creator-badge"> · Creator</span>}
              </div>
              <div className="league-card-chevron">›</div>
            </button>
          ))}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          LEAGUES TAB — CREATE VIEW
          ════════════════════════════════════════════════════════════════════ */}
      {tab === 'Leagues' && leagueView === 'create' && (
        <div className="tab-content">
          <div className="league-detail-header">
            <button className="sc-back-btn" onClick={() => setLeagueView('list')}>‹ Leagues</button>
          </div>

          <p className="league-form-label">League Name</p>
          <input
            className="text-input league-name-input"
            placeholder="e.g. Work Friends"
            value={createName}
            onChange={e => setCreateName(e.target.value)}
            maxLength={100}
          />

          {friendsForCreate.length > 0 && (
            <>
              <p className="league-form-label">Add Friends</p>
              <div className="league-member-picker">
                {friendsForCreate.map(f => {
                  const checked = createSelected.has(f.userId);
                  return (
                    <label key={f.userId} className="league-picker-row">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setCreateSelected(prev => {
                            const next = new Set(prev);
                            checked ? next.delete(f.userId) : next.add(f.userId);
                            return next;
                          });
                        }}
                      />
                      <span className="league-picker-name">{f.displayName}</span>
                    </label>
                  );
                })}
              </div>
            </>
          )}

          <button
            className="btn-primary"
            onClick={handleCreateLeague}
            disabled={!createName.trim() || leagueBusy}
          >
            {leagueBusy ? 'Creating…' : 'Create League'}
          </button>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          LEAGUES TAB — DETAIL VIEW
          ════════════════════════════════════════════════════════════════════ */}
      {tab === 'Leagues' && leagueView === 'detail' && selectedLeague && (
        <div className="tab-content">
          <div className="league-detail-header">
            <button className="sc-back-btn" onClick={() => { setLeagueView('list'); setSelectedLeague(null); }}>
              ‹ Leagues
            </button>
          </div>

          <h2 className="league-detail-title">{selectedLeague.name}</h2>

          {/* Leaderboard */}
          <div className="period-toggle">
            {['week', 'month', 'alltime'].map(p => (
              <button key={p} className={`period-btn${detailPeriod === p ? ' active' : ''}`}
                onClick={() => setDetailPeriod(p)}>
                {p === 'alltime' ? 'All Time' : p === 'week' ? 'Week' : 'Month'}
              </button>
            ))}
          </div>

          {lbLoading
            ? <p className="empty-state">Loading…</p>
            : (
              <table className="lb-table">
                <thead><tr><th>#</th><th>Player</th><th>Wins</th><th>Best</th><th></th></tr></thead>
                <tbody>
                  {leaderboard.map(row => {
                    const member = selectedLeague.members.find(m => m.userId === row.userId);
                    const isSelf = row.userId === user.id;
                    const isFriend = member?.isFriend ?? true;
                    const hasPending = pendingRequests.has(row.userId) || member?.hasPendingRequest;
                    return (
                      <tr key={row.userId} className={isSelf ? 'lb-me' : ''}>
                        <td>{row.rank}</td>
                        <td>{row.displayName}</td>
                        <td>{row.wins}</td>
                        <td>{row.bestMoves ?? '—'}</td>
                        <td>
                          {!isSelf && !isFriend && (
                            <button
                              className={`league-add-friend-btn${hasPending ? ' league-add-friend-btn--sent' : ''}`}
                              onClick={() => !hasPending && handleSendFriendRequest(row.userId)}
                              disabled={!!hasPending}
                            >
                              {hasPending ? 'Requested' : '+ Friend'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {leaderboard.length === 0 && !lbLoading && (
                    <tr><td colSpan={5} className="lb-empty">No data for this period.</td></tr>
                  )}
                </tbody>
              </table>
            )
          }

          {/* Members management */}
          <div className="league-members-section">
            <div className="league-members-header">
              <span>Members</span>
              {selectedLeague.isCreator && (
                <button className="league-add-member-btn"
                  onClick={() => { setAddSelected(new Set()); setLeagueView('add-members'); }}>
                  + Add
                </button>
              )}
            </div>
            {selectedLeague.members.map(m => (
              <div key={m.userId} className="league-member-row">
                <span className="league-member-name">
                  {m.displayName}
                  {m.userId === user.id && <span className="league-you-badge"> (you)</span>}
                  {selectedLeague.creatorUserId != null && m.userId === selectedLeague.creatorUserId && m.userId !== user.id && (
                    <span className="league-creator-badge"> ★</span>
                  )}
                </span>
                {selectedLeague.isCreator && m.userId !== user.id && (
                  <button className="btn-danger-sm"
                    onClick={() => handleRemoveLeagueMember(selectedLeague.id, m.userId)}>
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Danger zone */}
          {selectedLeague.isCreator && (
            <div className="league-danger-zone">
              <button className="league-delete-btn"
                onClick={() => handleDeleteLeague(selectedLeague.id)}>
                Delete League
              </button>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          LEAGUES TAB — ADD MEMBERS VIEW
          ════════════════════════════════════════════════════════════════════ */}
      {tab === 'Leagues' && leagueView === 'add-members' && selectedLeague && (
        <div className="tab-content">
          <div className="league-detail-header">
            <button className="sc-back-btn" onClick={() => setLeagueView('detail')}>‹ Back</button>
          </div>

          <p className="league-form-label">Add friends to <strong>{selectedLeague.name}</strong></p>

          {addableFriends.length === 0
            ? <p className="empty-state">All your friends are already in this league.</p>
            : (
              <div className="league-member-picker">
                {addableFriends.map(f => {
                  const checked = addSelected.has(f.userId);
                  return (
                    <label key={f.userId} className="league-picker-row">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setAddSelected(prev => {
                            const next = new Set(prev);
                            checked ? next.delete(f.userId) : next.add(f.userId);
                            return next;
                          });
                        }}
                      />
                      <span className="league-picker-name">{f.displayName}</span>
                    </label>
                  );
                })}
              </div>
            )
          }

          <button
            className="btn-primary"
            onClick={handleAddMembers}
            disabled={addSelected.size === 0 || leagueBusy}
          >
            {leagueBusy ? 'Adding…' : `Add ${addSelected.size > 0 ? addSelected.size : ''} Member${addSelected.size !== 1 ? 's' : ''}`}
          </button>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          CHALLENGES TAB
          ════════════════════════════════════════════════════════════════════ */}
      {tab === 'Challenges' && !selectedChallenge && (
        <div className="tab-content">
          {challenges.length === 0 && !detailLoading && (
            <p className="empty-state">No challenges yet. Win a deal and tap ⚔ Challenge Friends.</p>
          )}
          {challenges.map(c => {
            const isNew    = !c.isCreator && !c.userHasWon && c.status === 'active';
            const isSwiped = swipedChallengeId === c.id;
            return (
              <div key={c.id} className="sc-swipe-outer">
                <div
                  className={`sc-swipe-inner${isSwiped ? ' swiped' : ''}`}
                  onTouchStart={e => {
                    swipeTouchRef.current = {
                      startX: e.touches[0].clientX,
                      startY: e.touches[0].clientY,
                    };
                  }}
                  onTouchEnd={e => {
                    const dx = swipeTouchRef.current.startX - e.changedTouches[0].clientX;
                    const dy = Math.abs(swipeTouchRef.current.startY - e.changedTouches[0].clientY);
                    if (dx > 50 && dy < 40) {
                      setSwipedChallengeId(c.id);
                    } else if (dx < -20) {
                      setSwipedChallengeId(null);
                    }
                  }}
                >
                  <button
                    className="sc-card"
                    onClick={() => {
                      if (isSwiped) { setSwipedChallengeId(null); return; }
                      openChallenge(c.id);
                    }}
                  >
                    <div className="sc-card-top">
                      <span className="sc-mode-badge">{c.drawMode === 'draw1' ? 'Draw 1' : 'Draw 3'}</span>
                      <span className={`sc-status-badge sc-status-badge--${c.status}`}>
                        {c.status === 'active' ? 'Active' : 'Ended'}
                      </span>
                      {isNew && <span className="sc-new-badge">New</span>}
                    </div>
                    <div className="sc-card-mid">
                      <span className="sc-creator">{c.isCreator ? 'You' : c.creatorDisplayName}</span>
                      <span className="sc-date">{formatDate(c.createdAt)}</span>
                    </div>
                    <div className="sc-card-bot">{c.winnerCount ?? 0}/{(c.participantCount ?? 0) + 1} completed · ›</div>
                  </button>
                </div>
                <div className={`sc-swipe-action${isSwiped ? ' visible' : ''}`}>
                  {c.isCreator
                    ? (
                      <button
                        className="sc-action-btn sc-action-btn--delete"
                        onClick={() => setDeleteConfirmId(c.id)}
                      >
                        Delete
                      </button>
                    ) : (
                      <button
                        className="sc-action-btn sc-action-btn--hide"
                        onClick={() => handleHideChallenge(c.id)}
                        disabled={actionBusy}
                      >
                        Hide
                      </button>
                    )
                  }
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'Challenges' && selectedChallenge && (() => {
        const ch = selectedChallenge;
        const isCreator  = ch.creatorUserId === user?.id;
        const myEntry    = ch.leaderboard.find(e => e.userId === user?.id);
        const userHasWon = myEntry?.moves != null;
        // Allow playing/replaying any time the challenge is active
        const canPlay    = ch.status === 'active';

        // Friends not yet in the challenge (for add-participants picker)
        const involvedIds    = new Set(ch.leaderboard.map(e => e.userId));
        const addablePaxFriends = friends.filter(f => !involvedIds.has(f.userId));

        return (
          <div className="tab-content sc-detail">
            <div className="sc-detail-header">
              <button className="sc-back-btn" onClick={() => { setSelectedChallenge(null); setAddPaxOpen(false); setAddPaxSelected(new Set()); }}>‹ Challenges</button>
              <span className={`sc-status-badge sc-status-badge--${ch.status}`}>
                {ch.status === 'active' ? 'Active' : 'Ended'}
              </span>
            </div>
            <div className="sc-detail-meta">
              <span className="sc-mode-badge">{ch.drawMode === 'draw1' ? 'Draw 1' : 'Draw 3'}</span>
              <span className="sc-meta-text">
                Created by <strong>{isCreator ? 'you' : ch.creatorDisplayName}</strong> on {formatDate(ch.createdAt)}
              </span>
            </div>
            {myEntry && userHasWon && (
              <div className="sc-my-rank-bar">
                Your rank: <strong>#{myEntry.rank}</strong> · {myEntry.moves} moves · {formatTime(myEntry.timeSeconds)}
              </div>
            )}
            <div className="sc-action-row">
              {canPlay && (
                <button className="btn-primary sc-play-btn"
                  onClick={() => navigate('/game', { state: { replayHandId: ch.handUuid, replayDrawMode: ch.drawMode } })}>
                  {userHasWon ? '↺ Replay' : '▶ Play Challenge'}
                </button>
              )}
              {isCreator && ch.status === 'active' && (
                <button className="sc-add-players-btn"
                  onClick={() => { setAddPaxOpen(o => !o); setAddPaxSelected(new Set()); }}
                  disabled={actionBusy}>
                  + Add Players
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

            {/* ── Add participants picker ────────────────────────── */}
            {addPaxOpen && isCreator && ch.status === 'active' && (
              <div className="sc-add-pax-panel">
                <p className="sc-add-pax-title">Add players to this challenge</p>
                {addablePaxFriends.length === 0
                  ? <p className="empty-state">All your friends are already in this challenge.</p>
                  : (
                    <div className="sc-add-pax-list">
                      {addablePaxFriends.map(f => {
                        const checked = addPaxSelected.has(f.userId);
                        return (
                          <label key={f.userId} className="sc-add-pax-row">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => setAddPaxSelected(prev => {
                                const next = new Set(prev);
                                checked ? next.delete(f.userId) : next.add(f.userId);
                                return next;
                              })}
                            />
                            <span className="sc-add-pax-name">{f.displayName}</span>
                          </label>
                        );
                      })}
                    </div>
                  )
                }
                <div className="sc-add-pax-actions">
                  <button className="btn-primary"
                    onClick={() => handleAddParticipants(ch.id)}
                    disabled={addPaxSelected.size === 0 || actionBusy}>
                    {actionBusy ? 'Adding…' : `Invite${addPaxSelected.size > 0 ? ` (${addPaxSelected.size})` : ''}`}
                  </button>
                  <button className="sc-add-pax-cancel"
                    onClick={() => { setAddPaxOpen(false); setAddPaxSelected(new Set()); }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <table className="lb-table sc-lb-table">
              <thead><tr><th>#</th><th>Player</th><th>Moves</th><th>Time</th></tr></thead>
              <tbody>
                {ch.leaderboard.map(row => (
                  <tr key={row.userId ?? row.userUuid}
                    className={[row.userId === user?.id ? 'lb-me' : '', row.moves == null ? 'sc-lb-unplayed' : ''].filter(Boolean).join(' ')}>
                    <td>{row.moves != null ? row.rank : '—'}</td>
                    <td>{row.displayName}{row.isCreator && <span className="sc-creator-badge"> ★</span>}</td>
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
        <div className="tab-content"><p className="empty-state">Loading challenge…</p></div>
      )}

      {/* ── Delete challenge confirmation modal ───────────────────────────── */}
      {deleteConfirmId != null && (
        <div className="sc-delete-backdrop" onClick={() => setDeleteConfirmId(null)}>
          <div className="sc-delete-modal" onClick={e => e.stopPropagation()}>
            <h3 className="sc-delete-modal-title">Delete Challenge?</h3>
            <p className="sc-delete-modal-body">
              This will permanently delete the challenge and all its data for every player. This cannot be undone.
            </p>
            <div className="sc-delete-modal-actions">
              <button
                className="sc-delete-confirm-btn"
                onClick={() => handleDeleteChallenge(deleteConfirmId)}
                disabled={actionBusy}
              >
                {actionBusy ? 'Deleting…' : 'Delete'}
              </button>
              <button
                className="sc-delete-cancel-btn"
                onClick={() => { setDeleteConfirmId(null); setSwipedChallengeId(null); }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
