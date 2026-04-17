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
        turns: [...state.turns, `tt:${fromCol}:${toCol}`],
      };
    }

    // DEV-62: move one card to foundation
    case 'AUTO_COMPLETE_STEP': {
      const tableau = state.tableau.map(p => [...p]);
      const foundations = state.foundations.map(p => [...p]);
      let moved = false;

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
      if (candidates.length === 0) return state;

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
        moved = true;
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
        moved = true;
      }

      if (!moved) return state;

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

    default:
      return state;
  }
}

// ── canAutoComplete helper ─────────────────────────────────────────────────
// True when stock+waste are empty and all tableau cards are face-up
function checkCanAutoComplete(state) {
  if (!state.tableau) return false;
  if (state.stock && state.stock.length > 0) return false;
  if (state.waste && state.waste.length > 0) return false;
  return state.tableau.every(pile => pile.every(c => c.faceUp));
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useGame(userId) {
  const [state, dispatch]   = useReducer(reducer, initial);
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

  const startGame = useCallback(async (handOverride = null, drawMode = 'draw3', opts = {}) => {
    setLoading(true);
    try {
      const hand    = handOverride || await createHand(drawMode);
      const session = await createSession(
        hand.id, userId,
        opts.isDaily   || false,
        opts.dailyDate || null,
        opts.isRanked  !== undefined ? opts.isRanked : true,
      );
      const dealt   = dealKlondike(hand.cards);
      setSessionId(session.id);
      setHandId(hand.id);
      startTimeRef.current = Date.now();
      clearSavedSession();
      dispatch({ type: 'DEAL', payload: { ...dealt, drawMode } });
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // DEV-66: resume from sessionStorage
  const resumeGame = useCallback(() => {
    const saved = loadSession();
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
  }, []);

  const hasSavedSession = useCallback(() => !!loadSession(), []);

  const draw               = useCallback(() => dispatch({ type: 'DRAW' }), []);
  const wasteToTableau     = useCallback((col)              => dispatch({ type: 'WASTE_TO_TABLEAU', col }), []);
  const wasteToFoundation  = useCallback(()                 => dispatch({ type: 'WASTE_TO_FOUNDATION' }), []);
  const tableauToFoundation = useCallback((fromCol)         => dispatch({ type: 'TABLEAU_TO_FOUNDATION', fromCol }), []);
  const tableauToTableau   = useCallback((fromCol, fromIdx, toCol) =>
    dispatch({ type: 'TABLEAU_TO_TABLEAU', fromCol, fromIdx, toCol }), []);

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
    startGame,
    resumeGame,
    hasSavedSession,
    draw,
    wasteToTableau,
    wasteToFoundation,
    tableauToTableau,
    tableauToFoundation,
    autoComplete,
    finishGame,
    abandon,
  };
}
