import React, { createContext, useContext, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import type { UseAuthReturn } from './hooks/useAuth';
import { useTheme } from './hooks/useTheme';
import type { UseThemeReturn } from './hooks/useTheme';
import { usePreferences } from './hooks/usePreferences';
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
import { PreferencesContext } from './contexts/PreferencesContext';
import { getPendingChallengeCount } from './services/api';
import './styles/tokens.css';
import './index.css';

const authContextDefault: UseAuthReturn = {
  user: null,
  loading: true,
  login: async () => { throw new Error('AuthContext not initialised'); },
  register: async () => { throw new Error('AuthContext not initialised'); },
  logout: () => {},
  updateDisplayName: () => {},
};

const themeContextDefault: UseThemeReturn = {
  theme: 'dark',
  setTheme: () => {},
  themes: ['dark', 'classic', 'modern'],
};

export const AuthContext  = createContext<UseAuthReturn>(authContextDefault);
export const ThemeContext = createContext<UseThemeReturn>(themeContextDefault);

// Re-export PreferencesContext from here for backwards compatibility
export { PreferencesContext };

function AppInner(): React.JSX.Element {
  const { user } = useContext(AuthContext);
  const prefsHook = usePreferences();
  const [challengeCount, setChallengeCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const poll = (): void => {
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
                    <Route path="/leaderboard"          element={<Leaderboard />} />
                    <Route path="/replay/:sessionUuid" element={<Replay />} />
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

export default function App(): React.JSX.Element {
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
