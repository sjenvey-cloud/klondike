import React, { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../App';
import { PreferencesContext } from '../contexts/PreferencesContext';
import { getProfile, patchProfile, getProfileHistory, getProfileStats, getProfileRecords } from '../services/api';
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
  const { preferences } = useContext(PreferencesContext);
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

      <div className="profile-section profile-section--signout">
        <button className="btn-signout" onClick={logout}>Sign Out</button>
      </div>

      {selectedDay && (
        <DayDetail
          date={selectedDay}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </div>
  );
}
