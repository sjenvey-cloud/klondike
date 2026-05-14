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
 *
 * The app-level resume modal surfaces active sessions when the user is browsing
 * screens OTHER than the relevant game screen. /game and /daily manage their
 * own resume prompts inside Game.jsx — showing the modal there too would cause
 * a double-prompt on page refresh.
 *
 * Dismissing one session does not affect the other.
 */
function ActiveSessionHandler({ dailySession, randomSession, onDismissDaily, onDismissRandom }) {
  const navigate     = useNavigate();
  const { pathname } = useLocation();

  const isOnDaily = pathname === '/daily';
  const isOnGame  = pathname === '/game';

  // Never show on the game screens — they own their resume UX.
  if (isOnDaily || isOnGame) return null;

  // Prefer the daily session when both are active; fall back to random.
  const session = dailySession ?? randomSession;
  if (!session) return null;

  const isDaily   = session === dailySession;
  const onDismiss = isDaily ? onDismissDaily : onDismissRandom;

  const handleResume = () => {
    onDismiss();
    if (isDaily) {
      // Daily screen will auto-resume from sessionStorage (or start fresh if cleared).
      navigate('/daily');
    } else {
      navigate('/game', {
        state: {
          resumeSessionId: session.uuid,
          resumeHandId:    session.handUuid,
          resumeDrawMode:  session.drawMode,
        },
      });
    }
  };

  const handleStartNew = () => {
    // Clear sessionStorage for this game type so Game.jsx won't surface another
    // resume prompt if the user subsequently navigates to the game screen.
    sessionStorage.removeItem(isDaily ? 'klondike_daily_session' : 'klondike_session');
    onDismiss();
  };

  return (
    <ResumeModal
      session={session}
      onResume={handleResume}
      onStartNew={handleStartNew}
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

  // DEV-203: daily and random active sessions tracked separately so each
  // screen can show its own resume prompt independently.
  const [dailySession,  setDailySession]  = useState(null);
  const [randomSession, setRandomSession] = useState(null);

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

  // DEV-203: check for active (in-progress) sessions on login.
  // Server returns { daily, random } — both nullable.
  useEffect(() => {
    if (!user) {
      setDailySession(null);
      setRandomSession(null);
      return;
    }
    getActiveSession()
      .then(data => {
        if (!data) return;
        setDailySession(data.daily   ?? null);
        setRandomSession(data.random ?? null);
      })
      .catch(() => {}); // silently ignore — no modal is fine
  }, [user]);

  return (
    <PreferencesContext.Provider value={prefsHook}>
      <Router>
        <ActiveSessionHandler
          dailySession={dailySession}
          randomSession={randomSession}
          onDismissDaily={() => setDailySession(null)}
          onDismissRandom={() => setRandomSession(null)}
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
