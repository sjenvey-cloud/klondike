import { useReducer, useState, useRef, useCallback, useEffect } from 'react';
import {
  dealKlondike, canPlaceOnTableau, canPlaceOnFoundation,
  isGameWon, foundationIndex, getRank,
} from '../services/gameLogic';
import type { CardInPile, BoardState } from '../services/gameLogic';
import { createHand, createSession, completeSession, abandonSession, saveSessionProgress, getHand } from '../services/api';
import type { CompleteSessionResponse } from '../types/api';

// ── DEV-66: Session persistence ────────────────────────────────────────────
//
// Game state is stored in localStorage (not sessionStorage) so it survives:
//   • tab close / reopen
//   • mobile browser moving the app to the background
//   • browser restarts / crashes (on the same device)
//   • accidental page refresh mid-game
//
// localStorage is shared across tabs of the same origin, but collisions are
// avoided by the separate keys for daily vs random games.

const SESSION_KEY       = 'klondike_session';
export const DAILY_SESSION_KEY = 'klondike_daily_session';

interface PersistedSession {
  sessionId: string;
  handId: string;
  gameState: BoardState;
  moves: number;
  turns: string[];
  startTime: number;
}

function saveSession(
  sessionId: string,
  handId: string,
  gameState: GameState,
  moves: number,
  turns: string[],
  startTime: number,
  key = SESSION_KEY,
): void {
  try {
    localStorage.setItem(key, JSON.stringify({
      sessionId,
      handId,
      gameState: {
        tableau:     gameState.tableau,
        stock:       gameState.stock,
        waste:       gameState.waste,
        foundations: gameState.foundations,
      },
      moves,
      turns,
      startTime,
    }));
  } catch { /* storage full — ignore */ }
}

function loadSession(key = SESSION_KEY): PersistedSession | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as PersistedSession) : null;
  } catch { return null; }
}

function clearSession(key = SESSION_KEY): void {
  localStorage.removeItem(key);
}

// Kept for any external callers (currently none, but exported for safety).
export function clearSavedSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

// ── Pending-win queue ──────────────────────────────────────────────────────
//
// If completeSession() fails after all network retries (e.g. the device goes
// offline exactly at the win moment), the win payload is stored here so it can
// be re-submitted the next time the user comes back online or opens the app.
//
// Only one pending win is stored — the most recent one.  The endpoint is
// effectively idempotent (same session UUID + same turns → same server result)
// so retrying is safe even if a previous attempt partially succeeded.

const PENDING_WIN_KEY = 'klondike_pending_win';

interface PendingWin {
  sessionUuid: string;
  moves: number;
  timeSeconds: number;
  turns: string;
}

function savePendingWin(data: PendingWin): void {
  try { localStorage.setItem(PENDING_WIN_KEY, JSON.stringify(data)); } catch { /* ignore */ }
}

function clearPendingWin(): void {
  localStorage.removeItem(PENDING_WIN_KEY);
}

function loadPendingWin(): PendingWin | null {
  try {
    const raw = localStorage.getItem(PENDING_WIN_KEY);
    return raw ? (JSON.parse(raw) as PendingWin) : null;
  } catch { return null; }
}

/**
 * Attempt to submit any win that previously failed due to a network error.
 * Call this on app boot (when the user is authenticated) and whenever the
 * browser fires the "online" event.  Safe to call repeatedly — exits
 * immediately if there is no pending win.
 */
export async function flushPendingWin(): Promise<void> {
  const pending = loadPendingWin();
  if (!pending) return;
  try {
    await completeSession(
      pending.sessionUuid,
      pending.moves,
      pending.timeSeconds,
      pending.turns,
    );
    clearPendingWin();
  } catch {
    // Still offline or server error — leave the pending win in place for the
    // next attempt.  Do not re-throw: callers should not crash on this path.
  }
}

// ── Reducer types ─────────────────────────────────────────────────────────

interface GameState extends BoardState {
  moves: number;
  turns: string[];
  isWon: boolean;
  drawMode: string;
  history: Array<Omit<BoardState, 'foundations'> & { foundations: number[][]; turns: string[] }>;
}

type GameAction =
  | { type: 'DEAL'; payload: Partial<GameState> }
  | { type: 'RESTORE'; payload: Partial<GameState> }
  | { type: 'DRAW' }
  | { type: 'WASTE_TO_TABLEAU'; col: number }
  | { type: 'WASTE_TO_FOUNDATION' }
  | { type: 'TABLEAU_TO_FOUNDATION'; fromCol: number }
  | { type: 'TABLEAU_TO_TABLEAU'; fromCol: number; fromIdx: number; toCol: number }
  | { type: 'AUTO_COMPLETE_STEP' }
  | { type: 'FOUNDATION_TO_TABLEAU'; fi: number; toCol: number }
  | { type: 'UNDO' };

type HistorySnapshot = Pick<GameState, 'tableau' | 'stock' | 'waste' | 'foundations' | 'turns'>;

const initial: GameState = {
  tableau: [], stock: [], waste: [], foundations: [],
  moves: 0, turns: [], isWon: false, drawMode: 'draw3',
  history: [],
};

function reducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {

    case 'DEAL':
      return { ...initial, ...action.payload };

    case 'RESTORE':
      return { ...initial, ...action.payload };

    case 'DRAW': {
      let stock = [...state.stock];
      let waste = [...state.waste];
      if (stock.length === 0) {
        stock = [...waste].map(c => ({ card: c.card, faceUp: false }));
        waste = [];
      } else {
        const count = Math.min(3, stock.length);
        for (let i = 0; i < count; i++) {
          const c = stock.shift()!;
          waste.push({ card: c.card, faceUp: true });
        }
      }
      return { ...state, stock, waste, moves: state.moves + 1, turns: [...state.turns, 'draw'] };
    }

    case 'WASTE_TO_TABLEAU': {
      const { col } = action;
      if (!state.waste.length) return state;
      const top = state.waste[state.waste.length - 1];
      const tableau = state.tableau.map(p => [...p]);
      if (!canPlaceOnTableau(top.card, tableau[col])) return state;
      tableau[col].push({ card: top.card, faceUp: true });
      return {
        ...state,
        waste: state.waste.slice(0, -1),
        tableau,
        moves: state.moves + 1,
        turns: [...state.turns, `wt:${col}`],
      };
    }

    case 'WASTE_TO_FOUNDATION': {
      if (!state.waste.length) return state;
      const top = state.waste[state.waste.length - 1];
      const fi = foundationIndex(top.card);
      const foundations = state.foundations.map(p => [...p]);
      if (!canPlaceOnFoundation(top.card, foundations[fi])) return state;
      foundations[fi].push(top.card);
      return {
        ...state,
        waste: state.waste.slice(0, -1),
        foundations,
        isWon: isGameWon(foundations),
        moves: state.moves + 1,
        turns: [...state.turns, 'wf'],
      };
    }

    case 'TABLEAU_TO_FOUNDATION': {
      const { fromCol } = action;
      const tableau = state.tableau.map(p => [...p]);
      const pile = tableau[fromCol];
      if (!pile.length || !pile[pile.length - 1].faceUp) return state;
      const top = pile[pile.length - 1];
      const fi = foundationIndex(top.card);
      const foundations = state.foundations.map(p => [...p]);
      if (!canPlaceOnFoundation(top.card, foundations[fi])) return state;
      tableau[fromCol] = pile.slice(0, -1);
      if (tableau[fromCol].length > 0) {
        const last = tableau[fromCol].length - 1;
        if (!tableau[fromCol][last].faceUp) {
          tableau[fromCol][last] = { ...tableau[fromCol][last], faceUp: true };
        }
      }
      foundations[fi].push(top.card);
      return {
        ...state,
        tableau,
        foundations,
        isWon: isGameWon(foundations),
        moves: state.moves + 1,
        turns: [...state.turns, `tf:${fromCol}`],
      };
    }

    case 'TABLEAU_TO_TABLEAU': {
      const { fromCol, fromIdx, toCol } = action;
      const tableau = state.tableau.map(p => [...p]);
      const fromPile = tableau[fromCol];
      if (fromIdx >= fromPile.length || !fromPile[fromIdx].faceUp) return state;
      const stack = fromPile.slice(fromIdx);
      if (!canPlaceOnTableau(stack[0].card, tableau[toCol])) return state;
      tableau[fromCol] = fromPile.slice(0, fromIdx);
      if (tableau[fromCol].length > 0) {
        const last = tableau[fromCol].length - 1;
        if (!tableau[fromCol][last].faceUp) {
          tableau[fromCol][last] = { ...tableau[fromCol][last], faceUp: true };
        }
      }
      tableau[toCol] = [...tableau[toCol], ...stack];
      return {
        ...state,
        tableau,
        moves: state.moves + 1,
        turns: [...state.turns, `tt:${fromCol}:${fromIdx}:${toCol}`],
      };
    }

    case 'AUTO_COMPLETE_STEP': {
      const tableau    = state.tableau.map(p => [...p]);
      const foundations = state.foundations.map(p => [...p]);

      // Phase 0: waste top → foundation (the common end-state once piles are clear).
      if (state.waste.length) {
        const wTop = state.waste[state.waste.length - 1];
        const wfi  = foundationIndex(wTop.card);
        if (canPlaceOnFoundation(wTop.card, foundations[wfi])) {
          foundations[wfi].push(wTop.card);
          return {
            ...state,
            waste: state.waste.slice(0, -1),
            foundations,
            isWon: isGameWon(foundations),
            moves: state.moves + 1,
            turns: [...state.turns, 'wf'],
          };
        }
      }

      // Phase 1: direct foundation moves from tableau tops
      let best: { col: number; fi: number; rank: number } | null = null;
      for (let col = 0; col < tableau.length; col++) {
        const pile = tableau[col];
        if (!pile.length) continue;
        const top = pile[pile.length - 1];
        const fi  = foundationIndex(top.card);
        if (canPlaceOnFoundation(top.card, foundations[fi])) {
          const rank = getRank(top.card);
          if (best === null || rank < best.rank) {
            best = { col, fi, rank };
          }
        }
      }

      if (best !== null) {
        const { col, fi } = best;
        const top = tableau[col][tableau[col].length - 1];
        foundations[fi].push(top.card);
        tableau[col] = tableau[col].slice(0, -1);
        return {
          ...state,
          tableau,
          foundations,
          isWon: isGameWon(foundations),
          moves: state.moves + 1,
          turns: [...state.turns, `tf:${col}`],
        };
      }

      // Phase 2: expose a buried needed card
      const suitOffset = [0, 13, 26, 39];
      const needed = [0, 1, 2, 3]
        .map(fi => ({
          fi,
          rank: foundations[fi].length + 1,
          card: suitOffset[fi] + foundations[fi].length + 1,
        }))
        .filter(n => n.rank <= 13)
        .sort((a, b) => a.rank - b.rank);

      for (const { card: neededCard } of needed) {
        for (let col = 0; col < tableau.length; col++) {
          const pile = tableau[col];
          const idx  = pile.findIndex(c => c.card === neededCard);
          if (idx < 0 || idx === pile.length - 1) continue;

          const topCard = pile[pile.length - 1];
          const fromIdx = pile.length - 1;
          for (let toCol = 0; toCol < tableau.length; toCol++) {
            if (toCol === col) continue;
            if (canPlaceOnTableau(topCard.card, tableau[toCol])) {
              tableau[col]  = pile.slice(0, fromIdx);
              tableau[toCol] = [...tableau[toCol], { card: topCard.card, faceUp: true }];
              return {
                ...state,
                tableau,
                moves: state.moves + 1,
                turns: [...state.turns, `tt:${col}:${fromIdx}:${toCol}`],
              };
            }
          }
          break;
        }
      }

      return state;
    }

    case 'FOUNDATION_TO_TABLEAU': {
      const { fi, toCol } = action;
      const foundations = state.foundations.map(p => [...p]);
      if (foundations[fi].length === 0) return state;
      const card = foundations[fi][foundations[fi].length - 1];
      const tableau = state.tableau.map(p => [...p]);
      if (!canPlaceOnTableau(card, tableau[toCol])) return state;
      foundations[fi].pop();
      tableau[toCol].push({ card, faceUp: true });
      return {
        ...state,
        foundations,
        tableau,
        moves: state.moves + 1,
        turns: [...state.turns, `ft:${fi}:${toCol}`],
        isWon: isGameWon(foundations),
      };
    }

    default:
      return state;
  }
}

// ── History / undo wrapper ────────────────────────────────────────────────

const UNDO_TRACKED = new Set([
  'DRAW', 'WASTE_TO_TABLEAU', 'WASTE_TO_FOUNDATION',
  'TABLEAU_TO_TABLEAU', 'TABLEAU_TO_FOUNDATION', 'FOUNDATION_TO_TABLEAU',
]);

function historyReducer(state: GameState, action: GameAction): GameState {
  if (action.type === 'UNDO') {
    const history = state.history || [];
    if (history.length === 0) return state;
    const prev = history[history.length - 1];
    return {
      ...state,
      ...prev,
      history: history.slice(0, -1),
      moves: state.moves + 1,
    };
  }

  const next = reducer(state, action);

  if (action.type === 'DEAL' || action.type === 'RESTORE') {
    return { ...next, history: [] };
  }

  if (UNDO_TRACKED.has(action.type) && next !== state) {
    const snapshot: HistorySnapshot = {
      tableau:     state.tableau,
      stock:       state.stock,
      waste:       state.waste,
      foundations: state.foundations,
      turns:       state.turns,
    };
    return { ...next, history: [...(state.history || []), snapshot] };
  }

  return next;
}

// ── DEV-338: turns replay (cross-device resume) ───────────────────────────
//
// Reconstructs an in-progress board from the seed-dealt cards + the saved
// `turns` string, by feeding each move token back through the SAME reducer that
// produced it. This is the web counterpart to iOS `GameState.replay(turns:)`,
// and the inverse of the token emission in `reducer` above — so the grammar
// stays in lock-step:
//   draw · wf · wt:<col> · tf:<col> · tt:<from>:<idx>:<to> · ft:<fi>:<to>
// Replaying through `historyReducer` also rebuilds the undo stack, so the
// resumed game behaves exactly like one played locally.
function tokenToAction(token: string): GameAction | null {
  if (token === 'draw') return { type: 'DRAW' };
  if (token === 'wf')   return { type: 'WASTE_TO_FOUNDATION' };
  const [op, a, b, c] = token.split(':');
  switch (op) {
    case 'wt': return { type: 'WASTE_TO_TABLEAU', col: Number(a) };
    case 'tf': return { type: 'TABLEAU_TO_FOUNDATION', fromCol: Number(a) };
    case 'tt': return { type: 'TABLEAU_TO_TABLEAU', fromCol: Number(a), fromIdx: Number(b), toCol: Number(c) };
    case 'ft': return { type: 'FOUNDATION_TO_TABLEAU', fi: Number(a), toCol: Number(b) };
    default:   return null; // ignore 'abandon' / unknown tokens
  }
}

export function replayTurns(cards: number[], turnsStr: string, drawMode: string): GameState {
  const dealt = dealKlondike(cards);
  let st: GameState = { ...initial, ...dealt, drawMode, history: [] };
  const tokens = (turnsStr || '').split(',').map(t => t.trim()).filter(Boolean);
  for (const tok of tokens) {
    const action = tokenToAction(tok);
    if (action) st = historyReducer(st, action);
  }
  return st;
}

// ── canAutoComplete helper ─────────────────────────────────────────────────

function checkCanAutoComplete(state: GameState): boolean {
  if (!state.tableau?.length) return false;
  // Canonical trigger (shared with iOS): every tableau card is face up AND the
  // draw pile is down to its last card (stock + waste <= 1) — all piles exposed
  // with only one card left in the deck.
  return (state.stock.length + state.waste.length) <= 1
    && state.tableau.every(pile => pile.every(c => c.faceUp));
}

// ── StartGame options ─────────────────────────────────────────────────────

export interface StartGameOptions {
  existingSessionId?: string;
  isDaily?: boolean;
  dailyDate?: string | null;
  isRanked?: boolean;
}

// ── Hook return type ──────────────────────────────────────────────────────

export interface UseGameReturn extends GameState {
  sessionId: string | null;
  handId: string | null;
  loading: boolean;
  canAutoComplete: boolean;
  canUndo: boolean;
  startTimeRef: React.MutableRefObject<number | null>;
  startGame: (handOverride?: { uuid: string; cards: number[] } | null, drawMode?: string, opts?: StartGameOptions) => Promise<void>;
  resumeGame: () => boolean;
  resumeServerGame: (args: { sessionUuid: string; handUuid: string; turns: string; timeSeconds: number; drawMode: string }) => Promise<void>;
  hasSavedSession: (forHandId?: string | null) => boolean;
  draw: () => void;
  wasteToTableau: (col: number) => void;
  wasteToFoundation: () => void;
  tableauToTableau: (fromCol: number, fromIdx: number, toCol: number) => void;
  tableauToFoundation: (fromCol: number) => void;
  foundationToTableau: (fi: number, toCol: number) => void;
  autoComplete: () => void;
  undo: () => void;
  finishGame: () => Promise<CompleteSessionResponse>;
  abandon: () => Promise<void>;
  saveProgress: (timeSeconds: number) => void;
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useGame(userId: number | null, sessionKey = SESSION_KEY): UseGameReturn {
  const [state, dispatch]   = useReducer(historyReducer, initial);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [handId, setHandId]       = useState<string | null>(null);
  const [loading, setLoading]     = useState(false);
  const startTimeRef = useRef<number | null>(null);

  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    if (!state.tableau?.length || !sessionId) return;
    saveSession(sessionId, handId!, state, state.moves, state.turns, startTimeRef.current!, sessionKey);
  }, [state, sessionId, handId, sessionKey]);

  // DEV-338: snapshot in-progress state to the SERVER so the hand can be resumed
  // on another device (e.g. web → iOS). Callers pass the pause-aware elapsed time
  // from the timer (not startTimeRef, which would count paused time). Fired when
  // the game is paused and when the tab is hidden/closed — see Game.tsx.
  const saveProgress = useCallback((timeSeconds: number): void => {
    const s = stateRef.current;
    if (!sessionId || !s.tableau?.length || s.isWon || s.moves === 0) return;
    void saveSessionProgress(
      sessionId,
      s.moves,
      Math.max(0, Math.floor(timeSeconds)),
      s.turns.join(','),
    ).catch(() => {});
  }, [sessionId]);

  const canAutoComplete = checkCanAutoComplete(state) && !state.isWon;
  const canUndo = (state.history?.length ?? 0) > 0 && !state.isWon;
  const undo    = useCallback(() => dispatch({ type: 'UNDO' }), []);

  const startGame = useCallback(async (
    handOverride: { uuid: string; cards: number[] } | null = null,
    drawMode = 'draw3',
    opts: StartGameOptions = {},
  ): Promise<void> => {
    setLoading(true);
    try {
      const hand = handOverride ?? await createHand(drawMode);
      let resolvedSessionId: string;
      if (opts.existingSessionId) {
        resolvedSessionId = opts.existingSessionId;
      } else {
        const session = await createSession(
          hand.uuid, userId!,
          opts.isDaily   ?? false,
          opts.dailyDate ?? null,
          opts.isRanked  !== undefined ? opts.isRanked : true,
        );
        resolvedSessionId = session?.session?.uuid ?? '';
      }
      const dealt = dealKlondike(hand.cards);
      setSessionId(resolvedSessionId);
      setHandId(hand.uuid);
      startTimeRef.current = Date.now();
      clearSession(sessionKey);
      dispatch({ type: 'DEAL', payload: { ...dealt, drawMode } });
    } finally {
      setLoading(false);
    }
  }, [userId, sessionKey]);

  const resumeGame = useCallback((): boolean => {
    const saved = loadSession(sessionKey);
    if (!saved) return false;
    setSessionId(saved.sessionId);
    if (saved.handId) setHandId(saved.handId);
    startTimeRef.current = saved.startTime || Date.now();
    dispatch({
      type: 'RESTORE',
      payload: {
        ...saved.gameState,
        moves: saved.moves,
        turns: saved.turns,
        isWon: false,
      },
    });
    return true;
  }, [sessionKey]);

  const hasSavedSession = useCallback((forHandId: string | null = null): boolean => {
    const saved = loadSession(sessionKey);
    if (!saved) return false;
    if (forHandId && saved.handId !== forHandId) return false;
    return true;
  }, [sessionKey]);

  // DEV-338: resume a hand that was paused on ANOTHER device (e.g. iOS → web).
  // Fetches the hand's cards, replays the server-saved turns to rebuild the
  // in-progress board, and reuses the existing session UUID so no new session is
  // created. The caller seeds the timer with `timeSeconds` so the clock resumes.
  const resumeServerGame = useCallback(async (args: {
    sessionUuid: string;
    handUuid: string;
    turns: string;
    timeSeconds: number;
    drawMode: string;
  }): Promise<void> => {
    setLoading(true);
    try {
      const hand = await getHand(args.handUuid);
      const replayed = replayTurns(hand.cards, args.turns, hand.drawMode || args.drawMode);
      setSessionId(args.sessionUuid);
      setHandId(args.handUuid);
      // Anchor the submission clock so finishGame() includes time already played.
      startTimeRef.current = Date.now() - Math.max(0, args.timeSeconds) * 1000;
      clearSession(sessionKey);
      dispatch({ type: 'RESTORE', payload: replayed });
    } finally {
      setLoading(false);
    }
  }, [sessionKey]);

  const draw               = useCallback(() => dispatch({ type: 'DRAW' }), []);
  const wasteToTableau     = useCallback((col: number) => dispatch({ type: 'WASTE_TO_TABLEAU', col }), []);
  const wasteToFoundation  = useCallback(() => dispatch({ type: 'WASTE_TO_FOUNDATION' }), []);
  const tableauToFoundation = useCallback((fromCol: number) => dispatch({ type: 'TABLEAU_TO_FOUNDATION', fromCol }), []);
  const tableauToTableau   = useCallback((fromCol: number, fromIdx: number, toCol: number) =>
    dispatch({ type: 'TABLEAU_TO_TABLEAU', fromCol, fromIdx, toCol }), []);
  const foundationToTableau = useCallback((fi: number, toCol: number) =>
    dispatch({ type: 'FOUNDATION_TO_TABLEAU', fi, toCol }), []);

  const autoComplete = useCallback((): void => {
    const speed = document.documentElement.dataset['animSpeed'] ?? 'normal';
    const delay = speed === 'slow' ? 250 : speed === 'fast' ? 30 : 80;
    let drawsSinceProgress = 0;
    const step = (): void => {
      const s = stateRef.current;
      if (s.isWon) return;
      const movesBefore = s.moves;
      dispatch({ type: 'AUTO_COMPLETE_STEP' });
      setTimeout(() => {
        const after = stateRef.current;
        if (after.moves !== movesBefore) {
          drawsSinceProgress = 0;
          step();
          return;
        }
        // No foundation move available — cycle the deck to expose more cards.
        const remaining = after.stock.length + after.waste.length;
        if (remaining > 0 && drawsSinceProgress <= remaining) {
          drawsSinceProgress++;
          dispatch({ type: 'DRAW' });
          setTimeout(step, delay);
        }
        // else: a full cycle yielded nothing — stop (rare; user finishes by hand).
      }, delay);
    };
    step();
  }, []);

  const finishGame = useCallback(async (): Promise<CompleteSessionResponse> => {
    const timeSeconds = Math.floor((Date.now() - startTimeRef.current!) / 1000);
    const winPayload: PendingWin = {
      sessionUuid: sessionId!,
      moves:       state.moves,
      timeSeconds,
      turns:       state.turns.join(','),
    };
    try {
      const result = await completeSession(
        winPayload.sessionUuid,
        winPayload.moves,
        winPayload.timeSeconds,
        winPayload.turns,
      );
      clearSession(sessionKey);
      clearPendingWin(); // clear any stale pending win from a previous crash
      return result;
    } catch (err) {
      // Network still down after all retries — persist the win so it can be
      // re-submitted when connectivity returns (see flushPendingWin).
      // The local game state is cleared regardless so the player sees the win
      // animation and is not stuck on a completed board.
      savePendingWin(winPayload);
      clearSession(sessionKey);
      throw err;
    }
  }, [sessionId, state.moves, state.turns, sessionKey]);

  const abandon = useCallback(async (): Promise<void> => {
    if (!sessionId) return;
    const timeSeconds = Math.floor((Date.now() - startTimeRef.current!) / 1000);
    clearSession(sessionKey);
    await abandonSession(sessionId, state.moves, timeSeconds, state.turns.join(',')).catch(() => {});
  }, [sessionId, state.moves, state.turns, sessionKey]);

  return {
    ...state,
    sessionId,
    handId,
    loading,
    canAutoComplete,
    canUndo,
    startTimeRef,
    startGame,
    resumeGame,
    resumeServerGame,
    hasSavedSession,
    draw,
    wasteToTableau,
    wasteToFoundation,
    tableauToTableau,
    tableauToFoundation,
    foundationToTableau,
    autoComplete,
    undo,
    finishGame,
    abandon,
    saveProgress,
  };
}
