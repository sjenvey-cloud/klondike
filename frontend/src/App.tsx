import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { Nav } from './components/Nav/Nav';
import { AuthGuard } from './components/AuthGuard/AuthGuard';
import { Home } from './screens/Home';
import { Game } from './screens/Game';
import { Daily } from './screens/Daily';
import { Friends } from './screens/Friends';
import { Profile } from './screens/Profile';
import { Settings } from './screens/Settings';
import { Leaderboard } from './screens/Leaderboard';
import { Replay }      from './screens/Replay';
import { Login } from './screens/Login';
import { AcceptInvite } from './screens/AcceptInvite';
import { getPendingChallengeCount, getSocialBadge, updateLocation } from './services/api';
import { flushPendingWin } from './hooks/useGame';

/** Best-effort device region (country) for the Connect Requests list. */
function deviceRegion(): string | null {
  try {
    const region = new Intl.Locale(navigator.language).region;
    if (!region) return null;
    const dn = new Intl.DisplayNames([navigator.language], { type: 'region' });
    return dn.of(region) ?? region;
  } catch {
    return null;
  }
}

// Ensure stores are initialised (side-effects: token refresh, prefs load, theme apply)
import './stores/authStore';
import './stores/preferencesStore';
import './stores/themeStore';

import './styles/tokens.css';
import './index.css';

export default function App(): React.JSX.Element {
  const { user } = useAuth();
  const [challengeCount, setChallengeCount] = useState(0);
  const [connectCount, setConnectCount]     = useState(0);

  // Re-submit any win that failed to reach the server (e.g. connection dropped
  // exactly at the win moment).  Runs on auth and again whenever the browser
  // reports that connectivity has been restored.
  useEffect(() => {
    if (!user) return;
    flushPendingWin().catch(() => {});
    const onOnline = (): void => { flushPendingWin().catch(() => {}); };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [user]);

  // Report device region once per login (for the Connect Requests list).
  useEffect(() => {
    if (!user) return;
    const region = deviceRegion();
    if (region) updateLocation(region).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const poll = (): void => {
      getPendingChallengeCount()
        .then(data => { if (!cancelled) setChallengeCount(data?.count ?? 0); })
        .catch(() => {});
      getSocialBadge()
        .then(data => { if (!cancelled) setConnectCount(data?.total ?? 0); })
        .catch(() => {});
    };
    poll();
    const interval = setInterval(poll, 60000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [user]);

  return (
    <Router>
      <Routes>
        {/* Public routes — no AuthGuard, no Nav */}
        <Route path="/login"          element={<Login />} />
        <Route path="/friends/accept" element={<AcceptInvite />} />

        {/* All other routes require auth */}
        <Route path="/*" element={
          <AuthGuard>
            <div className="app-shell">
              <a href="#main-content" className="skip-link">Skip to main content</a>
              <main id="main-content" className="app-main">
                <Routes>
                  <Route path="/"        element={<Home />}     />
                  <Route path="/game"    element={<Game />}     />
                  <Route path="/daily"   element={<Daily />}    />
                  <Route path="/friends" element={<Friends />}  />
                  <Route path="/profile" element={<Profile />}  />
                  <Route path="/leaderboard"          element={<Leaderboard />} />
                  <Route path="/replay/:sessionUuid" element={<Replay />} />
                  <Route path="/settings" element={<Settings />} />
                </Routes>
              </main>
              <Nav challengeBadge={challengeCount + connectCount} />
            </div>
          </AuthGuard>
        } />
      </Routes>
    </Router>
  );
}
