import React, { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../App';
import { PreferencesContext } from '../contexts/PreferencesContext';
import { getProfile, patchProfile, getProfileHistory, getProfileStats, getProfileRecords, changePassword, deleteAccount } from '../services/api';
import { Calendar } from '../components/Calendar/Calendar';
import { DayDetail } from '../components/DayDetail/DayDetail';
import './Profile.css';

function formatTime(s) {
  if (!s) return '—';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export function Profile() {
  const { user, login, logout, updateDisplayName } = useContext(AuthContext);
  const { preferences, updatePreference } = useContext(PreferencesContext);
  const [profile, setProfile] = useState(null);
  const [nameInput, setNameInput] = useState('');
  const [loginName, setLoginName] = useState('');
  const [loginError, setLoginError] = useState('');
  const [history, setHistory] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const [calYear,  setCalYear]  = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [stats, setStats] = useState(null);
  const [records, setRecords] = useState(null);

  // Change password
  const [currentPw, setCurrentPw]   = useState('');
  const [newPw, setNewPw]           = useState('');
  const [confirmPw, setConfirmPw]   = useState('');
  const [pwError, setPwError]       = useState('');
  const [pwSuccess, setPwSuccess]   = useState('');
  const [pwLoading, setPwLoading]   = useState(false);

  // Delete account
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePw, setDeletePw]               = useState('');
  const [deleteError, setDeleteError]         = useState('');
  const [deleteLoading, setDeleteLoading]     = useState(false);

  // Fetch history whenever the calendar month changes
  const fetchHistory = (y, m) => {
    if (!user) return;
    const today = new Date();
    const monthStart = new Date(y, m, 1);
    // Days from start of viewed month to today (minimum 31 to cover the full month)
    const diffDays = Math.max(31, Math.ceil((today - monthStart) / 86400000) + 1);
    const tzOffset = -new Date().getTimezoneOffset();
    getProfileHistory(user.id, diffDays, tzOffset).then(data => {
      setHistory(Array.isArray(data) ? data : []);
    }).catch(() => {});
  };

  useEffect(() => {
    if (user) {
      getProfile(user.id).then(setProfile).catch(() => {});
      fetchHistory(calYear, calMonth);
      getProfileStats().then(setStats).catch(() => {});
      getProfileRecords().then(setRecords).catch(() => {});
      setNameInput(user.displayName);
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const CARD_STYLES = [
    { key: 'classic', label: 'Classic', desc: 'Traditional pip cards',  previewImg: '/cards/A_H.png',           comingSoon: false },
    { key: 'modern',  label: 'Modern',  desc: 'Illustrated style',      previewImg: '/cards/modern/A_H.png',    comingSoon: false },
    { key: 'fantasy', label: 'Fantasy', desc: 'Ornamental style',       previewImg: '/cards/fantasy/A_H.png',   comingSoon: false },
  ];

  const BAIZE_COLOURS = [
    { key: 'green', label: 'Green', value: '#2d6a4f' },
    { key: 'blue',  label: 'Blue',  value: '#1a3a5c' },
    { key: 'gray',  label: 'Gray',  value: '#3d3d4a' },
  ];

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginName.trim()) return;
    setLoginError('');
    try {
      await login(loginName.trim());
    } catch {
      setLoginError('Could not sign in. Try again.');
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');
    if (newPw !== confirmPw) { setPwError('New passwords do not match.'); return; }
    if (newPw.length < 8)    { setPwError('New password must be at least 8 characters.'); return; }
    setPwLoading(true);
    try {
      await changePassword(currentPw, newPw);
      setPwSuccess('Password updated.');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (err) {
      setPwError(err.message === '401' ? 'Current password is incorrect.' : 'Could not update password. Try again.');
    } finally {
      setPwLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePw.trim()) return;
    setDeleteError('');
    setDeleteLoading(true);
    try {
      await deleteAccount(deletePw);
      logout();
    } catch (err) {
      setDeleteError(err.message === '401' ? 'Incorrect password.' : 'Could not delete account. Try again.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleSaveName = async () => {
    if (!nameInput.trim() || !user) return;
    await patchProfile(user.id, { displayName: nameInput.trim() });
    updateDisplayName(nameInput.trim());
  };

  if (!user) {
    return (
      <div className="screen profile-screen">
        <h2 className="section-title">Sign In</h2>
        <form className="login-form" onSubmit={handleLogin}>
          <input
            className="text-input"
            placeholder="Display name"
            value={loginName}
            onChange={e => setLoginName(e.target.value)}
          />
          <button className="btn-primary" type="submit">Continue</button>
          {loginError && <p className="error-text">{loginError}</p>}
        </form>
        <p className="login-note">
          Enter any name to create an account or sign into an existing one.
        </p>
      </div>
    );
  }

  return (
    <div className="screen profile-screen">
      <h2 className="section-title">{user.displayName}</h2>

      {stats && (
        <div className="profile-section">
          <h3 className="profile-section-title">Stats</h3>
          {['draw1', 'draw3'].map(mode => {
            const s = stats[mode];
            if (!s || s.gamesPlayed === 0) return null;
            return (
              <div key={mode} className="stats-mode-block">
                <p className="stats-mode-label">{mode === 'draw1' ? 'Draw 1' : 'Draw 3'}</p>
                <div className="stats-grid">
                  {[
                    ['Played',    s.gamesPlayed],
                    ['Won',       s.wins],
                    ['Win Rate',  `${Math.round(s.winRate * 100)}%`],
                    ['Avg Moves', s.avgMoves  ? Math.round(s.avgMoves)  : '—'],
                    ['Avg Time',  s.avgTimeSeconds ? formatTime(Math.round(s.avgTimeSeconds)) : '—'],
                  ].map(([label, value]) => (
                    <div key={label} className="stat-card">
                      <span className="stat-card-value">{value}</span>
                      <span className="stat-card-label">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="profile-section">
        <h3 className="profile-section-title">Activity</h3>
        <Calendar
          history={history}
          onDayClick={setSelectedDay}
          onMonthChange={(y, m) => {
            setCalYear(y);
            setCalMonth(m);
            fetchHistory(y, m);
          }}
        />
      </div>

      {records && (records.fewestMoves || records.fastestTime) && (
        <div className="profile-section">
          <h3 className="profile-section-title">Personal Bests</h3>
          <div className="records-grid">
            {records.fewestMoves && (
              <div className="record-card">
                <span className="record-card-value">{records.fewestMoves.moves}</span>
                <span className="record-card-label">Fewest Moves</span>
                <span className="record-card-meta">
                  {records.fewestMoves.drawMode === 'draw1' ? 'Draw 1' : 'Draw 3'} ·{' '}
                  {formatTime(records.fewestMoves.timeSeconds)}
                </span>
              </div>
            )}
            {records.fastestTime && (
              <div className="record-card">
                <span className="record-card-value">{formatTime(records.fastestTime.timeSeconds)}</span>
                <span className="record-card-label">Fastest Time</span>
                <span className="record-card-meta">
                  {records.fastestTime.drawMode === 'draw1' ? 'Draw 1' : 'Draw 3'} ·{' '}
                  {records.fastestTime.moves} moves
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Appearance ─────────────────────────────────────────────────── */}
      <div className="profile-section">
        <h3 className="profile-section-title">Card Style</h3>
        <div className="app-card-style-grid">
          {CARD_STYLES.map(s => {
            const active = preferences.cardStyle === s.key;
            return (
              <button
                key={s.key}
                className={`app-style-btn${active ? ' app-style-btn--active' : ''}${s.comingSoon ? ' app-style-btn--disabled' : ''}`}
                onClick={() => !s.comingSoon && updatePreference('cardStyle', s.key)}
              >
                <div className="app-style-preview-wrap">
                  <img
                    className={`app-style-preview app-style-preview--img${s.comingSoon ? ' app-style-preview--dim' : ''}`}
                    src={s.previewImg}
                    alt={`${s.label} card preview`}
                    draggable={false}
                  />
                  {s.comingSoon && <span className="app-style-coming-soon">Soon</span>}
                </div>
                <span className="app-style-label">{s.label}</span>
                <span className="app-style-desc">{s.desc}</span>
                {active && <span className="app-style-check">✓</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="profile-section">
        <h3 className="profile-section-title">Table Colour</h3>
        <div className="app-baize-row">
          {BAIZE_COLOURS.map(b => {
            const active = preferences.feltColour === b.value;
            return (
              <button
                key={b.key}
                className={`app-baize-btn${active ? ' app-baize-btn--active' : ''}`}
                style={{ background: b.value }}
                onClick={() => updatePreference('feltColour', b.value)}
                aria-label={`${b.label} baize`}
              >
                <span className="app-baize-label">{b.label}</span>
                {active && <span className="app-baize-check">✓</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="profile-section">
        <h3 className="profile-section-title">Display Name</h3>
        <div className="name-row">
          <input
            className="text-input"
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
          />
          <button className="btn-primary" onClick={handleSaveName}>Save</button>
        </div>
      </div>

      {/* ── Change Password ─────────────────────────────────────────── */}
      <div className="profile-section">
        <h3 className="profile-section-title">Change Password</h3>
        <form className="login-form" onSubmit={handleChangePassword}>
          <input
            className="text-input"
            type="password"
            placeholder="Current password"
            value={currentPw}
            onChange={e => setCurrentPw(e.target.value)}
            autoComplete="current-password"
          />
          <input
            className="text-input"
            type="password"
            placeholder="New password"
            value={newPw}
            onChange={e => setNewPw(e.target.value)}
            autoComplete="new-password"
          />
          <input
            className="text-input"
            type="password"
            placeholder="Confirm new password"
            value={confirmPw}
            onChange={e => setConfirmPw(e.target.value)}
            autoComplete="new-password"
          />
          {pwError   && <p className="error-text">{pwError}</p>}
          {pwSuccess && <p className="success-text">{pwSuccess}</p>}
          <button className="btn-primary" type="submit" disabled={pwLoading}>
            {pwLoading ? 'Saving…' : 'Update Password'}
          </button>
        </form>
      </div>

      {/* ── Danger Zone ─────────────────────────────────────────────── */}
      <div className="profile-section profile-section--danger">
        <h3 className="profile-section-title">Danger Zone</h3>
        <p className="danger-desc">
          Permanently delete your account and all game data. This cannot be undone.
        </p>
        <button className="btn-danger" onClick={() => { setDeleteError(''); setDeletePw(''); setShowDeleteModal(true); }}>
          Delete Account
        </button>
      </div>

      <div className="profile-section profile-section--signout">
        <button className="btn-signout" onClick={logout}>Sign Out</button>
      </div>

      {/* ── Delete Account Modal ─────────────────────────────────────── */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">Delete Account</h3>
            <p className="modal-body">
              This will permanently delete your account, all game history, stats, and settings.
              There is no way to recover your data after this.
            </p>
            <input
              className="text-input"
              type="password"
              placeholder="Enter your password to confirm"
              value={deletePw}
              onChange={e => setDeletePw(e.target.value)}
              autoComplete="current-password"
            />
            {deleteError && <p className="error-text">{deleteError}</p>}
            <div className="modal-actions">
              <button className="btn-modal-cancel" onClick={() => setShowDeleteModal(false)}>
                Cancel
              </button>
              <button
                className="btn-danger"
                onClick={handleDeleteAccount}
                disabled={deleteLoading || !deletePw.trim()}
              >
                {deleteLoading ? 'Deleting…' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedDay && (
        <DayDetail
          date={selectedDay}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </div>
  );
}
