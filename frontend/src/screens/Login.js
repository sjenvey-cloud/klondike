import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../App';
import './Login.css';

export function Login() {
  const { login, register } = useContext(AuthContext);
  const navigate = useNavigate();

  const [tab, setTab]           = useState('signin'); // 'signin' | 'register'
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [busy, setBusy]         = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (tab === 'signin') {
        await login(email, password);
      } else {
        await register(displayName, email, password);
      }
      navigate('/');
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const switchTab = (t) => {
    setTab(t);
    setError('');
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <h1 className="login-heading">Klondike Pro</h1>
        <p className="login-subtitle">Classic solitaire, elevated.</p>

        <div className="login-tabs">
          <button
            className={`login-tab${tab === 'signin' ? ' active' : ''}`}
            onClick={() => switchTab('signin')}
            type="button"
          >
            Sign In
          </button>
          <button
            className={`login-tab${tab === 'register' ? ' active' : ''}`}
            onClick={() => switchTab('register')}
            type="button"
          >
            Create Account
          </button>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          {tab === 'register' && (
            <div className="login-field">
              <label className="login-label" htmlFor="displayName">Display Name</label>
              <input
                id="displayName"
                className="login-input"
                type="text"
                autoComplete="username"
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
              autoComplete="email"
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

          {error && <p className="login-error">{error}</p>}

          <button className="login-submit" type="submit" disabled={busy}>
            {busy ? 'Please wait…' : tab === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
