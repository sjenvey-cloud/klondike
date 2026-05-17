import { useState, useEffect, useRef, useCallback } from 'react';

export interface UseTimerReturn {
  elapsed: number;
  formatted: string;
  isPaused: boolean;
  pause: () => void;
  resume: () => void;
  reset: () => void;
}

// sessionId: changes whenever a new session/game is created. Used as a dependency
//   so the timer restarts correctly even when `running` stays true across a redeal.
export function useTimer(running: boolean, sessionId: string | null): UseTimerReturn {
  const [elapsed, setElapsed]   = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const startRef    = useRef<number | null>(null);  // epoch-ms anchor
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pausedAtRef = useRef<number | null>(null);  // epoch-ms when paused
  const isPausedRef = useRef(false);                // stable mirror of isPaused

  // Keep the ref in sync with state
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);

  const stopTick = useCallback((): void => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startTick = useCallback((): void => {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(() => {
      if (startRef.current !== null) {
        setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
      }
    }, 1000);
  }, []);

  // Effect 1: Start/stop based on running + sessionId.
  useEffect(() => {
    if (running) {
      startRef.current = Date.now();
      startTick();
    } else {
      stopTick();
      pausedAtRef.current = null;
      isPausedRef.current = false;
      setIsPaused(false);
    }
    return () => stopTick();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, sessionId]);

  // Effect 2: Pause/resume when the tab is hidden.
  useEffect(() => {
    if (!running) return;

    function handleVisibilityChange(): void {
      if (document.hidden) {
        if (pausedAtRef.current === null) {
          pausedAtRef.current = Date.now();
          stopTick();
        }
      } else if (pausedAtRef.current !== null && !isPausedRef.current) {
        const pausedDuration = Date.now() - pausedAtRef.current;
        if (startRef.current !== null) startRef.current += pausedDuration;
        pausedAtRef.current = null;
        startTick();
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, sessionId]);

  const pause = useCallback((): void => {
    if (pausedAtRef.current === null) {
      pausedAtRef.current = Date.now();
      stopTick();
    }
    isPausedRef.current = true;
    setIsPaused(true);
  }, [stopTick]);

  const resume = useCallback((): void => {
    if (pausedAtRef.current !== null) {
      const pausedDuration = Date.now() - pausedAtRef.current;
      if (startRef.current !== null) startRef.current += pausedDuration;
      pausedAtRef.current = null;
    }
    startTick();
    isPausedRef.current = false;
    setIsPaused(false);
  }, [startTick]);

  const reset = useCallback((): void => {
    stopTick();
    pausedAtRef.current = null;
    startRef.current = null;
    isPausedRef.current = false;
    setIsPaused(false);
    setElapsed(0);
  }, [stopTick]);

  const format = (s: number): string => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return { elapsed, formatted: format(elapsed), reset, isPaused, pause, resume };
}
