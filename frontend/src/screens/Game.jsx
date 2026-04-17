import React, { useContext, useEffect, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { AuthContext } from '../App';
import { useGame } from '../hooks/useGame';
import { useTimer } from '../hooks/useTimer';
import { Board } from '../components/Board/Board';
import { WinModal } from '../components/WinModal/WinModal';
import { getHand, getHandLeaderboard } from '../services/api';
import './Game.css';

export function Game({ dailyHand = null, isRanked = true, onShowLeaderboard = null }) {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const game = useGame(user?.id);
  const timer = useTimer(!!game.tableau && !game.isWon);
  const [winResult, setWinResult]   = useState(null);
  const [finishing, setFinishing]   = useState(false);
  const [resumePrompt, setResumePrompt] = useState(false);
  const [lbOpen, setLbOpen]         = useState(false);
  const [lbData, setLbData]         = useState([]);
  const [lbLoading, setLbLoading]   = useState(false);

  // On mount: check for saved session or replay request
  useEffect(() => {
    if (!user) return;

    if (dailyHand) {
      // Daily games always start fresh
      const drawMode = location.state?.drawMode || localStorage.getItem('klondike_draw_mode') || 'draw3';
      const today = new Date().toISOString().slice(0, 10);
      game.startGame(dailyHand, drawMode, { isDaily: true, dailyDate: today, isRanked });
      return;
    }

    const replayHandId  = location.state?.replayHandId;
    const replayDrawMode = location.state?.replayDrawMode;
    if (replayHandId) {
      // Replay a specific historical hand
      getHand(replayHandId)
        .then(hand => game.startGame(hand, replayDrawMode || hand.drawMode || 'draw3'))
        .catch(() => game.startGame(null, replayDrawMode || 'draw3'));
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

  const handleRedeal = useCallback(async () => {
    const currentHandId  = game.handId;
    const currentDrawMode = game.drawMode;
    if (!currentHandId) return;
    await game.abandon();
    setWinResult(null);
    setFinishing(false);
    setLbOpen(false);
    timer.reset();
    const hand = await getHand(currentHandId);
    game.startGame(hand, currentDrawMode);
  }, [game, timer]);

  const handleOpenLeaderboard = useCallback(() => {
    if (!game.handId) return;
    setLbOpen(true);
    setLbLoading(true);
    setLbData([]);
    getHandLeaderboard(game.handId)
      .then(data => setLbData(Array.isArray(data) ? data : []))
      .catch(() => setLbData([]))
      .finally(() => setLbLoading(false));
  }, [game.handId]);

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
      <Board
        game={game}
        timer={timer}
        onLeaderboard={handleOpenLeaderboard}
        onRedeal={handleRedeal}
      />

      {game.isWon && winResult !== null && (
        <WinModal
          moves={game.moves}
          timeFormatted={timer.formatted}
          result={winResult}
          onNewGame={handleNewGame}
          onShowLeaderboard={onShowLeaderboard}
        />
      )}

      {lbOpen && (
        <GameLeaderboard
          entries={lbData}
          loading={lbLoading}
          userId={user?.id}
          onClose={() => setLbOpen(false)}
          onRedeal={handleRedeal}
        />
      )}
    </div>
  );
}

function formatLbTime(s) {
  if (!s) return '—';
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function GameLeaderboard({ entries, loading, userId, onClose, onRedeal }) {
  return (
    <div className="game-lb-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="game-lb-drawer">
        <div className="game-lb-header">
          <span className="game-lb-title">Deal Leaderboard</span>
          <button className="game-lb-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="game-lb-body">
          <button className="btn-primary game-lb-redeal-btn" onClick={() => { onClose(); onRedeal(); }}>
            ↺ Redeal This Hand
          </button>
          {loading && <p className="game-lb-empty">Loading…</p>}
          {!loading && entries.length === 0 && (
            <p className="game-lb-empty">No one has solved this deal yet — you could be first!</p>
          )}
          {!loading && entries.length > 0 && (
            <table className="game-lb-table">
              <thead>
                <tr><th>#</th><th>Player</th><th>Moves</th><th>Time</th></tr>
              </thead>
              <tbody>
                {entries.map(row => (
                  <tr key={row.userId} className={row.userId === userId ? 'game-lb-me' : ''}>
                    <td>{row.rank}</td>
                    <td>{row.displayName}</td>
                    <td>{row.moves}</td>
                    <td>{formatLbTime(row.timeSeconds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
