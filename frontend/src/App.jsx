import React, { createContext, useContext, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
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
import { Leaderboard } from './screens/Leaderboard';
import { Replay }      from './screens/Replay';
import { Login } from './screens/Login';
import { AcceptInvite } from './screens/AcceptInvite';
import { PreferencesContext } from './contexts/PreferencesContext';
import { ResumeModal } from './components/ResumeModal/ResumeModal';
import { getPendingChallengeCount, getActiveSession } from './services/api';
import './styles/tokens.css';
import './index.css';

export const AuthContext  = createContext({ user: null, loading: true, login: () => {}, register: () => {}, logout: () => {}, updateDisplayName: () => {} });
export const ThemeContext = createContext({ theme: 'dark', setTheme: () => {} });

/**
 * DEV-203: Rendered inside <Router> so it can call useNavigate / useLocation.
 * Shows the ResumeModal only when the user is on the screen that matches the
 * active session type:
 *   - non-daily session + /game  route → "Resume" / "Start New"
 *   - daily session    + /daily route → "Resume" / "Redeal"
 * All other routes suppress the modal so it doesn't interrupt unrelated screens.
 */
function ActiveSessionHandler({ activeSession, onDismiss }) {
  const navigate  = useNavigate();
  const { pathname } = useLocation();

  if (!activeSession) return null;

  const isDaily       = !!activeSession.isDaily;
  const expectedRoute = isDaily ? '/daily' : '/game';

  // Only interrupt the user when they are on the relevant screen.
  if (pathname !== expectedRoute) return null;

  const handleResume = () => {
    onDismiss();
    navigate('/game', {
      state: {
        resumeSessionId: activeSession.uuid,
        resumeHandId:    activeSession.handUuid,
        resumeDrawMode:  activeSession.drawMode,
      },
    });
  };

  return (
    <ResumeModal
      session={activeSession}
      onResume={handleResume}
      onStartNew={onDismiss}
      isDaily={isDaily}
    />
  );
}

// Re-export PreferencesContext from here for backwards compatibility with Card.js
export { PreferencesContext };

function AppInner() {
  const { user } = useContext(AuthContext);
  const prefsHook = usePreferences();
  const [challengeCount, setChallengeCount] = useState(0);
  // DEV-203: active session resume modal
  const [activeSession, setActiveSession] = useState(null);

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

  // DEV-203: check for an active (in-progress) session on login
  useEffect(() => {
    if (!user) { setActiveSession(null); return; }
    getActiveSession()
      .then(session => { if (session) setActiveSession(session); })
      .catch(() => {}); // silently ignore — no modal is fine
  }, [user]);

  return (
    <PreferencesContext.Provider value={prefsHook}>
      <Router>
        <ActiveSessionHandler
          activeSession={activeSession}
          onDismiss={() => setActiveSession(null)}
        />
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
