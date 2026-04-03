import React, { useContext, useEffect, useState, useCallback } from 'react';
import { AuthContext } from '../App';
import { useGame } from '../hooks/useGame';
import { useTimer } from '../hooks/useTimer';
import { Board } from '../components/Board/Board';
import { WinModal } from '../components/WinModal/WinModal';
import './Game.css';

export function Game({ dailyHand = null }) {
  const { user } = useContext(AuthContext);
  const game = useGame(user?.id);
  const timer = useTimer(!!game.tableau && !game.isWon);
  const [winResult, setWinResult] = useState(null);
  const [finishing, setFinishing] = useState(false);

  // Auto-start on mount
  useEffect(() => {
    if (user) game.startGame(dailyHand);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Handle win
  useEffect(() => {
    if (game.isWon && !finishing) {
      setFinishing(true);
      game.finishGame()
        .then(res => setWinResult(res))
        .catch(() => setWinResult({}));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.isWon, finishing]);

  const handleNewGame = useCallback(() => {
    setWinResult(null);
    setFinishing(false);
    timer.reset();
    game.startGame(null);
  }, [game, timer]);

  if (!user) {
    return (
      <div className="screen game-screen game-center">
        <p>Sign in from the Profile tab to play.</p>
      </div>
    );
  }

  if (game.loading || !game.tableau) {
    return (
      <div className="screen game-screen game-center">
        <div className="game-spinner">Dealing…</div>
      </div>
    );
  }

  return (
    <div className="screen game-screen">
      <Board game={game} timer={timer} />
      {game.isWon && winResult !== null && (
        <WinModal
          moves={game.moves}
          timeFormatted={timer.formatted}
          result={winResult}
          onNewGame={handleNewGame}
        />
      )}
    </div>
  );
}
