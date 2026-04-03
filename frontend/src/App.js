import React, { createContext } from 'react';
import { BrowserRouter as Router, Switch, Route } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useTheme } from './hooks/useTheme';
import { Nav } from './components/Nav/Nav';
import { Home } from './screens/Home';
import { Game } from './screens/Game';
import { Daily } from './screens/Daily';
import { Friends } from './screens/Friends';
import { Profile } from './screens/Profile';
import { Settings } from './screens/Settings';
import './styles/tokens.css';
import './index.css';

export const AuthContext  = createContext({ user: null, login: () => {}, logout: () => {}, updateDisplayName: () => {} });
export const ThemeContext = createContext({ theme: 'dark', setTheme: () => {} });

export default function App() {
  const auth  = useAuth();
  const theme = useTheme();

  return (
    <AuthContext.Provider value={auth}>
      <ThemeContext.Provider value={theme}>
        <Router>
          <div className="app-shell">
            <main className="app-main">
              <Switch>
                <Route exact path="/"         component={Home}     />
                <Route       path="/game"      component={Game}     />
                <Route       path="/daily"     component={Daily}    />
                <Route       path="/friends"   component={Friends}  />
                <Route       path="/profile"   component={Profile}  />
                <Route       path="/settings"  component={Settings} />
              </Switch>
            </main>
            <Nav />
          </div>
        </Router>
      </ThemeContext.Provider>
    </AuthContext.Provider>
  );
}
