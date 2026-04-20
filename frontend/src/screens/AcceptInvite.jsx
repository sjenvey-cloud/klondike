import React, { useContext, useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AuthContext } from '../App';
import { acceptFriendInvite, previewInvite } from '../services/api';
import './AcceptInvite.css';

export const PENDING_TOKEN_KEY = 'klondike_pending_invite';

export function getPendingInviteToken() {
  return sessionStorage.getItem(PENDING_TOKEN_KEY);
}

export function clearPendingInviteToken() {
  sessionStorage.removeItem(PENDING_TOKEN_KEY);
}

/**
 * Call this after login/register to auto-accept any pending invite stored
 * in sessionStorage. Returns true if an invite was found and attempted.
 */
export async function acceptPendingInvite() {
  const token = getPendingInviteToken();
  if (!token) return false;
  clearPendingInviteToken();
  try {
    await acceptFriendInvite(token);
  } catch {
    // ignore — invalid/expired invites are handled silently
  }
  return true;
}

export function AcceptInvite() {
  const { user, loading } = useContext(AuthContext);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  // idle → preview_loading → preview_ready → accepting → success | error
  const [status, setStatus]       = useState('idle');
  const [inviterName, setInviterName] = useState(null);
  const [errorMsg, setErrorMsg]   = useState('');

  // Always persist the token in sessionStorage so Login.jsx can pick it up
  // if the user is not logged in and needs to sign in first.
  useEffect(() => {
    if (token) sessionStorage.setItem(PENDING_TOKEN_KEY, token);
  }, [token]);

  // Once auth is resolved and the user is logged in, fetch a preview of
  // who sent the invite. We wait for loading=false to ensure accessToken
  // is set before the API call fires (fixes race with useAuth refresh).
  useEffect(() => {
    if (loading || !user || !token || status !== 'idle') return;
    setStatus('preview_loading');
    previewInvite(token)
      .then(data => {
        setInviterName(data.inviterDisplayName);
        setStatus('preview_ready');
      })
      .catch(err => {
        clearPendingInviteToken();
        const msg =
          err?.message === '422' ? 'This invite has already been used or has expired.' :
          err?.message === '404' ? 'Invite not found — it may have expired.' :
          'Something went wrong. Please try again.';
        setErrorMsg(msg);
        setStatus('error');
      });
  }, [loading, user, token, status]);

  const handleAccept = useCallback(() => {
    if (!token) return;
    setStatus('accepting');
    acceptFriendInvite(token)
      .then(() => {
        clearPendingInviteToken();
        setStatus('success');
        setTimeout(() => navigate('/friends'), 1500);
      })
      .catch(err => {
        clearPendingInviteToken();
        const msg =
          err?.message === '422' ? 'This invite has already been used or has expired.' :
          'Something went wrong. Please try again.';
        setErrorMsg(msg);
        setStatus('error');
      });
  }, [token, navigate]);

  const handleDecline = useCallback(() => {
    clearPendingInviteToken();
    navigate('/');
  }, [navigate]);

  // ── Render ──────────────────────────────────────────────────────────────

  if (!token) {
    return (
      <div className="accept-invite-screen">
        <div className="accept-invite-card">
          <p className="accept-invite-msg error">Invalid invite link.</p>
        </div>
      </div>
    );
  }

  // Auth still resolving, or fetching preview
  if (loading || status === 'preview_loading') {
    return (
      <div className="accept-invite-screen">
        <div className="accept-invite-card">
          <p className="accept-invite-msg">Loading…</p>
        </div>
      </div>
    );
  }

  // Not signed in — prompt to authenticate; token is in sessionStorage
  if (!user) {
    return (
      <div className="accept-invite-screen">
        <div className="accept-invite-card">
          <div className="accept-invite-icon">🤝</div>
          <h2 className="accept-invite-title">Friend Invite</h2>
          <p className="accept-invite-msg">
            Sign in or create an account to accept this friend invite.
          </p>
          <button className="accept-invite-btn" onClick={() => navigate('/login')}>
            Sign In / Create Account
          </button>
        </div>
      </div>
    );
  }

  // Preview ready — show who is inviting with explicit Accept / Decline
  if (status === 'preview_ready') {
    return (
      <div className="accept-invite-screen">
        <div className="accept-invite-card">
          <div className="accept-invite-icon">🤝</div>
          <h2 className="accept-invite-title">Friend Request</h2>
          <p className="accept-invite-msg">
            <strong>{inviterName}</strong> wants to add you as a friend.
          </p>
          <button className="accept-invite-btn" onClick={handleAccept}>
            Accept
          </button>
          <button
            className="accept-invite-btn accept-invite-btn--secondary"
            onClick={handleDecline}
          >
            Decline
          </button>
        </div>
      </div>
    );
  }

  if (status === 'accepting') {
    return (
      <div className="accept-invite-screen">
        <div className="accept-invite-card">
          <p className="accept-invite-msg">Accepting invite…</p>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="accept-invite-screen">
        <div className="accept-invite-card">
          <div className="accept-invite-icon">✅</div>
          <h2 className="accept-invite-title">Friend Added!</h2>
          <p className="accept-invite-msg">Taking you to your friends list…</p>
        </div>
      </div>
    );
  }

  // Error
  return (
    <div className="accept-invite-screen">
      <div className="accept-invite-card">
        <div className="accept-invite-icon">⚠️</div>
        <h2 className="accept-invite-title">Invite Error</h2>
        <p className="accept-invite-msg error">{errorMsg}</p>
        <button className="accept-invite-btn" onClick={() => navigate('/')}>
          Go to Home
        </button>
      </div>
    </div>
  );
}
