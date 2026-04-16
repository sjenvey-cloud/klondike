import React, { useContext, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AuthContext } from '../App';
import { acceptFriendInvite } from '../services/api';
import './AcceptInvite.css';

const PENDING_TOKEN_KEY = 'klondike_pending_invite';

export function AcceptInvite() {
  const { user } = useContext(AuthContext);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [status, setStatus] = useState('idle'); // idle | accepting | success | error
  const [errorMsg, setErrorMsg] = useState('');

  // Save token for after login/register
  useEffect(() => {
    if (token) sessionStorage.setItem(PENDING_TOKEN_KEY, token);
  }, [token]);

  // Auto-accept once user is logged in
  useEffect(() => {
    if (!user || !token || status !== 'idle') return;
    setStatus('accepting');
    acceptFriendInvite(token)
      .then(() => {
        sessionStorage.removeItem(PENDING_TOKEN_KEY);
        setStatus('success');
        setTimeout(() => navigate('/friends'), 2000);
      })
      .catch(err => {
        sessionStorage.removeItem(PENDING_TOKEN_KEY);
        const msg = err?.message === '422'
          ? 'This invite has already been used or has expired.'
          : err?.message === '404'
          ? 'Invite not found — it may have expired.'
          : 'Something went wrong. Please try again.';
        setErrorMsg(msg);
        setStatus('error');
      });
  }, [user, token, status, navigate]);

  if (!token) {
    return (
      <div className="accept-invite-screen">
        <div className="accept-invite-card">
          <p className="accept-invite-msg error">Invalid invite link.</p>
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
          <button
            className="accept-invite-btn"
            onClick={() => navigate('/login')}
          >
            Sign In / Create Account
          </button>
        </div>
      </div>
    );
  }

  if (status === 'accepting' || status === 'idle') {
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

/**
 * Call this after login/register to auto-accept any pending invite stored
 * in sessionStorage. Returns true if an invite was found and attempted.
 */
export async function acceptPendingInvite() {
  const token = sessionStorage.getItem(PENDING_TOKEN_KEY);
  if (!token) return false;
  sessionStorage.removeItem(PENDING_TOKEN_KEY);
  try {
    await acceptFriendInvite(token);
  } catch {
    // ignore — user will see error state if they revisit the link
  }
  return true;
}
