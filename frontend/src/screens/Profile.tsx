import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { usePreferences } from '../hooks/usePreferences';
import {
  patchProfile, getProfileHistory, getProfileStats, getProfileRecords,
  changePassword, deleteAccount, getMyProfile, requestAvatarUpload, confirmAvatarUpload,
} from '../services/api';
import { Calendar } from '../components/Calendar/Calendar';
import { DayDetail } from '../components/DayDetail/DayDetail';
import type { ProfileStatsResponse, ProfileRecordsResponse } from '../types/api';
import './Profile.css';

function formatTime(s: number | null | undefined): string {
  if (!s) return '—';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

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

type ProfileTab = 'stats' | 'calendar' | 'display' | 'user';
const VALID_TABS = new Set<string>(['stats', 'calendar', 'display', 'user']);

// HistoryEntry shape expected by <Calendar>
interface HistoryEntry {
  date: string;
  played: number;
  won: number;
}

export function Profile(): React.JSX.Element {
  const { user, logout, updateDisplayName } = useAuth();
  const { preferences, updatePreference }   = usePreferences();

  // Persist active tab in URL (?tab=calendar) so the browser back button
  // restores the correct tab when the user navigates away and returns.
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const tab    = (VALID_TABS.has(rawTab ?? '') ? rawTab : 'stats') as ProfileTab;
  const setTab = (t: ProfileTab): void => setSearchParams({ tab: t }, { replace: true });

  // Data
  const [nameInput, setNameInput] = useState('');
  const [history,       setHistory]       = useState<HistoryEntry[]>([]);
  const [selectedDay,   setSelectedDay]   = useState<string | null>(null);
  const [calYear,  setCalYear]  = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [stats,    setStats]    = useState<ProfileStatsResponse | null>(null);
  const [records,  setRecords]  = useState<ProfileRecordsResponse | null>(null);

  // Change password
  const [currentPw, setCurrentPw]   = useState('');
  const [newPw, setNewPw]           = useState('');
  const [confirmPw, setConfirmPw]   = useState('');
  const [pwError, setPwError]       = useState('');
  const [pwSuccess, setPwSuccess]   = useState('');
  const [pwLoading, setPwLoading]   = useState(false);

  useEffect(() => { document.title = 'Profile – Klondike Pro'; }, []);

  // Delete account
  const deleteModalRef = useRef<HTMLDivElement>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  useFocusTrap(showDeleteModal, deleteModalRef);
  const [deletePw, setDeletePw]               = useState('');
  const [deleteError, setDeleteError]         = useState('');
  const [deleteLoading, setDeleteLoading]     = useState(false);

  // Avatar (DEV-230)
  const [avatarUrl, setAvatarUrl]             = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError]         = useState('');
  const avatarInputRef                        = useRef<HTMLInputElement>(null);

  const fetchHistory = (y: number, m: number): void => {
    if (!user) return;
    const today      = new Date();
    const monthStart = new Date(y, m, 1);
    const diffDays   = Math.max(31, Math.ceil((today.getTime() - monthStart.getTime()) / 86400000) + 1);
    const tzOffset   = -new Date().getTimezoneOffset();
    getProfileHistory(user.id, diffDays, tzOffset).then(data => {
      setHistory(Array.isArray(data) ? data as HistoryEntry[] : []);
    }).catch(() => {});
  };

  useEffect(() => {
    if (user) {
      getMyProfile().then(p => { if (p?.avatarUrl) setAvatarUrl(p.avatarUrl ?? null); }).catch(() => {});
      fetchHistory(calYear, calMonth);
      getProfileStats().then(data => setStats(data as unknown as ProfileStatsResponse)).catch(() => {});
      getProfileRecords().then(data => setRecords(data as unknown as ProfileRecordsResponse)).catch(() => {});
      setNameInput(user.displayName);
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChangePassword = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
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
      setPwError((err as Error).message === '401' ? 'Current password is incorrect.' : 'Could not update password. Try again.');
    } finally {
      setPwLoading(false);
    }
  };

  const handleDeleteAccount = async (): Promise<void> => {
    if (!deletePw.trim()) return;
    setDeleteError('');
    setDeleteLoading(true);
    try {
      await deleteAccount(deletePw);
      logout();
    } catch (err) {
      setDeleteError((err as Error).message === '401' ? 'Incorrect password.' : 'Could not delete account. Try again.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleSaveName = async (): Promise<void> => {
    if (!nameInput.trim() || !user) return;
    await patchProfile(user.id, { displayName: nameInput.trim() });
    updateDisplayName(nameInput.trim());
  };

  const handleAvatarChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError('Image must be under 2 MB.');
      return;
    }
    setAvatarUploading(true);
    setAvatarError('');
    try {
      // Step 1: Request presigned URL from backend
      let uploadUrl: string;
      let publicUrl: string;
      try {
        ({ uploadUrl, publicUrl } = await requestAvatarUpload(file.type));
      } catch (err) {
        const code = err instanceof Error ? err.message : String(err);
        console.error('[Avatar] Step 1 (requestAvatarUpload) failed:', code);
        throw new Error(`step1:${code}`);
      }

      // Step 2: PUT file directly to S3 via presigned URL
      let s3Res: Response;
      try {
        s3Res = await fetch(uploadUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type },
        });
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        console.error('[Avatar] Step 2 (S3 PUT) network/CORS error:', detail);
        throw new Error(`step2-network:${detail}`);
      }
      if (!s3Res.ok) {
        console.error('[Avatar] Step 2 (S3 PUT) HTTP error:', s3Res.status);
        throw new Error(`step2-http:${s3Res.status}`);
      }

      // Step 3: Confirm URL on user account
      try {
        await confirmAvatarUpload(publicUrl);
      } catch (err) {
        const code = err instanceof Error ? err.message : String(err);
        console.error('[Avatar] Step 3 (confirmAvatarUpload) failed:', code);
        throw new Error(`step3:${code}`);
      }

      setAvatarUrl(publicUrl);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      if (msg.startsWith('step1:')) {
        const code = msg.slice(6);
        setAvatarError(
          code === '400' ? 'Image type not supported. Please use JPEG or PNG.' :
          code === '401' ? 'Session expired. Please sign in again.' :
          `Upload failed (preparing: ${code}). Please try again.`
        );
      } else if (msg.startsWith('step2-network:')) {
        setAvatarError('Upload failed: could not reach the image server. Please check your connection and try again.');
      } else if (msg.startsWith('step2-http:')) {
        const code = msg.slice(11);
        setAvatarError(
          code === '403' ? 'Upload rejected (permission denied). Please contact support.' :
          `Upload failed (image server error ${code}). Please try again.`
        );
      } else if (msg.startsWith('step3:')) {
        setAvatarError('Image uploaded but profile save failed. Please try again.');
      } else {
        setAvatarError('Upload failed. Please try again.');
      }
    } finally {
      setAvatarUploading(false);
      e.target.value = '';
    }
  }, []);

  if (!user) {
    return (
      <div className="screen profile-screen">
        <h2 className="section-title">Sign In</h2>
        <p className="login-note">Please sign in to view your profile.</p>
      </div>
    );
  }

  const initials = user.displayName
    ? user.displayName.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  const hasAnyStats = stats && (
    (stats.draw1 && stats.draw1.gamesPlayed > 0) ||
    (stats.draw3 && stats.draw3.gamesPlayed > 0)
  );

  return (
    <div className="screen profile-screen">
      <div className="profile-header">
        <button
          type="button"
          className={`profile-avatar${avatarUploading ? ' profile-avatar--uploading' : ''}`}
          onClick={() => !avatarUploading && avatarInputRef.current?.click()}
          aria-label="Change avatar"
          disabled={avatarUploading}
        >
          {avatarUrl
            ? <img src={avatarUrl} className="profile-avatar-img" alt={`${user.displayName} avatar`} onError={() => setAvatarUrl(null)} />
            : <span className="profile-avatar-initials" aria-hidden="true">{initials}</span>
          }
          <span className="profile-avatar-overlay" aria-hidden="true">
            {avatarUploading ? '…' : '📷'}
          </span>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/jpeg,image/png"
            style={{ display: 'none' }}
            onChange={handleAvatarChange}
          />
        </button>
        <h2 className="profile-header-name">{user.displayName}</h2>
        {avatarError && <p role="alert" className="profile-avatar-error">{avatarError}</p>}
      </div>

      {/* ── Tab bar ──────────────────────────────────────────────────── */}
      <div className="profile-tabs" role="tablist" aria-label="Profile sections">
        {(
          [
            { key: 'stats',    label: 'Stats'    },
            { key: 'calendar', label: 'Calendar' },
            { key: 'display',  label: 'Display'  },
            { key: 'user',     label: 'Account'  },
          ] as { key: ProfileTab; label: string }[]
        ).map(t => (
          <button
            key={t.key}
            id={`profile-tab-${t.key}`}
            role="tab"
            aria-selected={tab === t.key}
            aria-controls={`profile-panel-${t.key}`}
            className={`profile-tab${tab === t.key ? ' profile-tab--active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Stats tab ────────────────────────────────────────────────── */}
      {tab === 'stats' && (
        <div id="profile-panel-stats" role="tabpanel" aria-labelledby="profile-tab-stats">
          {stats && (
            <div className="profile-section">
              <h3 className="profile-section-title">Stats</h3>
              {(['draw1', 'draw3'] as const).map(mode => {
                const s = stats[mode];
                if (!s || s.gamesPlayed === 0) return null;
                return (
                  <div key={mode} className="stats-mode-block">
                    <p className="stats-mode-label">{mode === 'draw1' ? 'Draw 1' : 'Draw 3'}</p>
                    <div className="stats-grid">
                      {(
                        [
                          ['Played',    s.gamesPlayed],
                          ['Won',       s.wins],
                          ['Win Rate',  `${Math.round(s.winRate * 100)}%`],
                          ['Avg Moves', s.avgMoves  ? Math.round(s.avgMoves)  : '—'],
                          ['Avg Time',  s.avgTimeSeconds ? formatTime(Math.round(s.avgTimeSeconds)) : '—'],
                        ] as [string, string | number][]
                      ).map(([label, value]) => (
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

          {!hasAnyStats && !records && (
            <p className="profile-empty">Play some games to see your stats here.</p>
          )}
        </div>
      )}

      {/* ── Calendar tab ─────────────────────────────────────────────── */}
      {tab === 'calendar' && (
        <div id="profile-panel-calendar" role="tabpanel" aria-labelledby="profile-tab-calendar" className="profile-section">
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
      )}

      {/* ── Display tab ──────────────────────────────────────────────── */}
      {tab === 'display' && (
        <div id="profile-panel-display" role="tabpanel" aria-labelledby="profile-tab-display">
          <div className="profile-section">
            <h3 className="profile-section-title">Card Style</h3>
            <div className="app-card-style-grid">
              {CARD_STYLES.map(s => {
                const active = preferences?.cardStyle === s.key;
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
                const active = preferences?.feltColour === b.value;
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
            <h3 className="profile-section-title">Draw Pile Location</h3>
            <div className="stock-side-row">
              <button
                className={`stock-side-btn${(preferences?.stockSide || 'left') === 'left' ? ' stock-side-btn--active' : ''}`}
                onClick={() => updatePreference('stockSide', 'left')}
              >
                <span className="stock-side-icon">⬅</span> Left
              </button>
              <button
                className={`stock-side-btn${preferences?.stockSide === 'right' ? ' stock-side-btn--active' : ''}`}
                onClick={() => updatePreference('stockSide', 'right')}
              >
                Right <span className="stock-side-icon">➡</span>
              </button>
            </div>
          </div>

          <div className="profile-section">
            <h3 className="profile-section-title">Animation Speed</h3>
            <div className="stock-side-row">
              {(
                [
                  { key: 'slow',   label: 'Slow' },
                  { key: 'normal', label: 'Normal' },
                  { key: 'fast',   label: 'Fast' },
                ] as { key: 'slow' | 'normal' | 'fast'; label: string }[]
              ).map(({ key, label }) => (
                <button
                  key={key}
                  className={`stock-side-btn${(preferences?.animationSpeed || 'normal') === key ? ' stock-side-btn--active' : ''}`}
                  onClick={() => updatePreference('animationSpeed', key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="profile-section">
            <h3 className="profile-section-title">Win Celebration</h3>
            <div className="stock-side-row">
              <button
                className={`stock-side-btn${(preferences?.winAnimation || 'confetti') === 'confetti' ? ' stock-side-btn--active' : ''}`}
                onClick={() => updatePreference('winAnimation', 'confetti')}
              >
                🎉 Confetti
              </button>
              <button
                className={`stock-side-btn${preferences?.winAnimation === 'simple' ? ' stock-side-btn--active' : ''}`}
                onClick={() => updatePreference('winAnimation', 'simple')}
              >
                Simple
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Account tab ──────────────────────────────────────────────── */}
      {tab === 'user' && (
        <div id="profile-panel-user" role="tabpanel" aria-labelledby="profile-tab-user">
          <div className="profile-section">
            <h3 className="profile-section-title">Display Name</h3>
            <div className="name-row">
              <input
                className="text-input"
                aria-label="Display name"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
              />
              <button className="btn-primary" onClick={handleSaveName}>Save</button>
            </div>
          </div>

          <div className="profile-section">
            <h3 className="profile-section-title">Change Password</h3>
            <form className="login-form" onSubmit={handleChangePassword}>
              <input
                className="text-input"
                type="password"
                aria-label="Current password"
                placeholder="Current password"
                value={currentPw}
                onChange={e => setCurrentPw(e.target.value)}
                autoComplete="current-password"
              />
              <input
                className="text-input"
                type="password"
                aria-label="New password"
                placeholder="New password"
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                autoComplete="new-password"
              />
              <input
                className="text-input"
                type="password"
                aria-label="Confirm new password"
                placeholder="Confirm new password"
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                autoComplete="new-password"
              />
              {pwError   && <p role="alert" className="error-text">{pwError}</p>}
              {pwSuccess && <p role="status" className="success-text">{pwSuccess}</p>}
              <button className="btn-primary" type="submit" disabled={pwLoading}>
                {pwLoading ? 'Saving…' : 'Update Password'}
              </button>
            </form>
          </div>

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
        </div>
      )}

      {/* ── Delete Account Modal ─────────────────────────────────────── */}
      {showDeleteModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowDeleteModal(false)}
          onKeyDown={(e) => { if (e.key === 'Escape') setShowDeleteModal(false); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
            className="modal-box"
            ref={deleteModalRef}
            onClick={e => e.stopPropagation()}
            onKeyDown={(e) => { if (e.key === 'Escape') setShowDeleteModal(false); }}
          >
            <h3 id="delete-modal-title" className="modal-title">Delete Account</h3>
            <p className="modal-body">
              This will permanently delete your account, all game history, stats, and settings.
              There is no way to recover your data after this.
            </p>
            <input
              className="text-input"
              type="password"
              aria-label="Password confirmation"
              placeholder="Enter your password to confirm"
              value={deletePw}
              onChange={e => setDeletePw(e.target.value)}
              autoComplete="current-password"
            />
            {deleteError && <p role="alert" className="error-text">{deleteError}</p>}
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
