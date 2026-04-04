import React, { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../App';
import { PreferencesContext } from '../contexts/PreferencesContext';
import { getProfile, patchProfile, getProfileHistory } from '../services/api';
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
  const { user, login, updateDisplayName } = useContext(AuthContext);
  const { preferences } = useContext(PreferencesContext);
  const [profile, setProfile] = useState(null);
  const [nameInput, setNameInput] = useState('');
  const [loginName, setLoginName] = useState('');
  const [loginError, setLoginError] = useState('');
  const [history, setHistory] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);

  useEffect(() => {
    if (user) {
      getProfile(user.id).then(setProfile).catch(() => {});
      getProfileHistory(user.id, 35).then(data => {
        setHistory(Array.isArray(data) ? data : []);
      }).catch(() => {});
      setNameInput(user.displayName);
    }
  }, [user]);

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

      {profile && (
        <>
          <div className="stats-grid">
            {[
              ['Games Played', profile.gamesPlayed ?? 0],
              ['Games Won',   profile.gamesWon   ?? 0],
              ['Win Rate',    profile.gamesPlayed ? `${Math.round((profile.gamesWon / profile.gamesPlayed) * 100)}%` : '0%'],
              ['Draw Mode',   preferences?.drawModeDefault === 'draw1' ? 'Draw 1' : 'Draw 3'],
              ['Best Moves',  profile.bestMoves   ?? '—'],
              ['Best Time',   formatTime(profile.bestTimeSeconds)],
              ['Avg Moves',   profile.avgMoves    ? Math.round(profile.avgMoves) : '—'],
              ['Streak',      profile.currentStreak ?? 0],
              ['Best Streak', profile.bestStreak    ?? 0],
            ].map(([label, value]) => (
              <div key={label} className="stat-card">
                <span className="stat-card-value">{value}</span>
                <span className="stat-card-label">{label}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="profile-section">
        <h3 className="profile-section-title">Activity</h3>
        <Calendar history={history} onDayClick={setSelectedDay} />
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

      {selectedDay && (
        <DayDetail
          date={selectedDay}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </div>
  );
}
