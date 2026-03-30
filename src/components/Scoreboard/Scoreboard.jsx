import './Scoreboard.css';

const formatTime = (seconds) => {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

const Scoreboard = ({
  moves, elapsed, gameWon,
  canUndo, drawCount,
  onNewGame, onUndo, onAbandon, onQuit,
}) => (
  <div className="scoreboard">
    <div className="score-item">
      <span className="score-label">Moves</span>
      <span className="score-value">{moves}</span>
    </div>
    <div className="score-item">
      <span className="score-label">Time</span>
      <span className="score-value">{formatTime(elapsed)}</span>
    </div>
    <div className="score-item">
      <span className="score-label">Draw</span>
      <span className="score-value">{drawCount}</span>
    </div>

    <div className="scoreboard-actions">
      <button className="btn btn-undo" onClick={onUndo} disabled={!canUndo} title="Undo last move">
        ↩ Undo
      </button>
      <button className="btn btn-new-game" onClick={onNewGame}>
        New Game
      </button>
      <button className="btn btn-abandon" onClick={onAbandon} title="Abandon and start a new game">
        Abandon
      </button>
      <button className="btn btn-quit" onClick={onQuit}>
        Quit
      </button>
    </div>

    {gameWon && (
      <div className="win-banner">
        🎉 You Win! — {moves} moves in {formatTime(elapsed)}
      </div>
    )}
  </div>
);

export default Scoreboard;
