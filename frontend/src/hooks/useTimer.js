import { useState, useEffect, useRef, useCallback } from 'react';

export function useTimer(running) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(null);       // wall-clock time when timer effectively "started"
  const intervalRef = useRef(null);
  const pausedAtRef = useRef(null);    // wall-clock time when tab was hidden

  useEffect(() => {
    if (running) {
      // Recompute startRef so that elapsed is preserved across running toggling
      startRef.current = Date.now() - elapsed * 1000;
      intervalRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  // Pause/resume when the tab is hidden or the device screen locks
  useEffect(() => {
    if (!running) return;

    function handleVisibilityChange() {
      if (document.hidden) {
        // Tab hidden — record the moment and stop ticking
        pausedAtRef.current = Date.now();
        clearInterval(intervalRef.current);
      } else {
        // Tab visible again — shift startRef forward by the paused duration so
        // the elapsed count is correct, then restart the interval
        if (pausedAtRef.current !== null) {
          const pausedDuration = Date.now() - pausedAtRef.current;
          startRef.current += pausedDuration;
          pausedAtRef.current = null;
        }
        intervalRef.current = setInterval(() => {
          setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
        }, 1000);
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(intervalRef.current);
    };
  }, [running]);

  const reset = useCallback(() => setElapsed(0), []);

  const format = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return { elapsed, formatted: format(elapsed), reset };
}
