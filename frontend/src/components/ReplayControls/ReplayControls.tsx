import React from 'react';
import './ReplayControls.css';

const SPEEDS = [0.5, 1, 2];

interface ReplayControlsProps {
  stepIndex: number;
  totalSteps: number;
  playing: boolean;
  speed: number;
  description: string;
  onPlay: () => void;
  onPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onFirst: () => void;
  onLast: () => void;
  onSpeedChange: (speed: number) => void;
  onSeek: (index: number) => void;
}

export function ReplayControls({
  stepIndex,
  totalSteps,
  playing,
  speed,
  description,
  onPlay,
  onPause,
  onPrev,
  onNext,
  onFirst,
  onLast,
  onSpeedChange,
  onSeek,
}: ReplayControlsProps): React.JSX.Element {
  const atStart = stepIndex === 0;
  const atEnd   = stepIndex >= totalSteps;

  return (
    <div className="rc-bar">
      <div className="rc-description" aria-live="polite">
        {description || 'Initial position'}
      </div>

      <div className="rc-seek-row">
        <span className="rc-counter">{stepIndex}</span>
        <input
          className="rc-slider"
          type="range"
          min={0}
          max={totalSteps}
          value={stepIndex}
          onChange={e => onSeek(Number(e.target.value))}
          aria-label="Seek"
        />
        <span className="rc-counter rc-counter--right">{totalSteps}</span>
      </div>

      <div className="rc-controls-row">
        <div className="rc-transport">
          <button className="rc-btn" onClick={onFirst} disabled={atStart} aria-label="Go to start" title="Start">⏮</button>
          <button className="rc-btn" onClick={onPrev}  disabled={atStart} aria-label="Previous move" title="Previous">◀</button>
          <button
            className="rc-btn rc-btn--play"
            onClick={playing ? onPause : onPlay}
            disabled={atEnd && !playing}
            aria-label={playing ? 'Pause' : 'Play'}
            title={playing ? 'Pause' : 'Play'}
          >
            {playing ? '⏸' : '▶'}
          </button>
          <button className="rc-btn" onClick={onNext} disabled={atEnd} aria-label="Next move" title="Next">▶</button>
          <button className="rc-btn" onClick={onLast} disabled={atEnd} aria-label="Go to end" title="End">⏭</button>
        </div>

        <div className="rc-speed">
          {SPEEDS.map(s => (
            <button
              key={s}
              className={`rc-speed-btn${speed === s ? ' rc-speed-btn--active' : ''}`}
              onClick={() => onSpeedChange(s)}
              aria-label={`${s}× speed`}
              title={`${s}× speed`}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
