import React, { useContext, useEffect, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { AuthContext } from '../App';
import { useGame } from '../hooks/useGame';
import { useTimer } from '../hooks/useTimer';
import { Board } from '../components/Board/Board';
import { WinModal } from '../components/WinModal/WinModal';
import './Game.css';

export function Game({ dailyHand = null, isRanked = true, onShowLeaderboard = null }) {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const game = useGame(user?.id);
  const timer = useTimer(!!game.tableau && !game.isWon);
  const [winResult, setWinResult]   = useState(null);
  const [finishing, setFinishing]   = useState(false);
  // DEV-66: resume prompt
  const [resumePrompt, setResumePrompt] = useState(false);

  // On mount: check for saved session
  useEffect(() => {
    if (!user) return;
    if (dailyHand) {
      // Daily games always start fresh
      const drawMode = location.state?.drawMode || localStorage.getItem('klondike_draw_mode') || 'draw3';
      const today = new Date().toISOString().slice(0, 10);
      game.startGame(dailyHand, drawMode, { isDaily: true, dailyDate: today, isRanked });
      return;
    }
    if (game.hasSavedSession()) {
      setResumePrompt(true);
    } else {
      const drawMode = location.state?.drawMode || localStorage.getItem('klondike_draw_mode') || 'draw3';
      game.startGame(null, drawMode);
    }
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

  const handleResume = useCallback(() => {
    setResumePrompt(false);
    game.resumeGame();
  }, [game]);

  const handleNewGame = useCallback(() => {
    setResumePrompt(false);
    setWinResult(null);
    setFinishing(false);
    timer.reset();
    const drawMode = location.state?.drawMode || localStorage.getItem('klondike_draw_mode') || 'draw3';
    game.startGame(null, drawMode);
  }, [game, timer, location.state]);

  if (!user) {
    return (
      <div className="screen game-screen game-center">
        <p>Sign in to play.</p>
      </div>
    );
  }

  // DEV-66: Resume prompt
  if (resumePrompt) {
    return (
      <div className="screen game-screen game-center">
        <div className="resume-prompt">
          <p className="resume-prompt-text">You have a game in progress.</p>
          <div className="resume-prompt-buttons">
            <button className="btn-primary" onClick={handleResume}>Resume</button>
            <button className="btn-secondary" onClick={handleNewGame}>New Game</button>
          </div>
        </div>
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
          onShowLeaderboard={onShowLeaderboard}
        />
      )}
    </div>
  );
}
