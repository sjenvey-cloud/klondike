import { useState, useEffect, useRef, useCallback } from 'react';

// sessionStartRef: a ref whose .current is the epoch-ms when the current game
// session began. Passed from useGame so that timer can resume from the real
// start time when restoring a saved session, instead of always starting at 0.
export function useTimer(running, sessionStartRef) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(null);    // epoch-ms anchor: elapsed = Date.now() - startRef.current
  const intervalRef = useRef(null);
  const pausedAtRef = useRef(null); // epoch-ms when the tab was hidden

  // Start/stop the interval whenever running changes
  useEffect(() => {
    if (running) {
      // Prefer the session's real start time so a resumed game shows the
      // correct total elapsed, not just the time since the resume click.
      if (sessionStartRef?.current) {
        startRef.current = sessionStartRef.current;
      } else {
        startRef.current = Date.now() - elapsed * 1000;
      }
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
  }, [running]);

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
  }, [running]);

  const reset = useCallback(() => {
    setElapsed(0);
    startRef.current = null;
  }, []);

  const format = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return { elapsed, formatted: format(elapsed), reset };
}
