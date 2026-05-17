import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { acceptFriendInvite, previewInvite } from '../services/api';
import './AcceptInvite.css';

export const PENDING_TOKEN_KEY = 'klondike_pending_invite';

export function getPendingInviteToken(): string | null {
  return sessionStorage.getItem(PENDING_TOKEN_KEY);
}

export function clearPendingInviteToken(): void {
  sessionStorage.removeItem(PENDING_TOKEN_KEY);
}

export async function acceptPendingInvite(): Promise<boolean> {
  const token = getPendingInviteToken();
  if (!token) return false;
  clearPendingInviteToken();
  try {
    await acceptFriendInvite(token);
  } catch {
    // ignore
  }
  return true;
}

type InviteStatus = 'idle' | 'preview_loading' | 'preview_ready' | 'accepting' | 'success' | 'error';

export function AcceptInvite(): React.JSX.Element {
  const { user, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [status,      setStatus]      = useState<InviteStatus>('idle');
  const [inviterName, setInviterName] = useState<string | null>(null);
  const [errorMsg,    setErrorMsg]    = useState('');

  useEffect(() => {
    if (token) sessionStorage.setItem(PENDING_TOKEN_KEY, token);
  }, [token]);

  useEffect(() => {
    if (loading || !user || !token || status !== 'idle') return;
    setStatus('preview_loading');
    previewInvite(token)
      .then(data => {
        setInviterName(data.inviterDisplayName);
        setStatus('preview_ready');
      })
      .catch((err: Error) => {
        clearPendingInviteToken();
        const msg =
          err?.message === '422' ? 'This invite has already been used or has expired.' :
          err?.message === '404' ? 'Invite not found — it may have expired.' :
          'Something went wrong. Please try again.';
        setErrorMsg(msg);
        setStatus('error');
      });
  }, [loading, user, token, status]);

  const handleAccept = useCallback((): void => {
    if (!token) return;
    setStatus('accepting');
    acceptFriendInvite(token)
      .then(() => {
        clearPendingInviteToken();
        setStatus('success');
        setTimeout(() => navigate('/friends'), 1500);
      })
      .catch((err: Error) => {
        clearPendingInviteToken();
        const msg =
          err?.message === '422' ? 'This invite has already been used or has expired.' :
          'Something went wrong. Please try again.';
        setErrorMsg(msg);
        setStatus('error');
      });
  }, [token, navigate]);

  const handleDecline = useCallback((): void => {
    clearPendingInviteToken();
    navigate('/');
  }, [navigate]);

  if (!token) {
    return (
      <div className="accept-invite-screen">
        <div className="accept-invite-card">
          <p className="accept-invite-msg error">Invalid invite link.</p>
        </div>
      </div>
    );
  }

  if (loading || status === 'preview_loading') {
    return (
      <div className="accept-invite-screen">
        <div className="accept-invite-card">
          <p className="accept-invite-msg">Loading…</p>
        </div>
      </div>
    );
  }

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
