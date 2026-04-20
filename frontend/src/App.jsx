import React, { createContext, useContext, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useTheme } from './hooks/useTheme';
import { usePreferences } from './hooks/usePreferences';
import { Nav } from './components/Nav/Nav';
import { AuthGuard } from './components/AuthGuard/AuthGuard';
import { Home } from './screens/Home';
import { Game } from './screens/Game';
import { Daily } from './screens/Daily';
import { Friends } from './screens/Friends';
import { Profile } from './screens/Profile';
import { Settings } from './screens/Settings';
import { Login } from './screens/Login';
import { AcceptInvite } from './screens/AcceptInvite';
import { PreferencesContext } from './contexts/PreferencesContext';
import { getPendingChallengeCount } from './services/api';
import './styles/tokens.css';
import './index.css';

export const AuthContext  = createContext({ user: null, loading: true, login: () => {}, register: () => {}, logout: () => {}, updateDisplayName: () => {} });
export const ThemeContext = createContext({ theme: 'dark', setTheme: () => {} });

// Re-export PreferencesContext from here for backwards compatibility with Card.js
export { PreferencesContext };

function AppInner() {
  const { user } = useContext(AuthContext);
  const prefsHook = usePreferences();
  const [challengeCount, setChallengeCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const poll = () => {
      getPendingChallengeCount()
        .then(data => {
          if (!cancelled) setChallengeCount(data?.count ?? 0);
        })
        .catch(() => {}); // silently ignore auth/network errors
    };
    poll();
    const interval = setInterval(poll, 60000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [user]);

  return (
    <PreferencesContext.Provider value={prefsHook}>
      <Router>
        <Routes>
          {/* Public routes — no AuthGuard, no Nav */}
          <Route path="/login"          element={<Login />} />
          <Route path="/friends/accept" element={<AcceptInvite />} />

          {/* All other routes require auth */}
          <Route path="/*" element={
            <AuthGuard>
              <div className="app-shell">
                <main className="app-main">
                  <Routes>
                    <Route path="/"        element={<Home />}     />
                    <Route path="/game"    element={<Game />}     />
                    <Route path="/daily"   element={<Daily />}    />
                    <Route path="/friends" element={<Friends />}  />
                    <Route path="/profile" element={<Profile />}  />
                    <Route path="/settings" element={<Settings />} />
                  </Routes>
                </main>
                <Nav challengeBadge={challengeCount} />
              </div>
            </AuthGuard>
          } />
        </Routes>
      </Router>
    </PreferencesContext.Provider>
  );
}

export default function App() {
  const auth  = useAuth();
  const theme = useTheme();

  return (
    <AuthContext.Provider value={auth}>
      <ThemeContext.Provider value={theme}>
        <AppInner />
      </ThemeContext.Provider>
    </AuthContext.Provider>
  );
}
