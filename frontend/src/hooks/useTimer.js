import { useState, useEffect, useRef, useCallback } from 'react';

// sessionStartRef: ref whose .current is the epoch-ms when the current session began.
// sessionId: changes whenever a new session/game is created. Used as a dependency
//   so the timer restarts correctly even when `running` stays true across a redeal.
export function useTimer(running, sessionStartRef, sessionId) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(null);    // epoch-ms anchor: elapsed = Date.now() - startRef.current
  const intervalRef = useRef(null);
  const pausedAtRef = useRef(null); // epoch-ms when the tab was hidden

  // Start/stop the interval when running changes OR when a new session begins
  useEffect(() => {
    if (running) {
      // Use the session's real start time so a resumed game shows total elapsed,
      // not just time since the resume click.
      startRef.current = sessionStartRef?.current ?? Date.now();
      intervalRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, sessionId]);

  // Pause/resume when the tab is hidden (screen lock, app switch, etc.)
  useEffect(() => {
    if (!running) return;

    function handleVisibilityChange() {
      if (document.hidden) {
        // Going hidden: stop the clock and note when
        pausedAtRef.current = Date.now();
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      } else if (pausedAtRef.current !== null) {
        // Becoming visible after a real pause: shift the anchor forward so
        // elapsed stays accurate, then restart the interval
        const pausedDuration = Date.now() - pausedAtRef.current;
        startRef.current += pausedDuration;
        pausedAtRef.current = null;
        intervalRef.current = setInterval(() => {
          setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
        }, 1000);
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    // Cleanup only removes the listener; Effect 1 owns the interval lifecycle
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [running, sessionId]);

  // Clears the display and stops the current interval immediately.
  // Effect 1 will start a fresh interval when the next session begins.
  const reset = useCallback(() => {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
    pausedAtRef.current = null;
    startRef.current = null;
    setElapsed(0);
  }, []);

  const format = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return { elapsed, formatted: format(elapsed), reset };
}
