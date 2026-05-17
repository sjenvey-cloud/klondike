import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { acceptPendingInvite } from './AcceptInvite';
import './Login.css';

type LoginTab = 'signin' | 'register';

export function Login(): React.JSX.Element {
  const { login, register } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { document.title = 'Sign In – Klondike Pro'; }, []);

  const [tab, setTab]           = useState<LoginTab>('signin');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [busy, setBusy]         = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (tab === 'signin') {
        await login(email, password);
      } else {
        await register(displayName, email, password);
      }
      // If user arrived via an invite link, accept it now then go to friends
      const hadPendingInvite = await acceptPendingInvite();
      navigate(hadPendingInvite ? '/friends' : '/');
    } catch (err) {
      setError((err as Error).message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const switchTab = (t: LoginTab): void => {
    setTab(t);
    setError('');
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <h1 className="login-heading">Klondike Pro</h1>
        <p className="login-subtitle">Classic solitaire, elevated.</p>

        <div className="login-tabs" role="tablist" aria-label="Account options">
          <button
            id="login-tab-signin"
            role="tab"
            aria-selected={tab === 'signin'}
            aria-controls="login-panel-signin"
            className={`login-tab${tab === 'signin' ? ' active' : ''}`}
            onClick={() => switchTab('signin')}
            type="button"
          >
            Sign In
          </button>
          <button
            id="login-tab-register"
            role="tab"
            aria-selected={tab === 'register'}
            aria-controls="login-panel-register"
            className={`login-tab${tab === 'register' ? ' active' : ''}`}
            onClick={() => switchTab('register')}
            type="button"
          >
            Create Account
          </button>
        </div>

        <div id={`login-panel-${tab}`} role="tabpanel" aria-labelledby={`login-tab-${tab}`}>
        <form className="login-form" onSubmit={handleSubmit}>
          {tab === 'register' && (
            <div className="login-field">
              <label className="login-label" htmlFor="displayName">Display Name</label>
              <input
                id="displayName"
                className="login-input"
                type="text"
                autoComplete="name"
                placeholder="Your name"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                required
                disabled={busy}
              />
            </div>
          )}

          <div className="login-field">
            <label className="login-label" htmlFor="email">Email</label>
            <input
              id="email"
              className="login-input"
              type="email"
              autoComplete="username"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              disabled={busy}
            />
          </div>

          <div className="login-field">
            <label className="login-label" htmlFor="password">Password</label>
            <input
              id="password"
              className="login-input"
              type="password"
              autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              disabled={busy}
            />
          </div>

          {error && <p role="alert" className="login-error">{error}</p>}

          <button className="login-submit" type="submit" disabled={busy}>
            {busy ? 'Please wait…' : tab === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
        </div>
      </div>
    </div>
  );
}
