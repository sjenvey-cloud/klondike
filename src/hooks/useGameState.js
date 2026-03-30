import { useState, useEffect, useCallback, useRef } from 'react';
import {
  buildGameState,
  canPlaceOnTableau,
  canPlaceOnFoundation,
  isGameWon,
  applyDrawStock,
  cloneState,
  MOVE_TYPES,
} from '../utils/gameEngine';
import { shuffleDeck, saveDeck, saveDeal, markDeckSolved, abandonDeal } from '../services/api';

const DRAW_COUNT = 3; // DEV-58: 3-card draw is the default mode

export const useGameState = (user) => {
  const [gameState, setGameState]   = useState(null);
  const [deckId, setDeckId]         = useState(null);
  const [moves, setMoves]           = useState(0);
  const [elapsed, setElapsed]       = useState(0);
  const [gameWon, setGameWon]       = useState(false);
  const [loading, setLoading]       = useState(false);
  const [canUndo, setCanUndo]       = useState(false);

  // History stacks for undo (DEV-56) and move replay (DEV-59)
  const stateHistory  = useRef([]); // stack of cloned game states
  const moveHistory   = useRef([]); // serialised move labels for server replay
  const timerRef      = useRef(null);
  const currentDeckId = useRef(null);

  // ── Timer ──────────────────────────────────────────
  useEffect(() => {
    if (gameState && !gameWon) {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [gameState, gameWon]);

  // ── Internal: push a state snapshot before every move ──
  const pushHistory = (state) => {
    stateHistory.current.push(cloneState(state));
    setCanUndo(true);
  };

  // ── Internal: apply state update and record move ───
  const applyMove = useCallback((updater, moveLabel) => {
    setGameState(prev => {
      if (!prev) return prev;
      pushHistory(prev);
      const next = updater(cloneState(prev));
      if (next === prev) {
        // Move was rejected — pop the history we just pushed
        stateHistory.current.pop();
        setCanUndo(stateHistory.current.length > 0);
        return prev;
      }
      moveHistory.current.push(moveLabel);
      return next;
    });
    setMoves(m => m + 1);
  }, []);

  // ── New Game ───────────────────────────────────────
  const newGame = useCallback(async () => {
    setLoading(true);
    clearInterval(timerRef.current);
    try {
      const data = await shuffleDeck();
      const ids = Array.from({ length: 52 }, (_, i) => data[`card${i + 1}`]);

      const saved = await saveDeck(ids);
      const id = saved.id;
      setDeckId(id);
      currentDeckId.current = id;

      const initial = buildGameState(ids, DRAW_COUNT);
      setGameState(initial);
      setMoves(0);
      setElapsed(0);
      setGameWon(false);
      setCanUndo(false);
      stateHistory.current  = [];
      moveHistory.current   = [];
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Draw from stock (DEV-15, DEV-58) ──────────────
  const drawFromStock = useCallback(() => {
    setGameState(prev => {
      if (!prev) return prev;
      pushHistory(prev);
      const next = applyDrawStock(prev);
      moveHistory.current.push(MOVE_TYPES.DRAW_STOCK);
      return next;
    });
    setMoves(m => m + 1);
  }, []);

  // ── Move card(s) to tableau ────────────────────────
  const moveToTableau = useCallback((card, fromLocation, toCol) => {
    setGameState(prev => {
      if (!prev) return prev;
      const targetPile = prev.tableau[toCol];
      if (!canPlaceOnTableau(card, targetPile)) return prev;

      pushHistory(prev);
      const state = cloneState(prev);

      if (fromLocation.type === 'waste') {
        state.waste.pop();
        state.tableau[toCol].push({ ...card });
        moveHistory.current.push(MOVE_TYPES.WASTE_TO_TABLEAU);
      } else if (fromLocation.type === 'tableau') {
        const srcPile = state.tableau[fromLocation.col];
        const cardIdx = srcPile.findIndex(c => c.id === card.id);
        const moving = srcPile.splice(cardIdx);
        state.tableau[toCol].push(...moving);
        if (srcPile.length > 0) srcPile[srcPile.length - 1].faceUp = true;
        moveHistory.current.push(
          `${MOVE_TYPES.TABLEAU_TO_TABLEAU}:${fromLocation.col}:${toCol}`
        );
      }
      return state;
    });
    setMoves(m => m + 1);
  }, []);

  // ── Move card to foundation ────────────────────────
  const moveToFoundation = useCallback((card, fromLocation) => {
    setGameState(prev => {
      if (!prev) return prev;
      const fIdx = SUITS.indexOf(card.suit);
      if (!canPlaceOnFoundation(card, prev.foundations[fIdx])) return prev;

      pushHistory(prev);
      const state = cloneState(prev);

      if (fromLocation.type === 'waste') {
        state.waste.pop();
        moveHistory.current.push(MOVE_TYPES.WASTE_TO_FOUNDATION);
      } else if (fromLocation.type === 'tableau') {
        const srcPile = state.tableau[fromLocation.col];
        srcPile.pop();
        if (srcPile.length > 0) srcPile[srcPile.length - 1].faceUp = true;
        moveHistory.current.push(
          `${MOVE_TYPES.TABLEAU_TO_FOUNDATION}:${fromLocation.col}`
        );
      }
      state.foundations[fIdx].push({ ...card, faceUp: true });

      if (isGameWon(state.foundations)) {
        setGameWon(true);
        clearInterval(timerRef.current);
      }
      return state;
    });
    setMoves(m => m + 1);
  }, []);

  // ── Undo last move (DEV-56, unlimited) ────────────
  const undo = useCallback(() => {
    if (stateHistory.current.length === 0) return;
    const prev = stateHistory.current.pop();
    moveHistory.current.pop();
    setGameState(prev);
    setMoves(m => Math.max(0, m - 1));
    setCanUndo(stateHistory.current.length > 0);
  }, []);

  // ── Abandon game (DEV-57) ─────────────────────────
  const abandonGame = useCallback(async () => {
    if (!user || !currentDeckId.current) return;
    clearInterval(timerRef.current);
    moveHistory.current.push(MOVE_TYPES.ABANDON);
    try {
      await saveDeal({
        moves,
        timeseconds: elapsed,
        turns: moveHistory.current.join(','),
        deckid: currentDeckId.current,
        userid: user.id,
        status: 'abandoned',
      });
    } catch (e) {
      console.warn('Failed to save abandoned deal:', e);
    }
    // Start a new game
    newGame();
  }, [user, moves, elapsed, newGame]);

  // ── Save completed deal ────────────────────────────
  const saveResult = useCallback(async () => {
    if (!user || !currentDeckId.current) return;
    try {
      await markDeckSolved(currentDeckId.current, `Solved in ${moves} moves`);
      await saveDeal({
        moves,
        timeseconds: elapsed,
        turns: moveHistory.current.join(','),
        deckid: currentDeckId.current,
        userid: user.id,
      });
    } catch (e) {
      console.warn('Failed to save deal result:', e);
    }
  }, [user, moves, elapsed]);

  useEffect(() => {
    if (gameWon) saveResult();
  }, [gameWon]);

  return {
    gameState,
    moves,
    elapsed,
    gameWon,
    loading,
    canUndo,
    deckId,
    drawCount: DRAW_COUNT,
    newGame,
    drawFromStock,
    moveToTableau,
    moveToFoundation,
    undo,
    abandonGame,
  };
};

// Needed internally — re-export for convenience
const SUITS = ['clubs', 'diamonds', 'hearts', 'spades'];
