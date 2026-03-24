import { useState, useEffect, useCallback, useRef } from 'react';
import { buildGameState, canPlaceOnTableau, canPlaceOnFoundation, isGameWon } from '../utils/gameEngine';
import { shuffleDeck, saveDeck, saveDeal, markDeckSolved } from '../services/api';

export const useGameState = (user) => {
  const [gameState, setGameState] = useState(null);
  const [deckId, setDeckId] = useState(null);
  const [, setCardOrder] = useState([]);
  const [moves, setMoves] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [gameWon, setGameWon] = useState(false);
  const [loading, setLoading] = useState(false);
  const moveHistory = useRef([]);
  const timerRef = useRef(null);

  // ── Timer ─────────────────────────────────────────
  useEffect(() => {
    if (gameState && !gameWon) {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [gameState, gameWon]);

  // ── New Game ──────────────────────────────────────
  const newGame = useCallback(async () => {
    setLoading(true);
    try {
      const data = await shuffleDeck();
      // API returns { card1: n, card2: n, ... card52: n }
      const ids = Array.from({ length: 52 }, (_, i) => data[`card${i + 1}`]);
      setCardOrder(ids);

      const saved = await saveDeck(ids);
      setDeckId(saved.id);

      setGameState(buildGameState(ids));
      setMoves(0);
      setElapsed(0);
      setGameWon(false);
      moveHistory.current = [];
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Draw from stock ───────────────────────────────
  const drawFromStock = useCallback(() => {
    setGameState(prev => {
      if (!prev) return prev;
      let { stock, waste } = prev;
      if (stock.length === 0) {
        // Flip waste back to stock
        stock = [...waste].reverse().map(c => ({ ...c, faceUp: false }));
        waste = [];
      } else {
        const [top, ...rest] = stock;
        waste = [...waste, { ...top, faceUp: true }];
        stock = rest;
      }
      return { ...prev, stock, waste };
    });
    setMoves(m => m + 1);
    moveHistory.current.push('stock');
  }, []);

  // ── Move card(s) to tableau ───────────────────────
  const moveToTableau = useCallback((card, fromLocation, toCol) => {
    setGameState(prev => {
      if (!prev) return prev;
      const state = JSON.parse(JSON.stringify(prev));
      const targetPile = state.tableau[toCol];
      if (!canPlaceOnTableau(card, targetPile)) return prev;

      // Remove from source
      if (fromLocation.type === 'waste') {
        state.waste.pop();
      } else if (fromLocation.type === 'tableau') {
        const srcPile = state.tableau[fromLocation.col];
        const cardIdx = srcPile.findIndex(c => c.id === card.id);
        const moving = srcPile.splice(cardIdx);
        targetPile.push(...moving);
        // Flip new top card of source pile
        if (srcPile.length > 0) srcPile[srcPile.length - 1].faceUp = true;
        return state;
      }
      targetPile.push({ ...card });
      return state;
    });
    setMoves(m => m + 1);
    moveHistory.current.push(`t${toCol}`);
  }, []);

  // ── Move card to foundation ───────────────────────
  const moveToFoundation = useCallback((card, fromLocation) => {
    setGameState(prev => {
      if (!prev) return prev;
      const state = JSON.parse(JSON.stringify(prev));
      const suits = ['clubs', 'diamonds', 'hearts', 'spades'];
      const fIdx = suits.indexOf(card.suit);
      if (!canPlaceOnFoundation(card, state.foundations[fIdx])) return prev;

      if (fromLocation.type === 'waste') {
        state.waste.pop();
      } else if (fromLocation.type === 'tableau') {
        const srcPile = state.tableau[fromLocation.col];
        srcPile.pop();
        if (srcPile.length > 0) srcPile[srcPile.length - 1].faceUp = true;
      }
      state.foundations[fIdx].push({ ...card, faceUp: true });

      // Check win
      if (isGameWon(state.foundations)) {
        setGameWon(true);
        clearInterval(timerRef.current);
      }
      return state;
    });
    setMoves(m => m + 1);
    moveHistory.current.push(`f`);
  }, []);

  // ── Save completed deal ───────────────────────────
  const saveResult = useCallback(async () => {
    if (!user || !deckId) return;
    await markDeckSolved(deckId, `Solved in ${moves} moves`);
    await saveDeal({
      moves,
      timeseconds: elapsed,
      turns: moveHistory.current.join(','),
      deckid: deckId,
      userid: user.id,
    });
  }, [user, deckId, moves, elapsed]);

  useEffect(() => {
    if (gameWon) saveResult();
  }, [gameWon]);

  return {
    gameState, moves, elapsed, gameWon, loading, deckId,
    newGame, drawFromStock, moveToTableau, moveToFoundation,
  };
};
