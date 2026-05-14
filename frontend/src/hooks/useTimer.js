import { useState, useEffect, useRef, useCallback } from 'react';

// sessionId: changes whenever a new session/game is created. Used as a dependency
//   so the timer restarts correctly even when `running` stays true across a redeal.
export function useTimer(running, sessionId) {
  const [elapsed, setElapsed]   = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const startRef    = useRef(null);   // epoch-ms anchor: elapsed = Date.now() - startRef.current
  const intervalRef = useRef(null);
  const pausedAtRef = useRef(null);   // epoch-ms when paused (manual pause or tab hidden)
  const isPausedRef = useRef(false);  // stable mirror of isPaused for use inside event listeners

  // Keep the ref in sync with state (one render behind, which is fine for the listener)
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);

  const stopTick = useCallback(() => {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
  }, []);

  const startTick = useCallback(() => {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
  }, []);

  // Effect 1: Start/stop based on running + sessionId.
  // Does NOT depend on isPaused — pause/resume manage the interval directly.
  useEffect(() => {
    if (running) {
      // Always anchor the display timer to now so it resets to ~0:00 on every
      // new deal or resume. The server-side elapsed time used for the leaderboard
      // is tracked separately in useGame via startTimeRef (which stays anchored
      // to the original session creation time across resumes).
      startRef.current = Date.now();
      startTick();
    } else {
      // Game ended (won, abandoned, etc.) — clear everything including any pause state
      stopTick();
      pausedAtRef.current = null;
      isPausedRef.current = false;
      setIsPaused(false);
    }
    return () => stopTick();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, sessionId]);

  // Effect 2: Pause/resume when the tab is hidden (screen lock, app switch, etc.).
  // Uses isPausedRef so it never needs to re-register when isPaused changes.
  useEffect(() => {
    if (!running) return;

    function handleVisibilityChange() {
      if (document.hidden) {
        // Going hidden: stop the clock (don't override an existing manual pause)
        if (pausedAtRef.current === null) {
          pausedAtRef.current = Date.now();
          stopTick();
        }
      } else if (pausedAtRef.current !== null && !isPausedRef.current) {
        // Becoming visible after a visibility-only pause: shift the anchor forward
        // so elapsed stays accurate, then restart the interval.
        // If the user manually paused, leave it paused — they'll click Resume.
        const pausedDuration = Date.now() - pausedAtRef.current;
        startRef.current += pausedDuration;
        pausedAtRef.current = null;
        startTick();
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    // Cleanup only removes the listener; Effect 1 owns the interval lifecycle
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, sessionId]);

  // Manual pause — stops the tick and records when, so resume can compensate
  const pause = useCallback(() => {
    if (pausedAtRef.current === null) {
      pausedAtRef.current = Date.now();
      stopTick();
    }
    isPausedRef.current = true;
    setIsPaused(true);
  }, [stopTick]);

  // Manual resume — shifts the anchor forward by the paused duration and restarts
  const resume = useCallback(() => {
    if (pausedAtRef.current !== null) {
      const pausedDuration = Date.now() - pausedAtRef.current;
      startRef.current += pausedDuration;
      pausedAtRef.current = null;
    }
    startTick();
    isPausedRef.current = false;
    setIsPaused(false);
  }, [startTick]);

  // Clears the display and stops the current interval immediately.
  // Effect 1 will start a fresh interval when the next session begins.
  const reset = useCallback(() => {
    stopTick();
    pausedAtRef.current = null;
    startRef.current = null;
    isPausedRef.current = false;
    setIsPaused(false);
    setElapsed(0);
  }, [stopTick]);

  const format = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return { elapsed, formatted: format(elapsed), reset, isPaused, pause, resume };
}
