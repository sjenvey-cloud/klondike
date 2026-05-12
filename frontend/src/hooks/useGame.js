import { useReducer, useState, useRef, useCallback, useEffect } from 'react';
import {
  dealKlondike, canPlaceOnTableau, canPlaceOnFoundation,
  isGameWon, foundationIndex, getRank,
} from '../services/gameLogic';
import { createHand, createSession, completeSession, abandonSession } from '../services/api';

// ── DEV-66: Session persistence ────────────────────────────────────────────
const SESSION_KEY = 'klondike_session';

function saveSession(sessionId, handId, gameState, moves, turns, startTime) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
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

function loadSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch { return null; }
}

export function clearSavedSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

// ── Reducer ────────────────────────────────────────────────────────────────

const initial = {
  tableau: null, stock: null, waste: null, foundations: null,
  moves: 0, turns: [], isWon: false, drawMode: 'draw3',
  history: [], // undo stack — each entry is a pre-move snapshot
};

function reducer(state, action) {
  switch (action.type) {

    case 'DEAL':
      return { ...initial, ...action.payload };

    case 'RESTORE':
      return { ...initial, ...action.payload };

    case 'DRAW': {
      let stock = [...state.stock];
      let waste = [...state.waste];
      if (stock.length === 0) {
        // Flip waste pile back to stock — bottom of waste becomes top of new stock,
        // preserving the same draw order as the previous pass through the deck.
        stock = [...waste].map(c => ({ card: c.card, faceUp: false }));
        waste = [];
      } else {
        const count = Math.min(3, stock.length);
        for (let i = 0; i < count; i++) {
          const c = stock.shift();
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

    // DEV-62: move one card to foundation
    case 'AUTO_COMPLETE_STEP': {
      const tableau = state.tableau.map(p => [...p]);
      const foundations = state.foundations.map(p => [...p]);

      // Collect all face-up top cards from waste + tableau, pick lowest rank that can go to foundation
      const candidates = [];
      if (state.waste.length > 0) {
        const c = state.waste[state.waste.length - 1];
        const fi = foundationIndex(c.card);
        if (canPlaceOnFoundation(c.card, foundations[fi])) {
          candidates.push({ source: 'waste', rank: getRank(c.card) });
        }
      }
      for (let col = 0; col < tableau.length; col++) {
        const pile = tableau[col];
        if (!pile.length) continue;
        const top = pile[pile.length - 1];
        if (!top.faceUp) continue;
        const fi = foundationIndex(top.card);
        if (canPlaceOnFoundation(top.card, foundations[fi])) {
          candidates.push({ source: 'tableau', col, rank: getRank(top.card) });
        }
      }

      // No direct foundation move — draw from stock/waste to advance
      if (candidates.length === 0) {
        const stockEmpty = state.stock.length === 0;
        const wasteEmpty = state.waste.length === 0;
        if (stockEmpty && wasteEmpty) return state;

        let stock = [...state.stock];
        let waste = [...state.waste];
        if (stock.length === 0) {
          // Flip waste back to stock (same order as DRAW action)
          stock = waste.map(c => ({ card: c.card, faceUp: false }));
          waste = [];
        } else {
          const drawCount = Math.min(state.drawMode === 'draw1' ? 1 : 3, stock.length);
          for (let i = 0; i < drawCount; i++) {
            const c = stock.shift();
            waste.push({ card: c.card, faceUp: true });
          }
        }
        return { ...state, stock, waste, moves: state.moves + 1, turns: [...state.turns, 'draw'] };
      }

      // Pick the candidate with the lowest rank (safest move)
      candidates.sort((a, b) => a.rank - b.rank);
      const pick = candidates[0];

      let waste = state.waste;
      let turns = [...state.turns];

      if (pick.source === 'waste') {
        const top = waste[waste.length - 1];
        const fi = foundationIndex(top.card);
        foundations[fi].push(top.card);
        waste = waste.slice(0, -1);
        turns.push('wf');
      } else {
        const pile = tableau[pick.col];
        const top = pile[pile.length - 1];
        const fi = foundationIndex(top.card);
        foundations[fi].push(top.card);
        tableau[pick.col] = pile.slice(0, -1);
        if (tableau[pick.col].length > 0) {
          const last = tableau[pick.col].length - 1;
          if (!tableau[pick.col][last].faceUp) {
            tableau[pick.col][last] = { ...tableau[pick.col][last], faceUp: true };
          }
        }
        turns.push(`tf:${pick.col}`);
      }

      return {
        ...state,
        tableau,
        waste,
        foundations,
        isWon: isGameWon(foundations),
        moves: state.moves + 1,
        turns,
      };
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
// Wraps the inner reducer. Move actions push a snapshot before applying;
// UNDO pops the stack and restores the previous state (costs one move).
// AUTO_COMPLETE_STEP is intentionally excluded so autocomplete can't be undone.

const UNDO_TRACKED = new Set([
  'DRAW', 'WASTE_TO_TABLEAU', 'WASTE_TO_FOUNDATION',
  'TABLEAU_TO_TABLEAU', 'TABLEAU_TO_FOUNDATION', 'FOUNDATION_TO_TABLEAU',
]);

function historyReducer(state, action) {
  if (action.type === 'UNDO') {
    const history = state.history || [];
    if (history.length === 0) return state;
    const prev = history[history.length - 1];
    return {
      ...state,
      ...prev,
      history: history.slice(0, -1),
      moves: state.moves + 1, // undo counts as a move
    };
  }

  const next = reducer(state, action);

  // DEAL / RESTORE always reset history
  if (action.type === 'DEAL' || action.type === 'RESTORE') {
    return { ...next, history: [] };
  }

  // For tracked move actions, snapshot pre-move state if something changed
  if (UNDO_TRACKED.has(action.type) && next !== state) {
    const snapshot = {
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

// ── canAutoComplete helper ─────────────────────────────────────────────────
// True when all tableau cards are face-up (stock/waste are drained by the
// auto-complete stepper itself, so they don't need to be empty first).
function checkCanAutoComplete(state) {
  if (!state.tableau) return false;
  return state.tableau.every(pile => pile.every(c => c.faceUp));
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useGame(userId) {
  const [state, dispatch]   = useReducer(historyReducer, initial);
  const [sessionId, setSessionId] = useState(null);
  const [handId, setHandId]       = useState(null);
  const [loading, setLoading]     = useState(false);
  const startTimeRef = useRef(null);

  // Track previous state for session save
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  // DEV-66: save to sessionStorage after every move
  useEffect(() => {
    if (!state.tableau || !sessionId) return;
    saveSession(sessionId, handId, state, state.moves, state.turns, startTimeRef.current);
  }, [state, sessionId, handId]);

  // DEV-62: canAutoComplete flag
  const canAutoComplete = checkCanAutoComplete(state) && !state.isWon;

  // Undo: available whenever there's history and the game isn't won
  const canUndo = (state.history?.length ?? 0) > 0 && !state.isWon;
  const undo    = useCallback(() => dispatch({ type: 'UNDO' }), []);

  const startGame = useCallback(async (handOverride = null, drawMode = 'draw3', opts = {}) => {
    setLoading(true);
    try {
      const hand = handOverride || await createHand(drawMode);
      let resolvedSessionId;
      if (opts.existingSessionId) {
        // DEV-203: resuming a server-side active session — skip session creation
        resolvedSessionId = opts.existingSessionId;
      } else {
        const session = await createSession(
          hand.uuid, userId,
          opts.isDaily   || false,
          opts.dailyDate || null,
          opts.isRanked  !== undefined ? opts.isRanked : true,
        );
        resolvedSessionId = session?.session?.uuid ?? session?.uuid;
      }
      const dealt = dealKlondike(hand.cards);
      setSessionId(resolvedSessionId);
      setHandId(hand.uuid);
      startTimeRef.current = Date.now();
      clearSavedSession();
      dispatch({ type: 'DEAL', payload: { ...dealt, drawMode } });
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // DEV-66: resume from sessionStorage (sessionId and handId are now UUIDs)
  const resumeGame = useCallback(() => {
    const saved = loadSession();
    if (!saved) return false;
    setSessionId(saved.sessionId);
    if (saved.handId) setHandId(saved.handId); // stored value is now a UUID string
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
  }, []);

  const hasSavedSession = useCallback(() => !!loadSession(), []);

  const draw               = useCallback(() => dispatch({ type: 'DRAW' }), []);
  const wasteToTableau     = useCallback((col)              => dispatch({ type: 'WASTE_TO_TABLEAU', col }), []);
  const wasteToFoundation  = useCallback(()                 => dispatch({ type: 'WASTE_TO_FOUNDATION' }), []);
  const tableauToFoundation = useCallback((fromCol)         => dispatch({ type: 'TABLEAU_TO_FOUNDATION', fromCol }), []);
  const tableauToTableau   = useCallback((fromCol, fromIdx, toCol) =>
    dispatch({ type: 'TABLEAU_TO_TABLEAU', fromCol, fromIdx, toCol }), []);
  const foundationToTableau = useCallback((fi, toCol)       => dispatch({ type: 'FOUNDATION_TO_TABLEAU', fi, toCol }), []);

  // DEV-62: auto-complete — dispatch steps until won or no progress
  const autoComplete = useCallback(() => {
    let maxSteps = 52; // safety cap
    const step = () => {
      // peek at current state via ref
      const s = stateRef.current;
      if (s.isWon || maxSteps-- <= 0) return;
      dispatch({ type: 'AUTO_COMPLETE_STEP' });
      // schedule next step with a small delay for visual effect
      setTimeout(step, 80);
    };
    step();
  }, []);

  const finishGame = useCallback(async () => {
    const timeSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
    const result = await completeSession(sessionId, state.moves, timeSeconds, state.turns.join(','));
    clearSavedSession();
    return result;
  }, [sessionId, state.moves, state.turns]);

  const abandon = useCallback(async () => {
    if (!sessionId) return;
    const timeSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
    clearSavedSession();
    return abandonSession(sessionId, state.moves, timeSeconds, state.turns.join(','));
  }, [sessionId, state.moves, state.turns]);

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
  };
}
