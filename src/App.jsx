import { useState, useEffect } from 'react';
import Login from './components/Login/Login';
import Board from './components/Board/Board';
import Scoreboard from './components/Scoreboard/Scoreboard';
import { useGameState } from './hooks/useGameState';
import './App.css';

function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('klondike_user');
    return saved ? JSON.parse(saved) : null;
  });

  const {
    gameState, moves, elapsed, gameWon, loading, canUndo, drawCount,
    newGame, drawFromStock, moveToTableau, moveToFoundation, undo, abandonGame,
  } = useGameState(user);

  const handleLogin = (u) => {
    localStorage.setItem('klondike_user', JSON.stringify(u));
    setUser(u);
  };

  const handleQuit = () => {
    localStorage.removeItem('klondike_user');
    setUser(null);
  };

  // Auto-start a game on login
  useEffect(() => {
    if (user && !gameState) newGame();
  }, [user]);

  if (!user) return <Login onLogin={handleLogin} />;

  if (loading) {
    return (
      <div className="loading-screen">
        <p>Shuffling deck...</p>
      </div>
    );
  }

  return (
    <div className="app">
      <Scoreboard
        moves={moves}
        elapsed={elapsed}
        gameWon={gameWon}
        canUndo={canUndo}
        drawCount={drawCount}
        onNewGame={newGame}
        onUndo={undo}
        onAbandon={abandonGame}
        onQuit={handleQuit}
      />
      {gameState && (
        <Board
          gameState={gameState}
          onDrawStock={drawFromStock}
          onMoveToTableau={moveToTableau}
          onMoveToFoundation={moveToFoundation}
        />
      )}
    </div>
  );
}

export default App;
