import './Scoreboard.css';

const formatTime = (seconds) => {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

const Scoreboard = ({ moves, elapsed, onNewGame, onQuit, gameWon }) => (
  <div className="scoreboard">
    <div className="score-item">
      <span className="score-label">Moves</span>
      <span className="score-value">{moves}</span>
    </div>
    <div className="score-item">
      <span className="score-label">Time</span>
      <span className="score-value">{formatTime(elapsed)}</span>
    </div>
    <button className="btn-new-game" onClick={onNewGame}>New Game</button>
    <button className="btn-quit" onClick={onQuit}>Quit</button>
    {gameWon && <div className="win-banner">🎉 You Win!</div>}
  </div>
);

export default Scoreboard;
