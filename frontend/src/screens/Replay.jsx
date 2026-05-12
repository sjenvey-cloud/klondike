import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSessionReplay } from '../services/api';
import { buildReplayStates, describeMove } from '../services/replayLogic';
import { ReplayBoard }    from '../components/ReplayBoard/ReplayBoard';
import { ReplayControls } from '../components/ReplayControls/ReplayControls';
import './Replay.css';

/**
 * DEV-220 / DEV-221: Session replay viewer.
 *
 * Route: /replay/:sessionUuid
 *
 * Fetches the parsed move list + deal order, builds all board state snapshots
 * in one pass, then lets the user step through them with transport controls
 * and variable playback speed.
 */
export function Replay() {
  const { sessionUuid } = useParams();
  const navigate = useNavigate();

  const [replayData, setReplayData] = useState(null);   // ReplayResponse
  const [states,     setStates]     = useState([]);      // board state per step
  const [stepIndex,  setStepIndex]  = useState(0);
  const [playing,    setPlaying]    = useState(false);
  const [speed,      setSpeed]      = useState(1);       // 0.5 | 1 | 2
  const [error,      setError]      = useState(null);
  const [loading,    setLoading]    = useState(true);

  const intervalRef = useRef(null);

  // ── Fetch + build states ──────────────────────────────────────────────

  useEffect(() => {
    if (!sessionUuid) return;
    setLoading(true);
    setError(null);

    getSessionReplay(sessionUuid)
      .then(data => {
        const allStates = buildReplayStates(data.cards, data.moves, data.drawMode);
        setReplayData(data);
        setStates(allStates);
        setStepIndex(0);
      })
      .catch(err => {
        const status = err?.message;
        if (status === '422') {
          setError('This session cannot be replayed — only completed wins are supported.');
        } else if (status === '404') {
          setError('Session not found.');
        } else {
          setError('Could not load replay. Please try again.');
        }
      })
      .finally(() => setLoading(false));
  }, [sessionUuid]);

  // ── Playback interval ────────────────────────────────────────────────

  useEffect(() => {
    clearInterval(intervalRef.current);
    if (!playing || states.length === 0) return;

    const delay = Math.round(1000 / speed);
    intervalRef.current = setInterval(() => {
      setStepIndex(prev => {
        if (prev >= states.length - 1) {
          setPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, delay);

    return () => clearInterval(intervalRef.current);
  }, [playing, speed, states.length]);

  // ── Controls ─────────────────────────────────────────────────────────

  const totalSteps = Math.max(0, states.length - 1);

  const handlePlay  = useCallback(() => setPlaying(true),  []);
  const handlePause = useCallback(() => setPlaying(false), []);
  const handlePrev  = useCallback(() => { setPlaying(false); setStepIndex(i => Math.max(0, i - 1)); },          []);
  const handleNext  = useCallback(() => { setPlaying(false); setStepIndex(i => Math.min(totalSteps, i + 1)); }, [totalSteps]);
  const handleFirst = useCallback(() => { setPlaying(false); setStepIndex(0); },          []);
  const handleLast  = useCallback(() => { setPlaying(false); setStepIndex(totalSteps); }, [totalSteps]);
  const handleSeek  = useCallback(i  => { setPlaying(false); setStepIndex(i); },          []);

  // ── Derived render values ─────────────────────────────────────────────

  const currentState = states[stepIndex] || null;

  // The move that produced the current state is moves[stepIndex - 1] (move 0 → state 1)
  const currentMove    = replayData?.moves[stepIndex - 1] ?? null;
  const prevState      = states[stepIndex - 1] ?? null;
  const moveDesc       = describeMove(currentMove, prevState);

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="replay-screen">

      {/* ── Header ── */}
      <div className="replay-header">
        <button className="replay-back-btn" onClick={() => navigate(-1)} aria-label="Back">
          ‹ Back
        </button>
        <span className="replay-title">Replay</span>
        {replayData && (
          <span className="replay-meta">
            {replayData.drawMode === 'draw1' ? 'Draw 1' : 'Draw 3'}
            {' · '}{replayData.totalMoves} moves
          </span>
        )}
      </div>

      {/* ── Controls (always visible, disabled while loading) ── */}
      <ReplayControls
        stepIndex={stepIndex}
        totalSteps={totalSteps}
        playing={playing}
        speed={speed}
        description={loading ? 'Loading…' : error ? error : moveDesc}
        onPlay={handlePlay}
        onPause={handlePause}
        onPrev={handlePrev}
        onNext={handleNext}
        onFirst={handleFirst}
        onLast={handleLast}
        onSpeedChange={setSpeed}
        onSeek={handleSeek}
      />

      {/* ── Board ── */}
      <div className="replay-board-wrap">
        {loading && <p className="replay-state-msg">Loading replay…</p>}
        {!loading && error && <p className="replay-state-msg replay-state-msg--error">{error}</p>}
        {!loading && !error && currentState && (
          <ReplayBoard
            tableau={currentState.tableau}
            stock={currentState.stock}
            waste={currentState.waste}
            foundations={currentState.foundations}
            drawMode={replayData.drawMode}
          />
        )}
      </div>

    </div>
  );
}
