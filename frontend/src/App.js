import React, { createContext, useContext, useEffect, useState } from 'react';
import { BrowserRouter as Router, Switch, Route } from 'react-router-dom';
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
import { PreferencesContext } from './contexts/PreferencesContext';
import { getChallengeInbox } from './services/api';
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
    const fetch = () => {
      getChallengeInbox(user.id)
        .then(data => {
          if (!cancelled) {
            const count = Array.isArray(data) ? data.length : (data?.count ?? 0);
            setChallengeCount(count);
          }
        })
        .catch(() => {});
    };
    fetch();
    const interval = setInterval(fetch, 60000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [user]);

  return (
    <PreferencesContext.Provider value={prefsHook}>
      <Router>
        <Switch>
          {/* Public route — no AuthGuard, no Nav */}
          <Route path="/login" component={Login} />

          {/* All other routes require auth */}
          <Route>
            <AuthGuard>
              <div className="app-shell">
                <main className="app-main">
                  <Switch>
                    <Route exact path="/"        component={Home}     />
                    <Route       path="/game"     component={Game}     />
                    <Route       path="/daily"    component={Daily}    />
                    <Route       path="/friends"  component={Friends}  />
                    <Route       path="/profile"  component={Profile}  />
                    <Route       path="/settings" component={Settings} />
                  </Switch>
                </main>
                <Nav challengeBadge={challengeCount} />
              </div>
            </AuthGuard>
          </Route>
        </Switch>
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
