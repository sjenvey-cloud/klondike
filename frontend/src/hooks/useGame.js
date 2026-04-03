import { useReducer, useState, useRef, useCallback } from 'react';
import {
  dealKlondike, canPlaceOnTableau, canPlaceOnFoundation,
  isGameWon, foundationIndex,
} from '../services/gameLogic';
import { createHand, createSession, completeSession, abandonSession } from '../services/api';

const initial = {
  tableau: null, stock: null, waste: null, foundations: null,
  moves: 0, turns: [], isWon: false,
};

function reducer(state, action) {
  switch (action.type) {

    case 'DEAL':
      return { ...initial, ...action.payload };

    case 'DRAW': {
      let stock = [...state.stock];
      let waste = [...state.waste];
      if (stock.length === 0) {
        // Flip waste back
        stock = [...waste].reverse().map(c => ({ card: c.card, faceUp: false }));
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

    default:
      return state;
  }
}

export function useGame(userId) {
  const [state, dispatch] = useReducer(reducer, initial);
  const [sessionId, setSessionId] = useState(null);
  const [loading, setLoading] = useState(false);
  const startTimeRef = useRef(null);

  const startGame = useCallback(async (handOverride = null) => {
    setLoading(true);
    try {
      const hand = handOverride || await createHand();
      const session = await createSession(hand.id, userId);
      const dealt = dealKlondike(hand.cards);
      setSessionId(session.id);
      startTimeRef.current = Date.now();
      dispatch({ type: 'DEAL', payload: dealt });
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const draw               = useCallback(() => dispatch({ type: 'DRAW' }), []);
  const wasteToTableau     = useCallback((col)              => dispatch({ type: 'WASTE_TO_TABLEAU', col }), []);
  const wasteToFoundation  = useCallback(()                 => dispatch({ type: 'WASTE_TO_FOUNDATION' }), []);
  const tableauToFoundation = useCallback((fromCol)         => dispatch({ type: 'TABLEAU_TO_FOUNDATION', fromCol }), []);
  const tableauToTableau   = useCallback((fromCol, fromIdx, toCol) =>
    dispatch({ type: 'TABLEAU_TO_TABLEAU', fromCol, fromIdx, toCol }), []);

  const finishGame = useCallback(async () => {
    const timeSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
    return completeSession(sessionId, state.moves, timeSeconds, state.turns.join(','));
  }, [sessionId, state.moves, state.turns]);

  const abandon = useCallback(async () => {
    if (!sessionId) return;
    const timeSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
    return abandonSession(sessionId, state.moves, timeSeconds, state.turns.join(','));
  }, [sessionId, state.moves, state.turns]);

  return {
    ...state,
    sessionId,
    loading,
    startGame,
    draw,
    wasteToTableau,
    wasteToFoundation,
    tableauToTableau,
    tableauToFoundation,
    finishGame,
    abandon,
  };
}
