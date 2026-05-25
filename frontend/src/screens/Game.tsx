import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { usePreferences } from '../hooks/usePreferences';
import { useGame } from '../hooks/useGame';
import { useTimer } from '../hooks/useTimer';
import { Board } from '../components/Board/Board';
import { WinModal } from '../components/WinModal/WinModal';
import { DailyWinModal } from '../components/DailyWinModal/DailyWinModal';
import { getHand, getHandLeaderboard } from '../services/api';
import { localDateString } from '../services/dateUtils';
import type { DailyHandResponse, CompleteSessionResponse, DailyLeaderboardEntry } from '../types/api';
import './Game.css';

interface GameProps {
  dailyHand?: DailyHandResponse | null;
  dailyDate?: string | null;
  isRanked?: boolean;
  onShowLeaderboard?: (() => void) | null;
  onDailyWin?: ((data: DailyWinData) => void) | null;
}

interface DailyWinData {
  moves: number;
  timeFormatted: string;
  rank: number | null;
  sessionUuid: string | null;
}

interface PriorDailyInfo {
  date: string;
  drawMode: string;
}

interface GameLeaderboardProps {
  entries: DailyLeaderboardEntry[];
  loading: boolean;
  userId: number | undefined;
  onClose: () => void;
  onRedeal: () => void;
}

export function Game({
  dailyHand = null,
  dailyDate = null,
  isRanked = true,
  onShowLeaderboard = null,
  onDailyWin = null,
}: GameProps): React.JSX.Element {
  const { user }        = useAuth();
  const { preferences } = usePreferences();
  const location        = useLocation();
  const navigate        = useNavigate();
  // Daily games use a separate sessionStorage key so they never collide with
  // the random-hand session. Without this, navigating from an active daily to
  // /game would show the daily session as a random-hand resume candidate.
  const game  = useGame(user?.id ?? null, dailyHand ? 'klondike_daily_session' : 'klondike_session');
  const timer = useTimer(!!game.tableau && !game.isWon, game.sessionId);

  const [winResult,     setWinResult]     = useState<CompleteSessionResponse | null>(null);
  const [finishing,     setFinishing]     = useState(false);
  const [resumePrompt,  setResumePrompt]  = useState(false);
  const [lbOpen,        setLbOpen]        = useState(false);
  const [lbData,        setLbData]        = useState<DailyLeaderboardEntry[]>([]);
  const [lbLoading,     setLbLoading]     = useState(false);
  // Prior daily replay context (set when navigated from the calendar)
  const [priorDailyInfo,  setPriorDailyInfo]  = useState<PriorDailyInfo | null>(null);
  const [dailyWinData,    setDailyWinData]    = useState<DailyWinData | null>(null);

  // Remove the app-shell max-width while the game is active so cards can fill the iPad screen
  useEffect(() => {
    document.documentElement.classList.add('game-fullwidth');
    return () => document.documentElement.classList.remove('game-fullwidth');
  }, []);

  // On mount: check for saved session or replay request
  useEffect(() => {
    if (!user) return;

    if (dailyHand) {
      // dailyDate prop is the canonical date for this challenge (past date for prior dailies,
      // null/today for today's daily). Using the wrong date causes sessions to be tagged with
      // today's date and then silently excluded from the correct day's leaderboard.
      const locState  = location.state as Record<string, unknown> | null;
      const drawMode  = (locState?.drawMode as string | undefined) || localStorage.getItem('klondike_draw_mode') || 'draw3';
      const dateToUse = dailyDate || localDateString(new Date());

      // If the user navigated away and back (e.g. daily → /game → daily), the game
      // state is still in klondike_daily_session. Resume it rather than creating a
      // new session, as long as the saved hand matches the current daily hand.
      if (game.hasSavedSession(dailyHand.uuid)) {
        game.resumeGame();
        return;
      }

      game.startGame(dailyHand, drawMode, { isDaily: true, dailyDate: dateToUse, isRanked });
      return;
    }

    const locState        = location.state as Record<string, unknown> | null;
    const replayHandId    = locState?.replayHandId    as string | undefined;
    const replayDrawMode  = locState?.replayDrawMode  as string | undefined;
    const replayIsDaily   = (locState?.replayIsDaily  as boolean | undefined)   ?? false;
    const replayDailyDate = (locState?.replayDailyDate as string | undefined)   ?? null;
    const replayIsRanked  = (locState?.replayIsRanked  as boolean | undefined)  ?? true;

    if (replayHandId) {
      // Replay a specific historical hand (may be a prior daily challenge)
      getHand(replayHandId)
        .then(hand => {
          const mode = replayDrawMode || hand.drawMode || 'draw3';
          if (replayIsDaily && replayDailyDate) {
            setPriorDailyInfo({ date: replayDailyDate, drawMode: mode });
          }
          game.startGame(hand, mode, {
            isDaily:   replayIsDaily,
            dailyDate: replayDailyDate,
            isRanked:  replayIsRanked,
          });
        })
        .catch(() => game.startGame(null, replayDrawMode || 'draw3'));
      return;
    }

    // DEV-203: app-level modal navigated here — user already chose "Resume".
    // Resume immediately without a second prompt regardless of sessionStorage state.
    const resumeSessionId = locState?.resumeSessionId as string | undefined;
    const resumeHandId    = locState?.resumeHandId    as string | undefined;
    const resumeDrawMode  = locState?.resumeDrawMode  as string | undefined;
    if (resumeSessionId) {
      if (game.hasSavedSession()) {
        // sessionStorage intact — restore directly, no need to fetch from server
        game.resumeGame();
      } else {
        // sessionStorage was cleared (browser closed/refreshed) — reload the hand from the
        // server and reuse the existing session ID so no new session is created
        const mode = resumeDrawMode || localStorage.getItem('klondike_draw_mode') || 'draw3';
        getHand(resumeHandId ?? '')
          .then(hand => game.startGame(hand, hand.drawMode || mode, { existingSessionId: resumeSessionId }))
          .catch(() => game.startGame(null, mode));
      }
      return;
    }

    if (game.hasSavedSession()) {
      setResumePrompt(true);
    } else {
      const drawMode = (locState?.drawMode as string | undefined) || localStorage.getItem('klondike_draw_mode') || 'draw3';
      game.startGame(null, drawMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Handle win
  useEffect(() => {
    if (game.isWon && !finishing) {
      setFinishing(true);
      // Capture moves/time at the moment of win before the async completes
      const wonMoves    = game.moves;
      const wonTime     = timer.formatted;
      const sessionUuid = game.sessionId; // UUID string set before game starts
      game.finishGame()
        .then(res => {
          setWinResult(res);
          if (dailyHand && onDailyWin) {
            // Today's daily — notify Daily screen to show DailyWinModal
            onDailyWin({ moves: wonMoves, timeFormatted: wonTime, rank: res?.rank ?? null, sessionUuid });
          } else if (priorDailyInfo) {
            // Prior daily replay — show DailyWinModal inline
            setDailyWinData({ moves: wonMoves, timeFormatted: wonTime, rank: res?.rank ?? null, sessionUuid });
          }
        })
        .catch((err: Error) => {
          setWinResult({} as CompleteSessionResponse);
          // If the server explicitly rejected the win (422), the session is NOT marked
          // as "won" on the backend, so the replay endpoint would fail. In that case
          // suppress sessionUuid so the "Watch My Replay" button is hidden.
          const serverRejected = err?.message === '422';
          const replayUuid = serverRejected ? null : sessionUuid;
          if (dailyHand && onDailyWin) {
            onDailyWin({ moves: wonMoves, timeFormatted: wonTime, rank: null, sessionUuid: replayUuid });
          } else if (priorDailyInfo) {
            setDailyWinData({ moves: wonMoves, timeFormatted: wonTime, rank: null, sessionUuid: replayUuid });
          }
        });
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
    const locState  = location.state as Record<string, unknown> | null;
    const drawMode  = (locState?.drawMode as string | undefined) || localStorage.getItem('klondike_draw_mode') || 'draw3';
    game.startGame(null, drawMode);
  }, [game, timer, location.state]);

  const handleRedeal = useCallback(async () => {
    const currentHandId   = game.handId;
    const currentDrawMode = game.drawMode;
    if (!currentHandId) return;

    // abandon() is now fire-and-forget internally (swallows network errors),
    // but we still await so local sessionStorage is cleared before we proceed.
    await game.abandon();

    // Reset UI state immediately so no stale modal/overlay is visible while
    // the new session is being created, even if the network call below fails.
    setWinResult(null);
    setFinishing(false);
    setLbOpen(false);
    timer.reset();

    try {
      const hand = await getHand(currentHandId);
      if (dailyHand) {
        // Preserve daily context so the redealt session is still tagged correctly.
        // Use the dailyDate prop (the actual challenge date) — NOT today's client date —
        // so prior-daily redeals don't get mis-tagged with today and silently excluded
        // from the correct day's leaderboard.
        // Backend will force isRanked=false if the user has already used their ranked slot.
        await game.startGame(hand, currentDrawMode, {
          isDaily:   true,
          dailyDate: dailyDate ?? localDateString(new Date()),
          isRanked:  true,
        });
      } else {
        await game.startGame(hand, currentDrawMode);
      }
    } catch {
      // Network failure fetching the hand or creating the session. Fall back to a
      // completely fresh deal so the user is never left staring at a frozen board.
      try {
        await game.startGame(null, currentDrawMode);
      } catch {
        // Even a brand-new deal failed — severe network issue. Go home gracefully.
        navigate('/');
      }
    }
  }, [game, timer, dailyHand, navigate]);

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
        <div role="status" className="game-spinner">Dealing…</div>
      </div>
    );
  }

  return (
    <div className="screen game-screen">
      <Board
        game={game}
        timer={timer}
        drawMode={game.drawMode}
        onNewGame={dailyHand ? undefined : handleNewGame}
        onLeaderboard={handleOpenLeaderboard}
        onRedeal={handleRedeal}
        stockSide={preferences?.stockSide || 'left'}
      />

      {/* WinModal for regular (non-daily) games only */}
      {game.isWon && winResult !== null && !dailyHand && !dailyWinData && (
        <WinModal
          moves={game.moves}
          timeFormatted={timer.formatted}
          result={winResult}
          sessionUuid={game.sessionId}
          onNewGame={handleNewGame}
          onShowLeaderboard={handleOpenLeaderboard}
          winAnimation={preferences?.winAnimation || 'confetti'}
        />
      )}

      {/* DailyWinModal for prior daily replays launched from the calendar */}
      {dailyWinData && priorDailyInfo && (
        <DailyWinModal
          moves={dailyWinData.moves}
          timeFormatted={dailyWinData.timeFormatted}
          rank={dailyWinData.rank}
          date={priorDailyInfo.date}
          drawMode={priorDailyInfo.drawMode}
          userUuid={user?.uuid}
          sessionUuid={dailyWinData.sessionUuid}
          winAnimation={preferences?.winAnimation || 'confetti'}
          onNavigate={(dest) => {
            setDailyWinData(null);
            // 'leaderboard' and 'calendar' take the user to the daily screen;
            // 'game', 'home', 'profile', 'replay' are handled internally by DailyWinModal
            if (dest === 'leaderboard' || dest === 'calendar') navigate('/daily');
          }}
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

function formatLbTime(s: number | null | undefined): string {
  if (!s) return '—';
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function GameLeaderboard({ entries, loading, userId, onClose, onRedeal }: GameLeaderboardProps): React.JSX.Element {
  const drawerRef = useRef<HTMLDivElement>(null);

  // Auto-focus close button on mount
  useEffect(() => {
    const first = drawerRef.current?.querySelector<HTMLElement>(
      'button, [href], input, [tabindex]:not([tabindex="-1"])'
    );
    first?.focus();
  }, []);

  // Escape key closes the drawer
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="game-lb-backdrop"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="game-lb-title"
        className="game-lb-drawer"
        ref={drawerRef}
      >
        <div className="game-lb-header">
          <span id="game-lb-title" className="game-lb-title">Deal Leaderboard</span>
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
                  <tr key={row.userId ?? row.userUuid} className={row.userId === userId ? 'game-lb-me' : ''}>
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
