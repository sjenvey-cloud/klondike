/**
 * DEV-220: Pure replay logic — reconstructs board state snapshots from a
 * ReplayResponse (move list + card deal order).
 *
 * No React, no hooks — safe to call outside component lifecycle.
 */
import {
  dealKlondike,
  canPlaceOnTableau,
  canPlaceOnFoundation,
  foundationIndex,
  getRank,
  getSuit,
  rankLabel,
} from './gameLogic';
import type { CardInPile, BoardState } from './gameLogic';
import type { ReplayMove } from '../types/api';

// ── Replay state includes drawMode ────────────────────────────────────────
export interface ReplayState extends BoardState {
  drawMode: string;
}

// ── Move appliers ─────────────────────────────────────────────────────────
// Each function takes the current board state and returns a new state.

function applyDraw(state: ReplayState): ReplayState {
  let stock = [...state.stock];
  let waste = [...state.waste];
  const drawCount = state.drawMode === 'draw1' ? 1 : 3;

  if (stock.length === 0) {
    stock = waste.map(c => ({ card: c.card, faceUp: false }));
    waste = [];
  } else {
    const count = Math.min(drawCount, stock.length);
    for (let i = 0; i < count; i++) {
      const c = stock.shift()!;
      waste.push({ card: c.card, faceUp: true });
    }
  }
  return { ...state, stock, waste };
}

function applyWasteToTableau(state: ReplayState, col: number): ReplayState {
  if (!state.waste.length) return state;
  const top     = state.waste[state.waste.length - 1];
  const tableau = state.tableau.map(p => [...p]);
  if (!canPlaceOnTableau(top.card, tableau[col])) return state;
  tableau[col].push({ card: top.card, faceUp: true });
  return { ...state, waste: state.waste.slice(0, -1), tableau };
}

function applyWasteToFoundation(state: ReplayState): ReplayState {
  if (!state.waste.length) return state;
  const top         = state.waste[state.waste.length - 1];
  const fi          = foundationIndex(top.card);
  const foundations = state.foundations.map(p => [...p]);
  if (!canPlaceOnFoundation(top.card, foundations[fi])) return state;
  foundations[fi].push(top.card);
  return { ...state, waste: state.waste.slice(0, -1), foundations };
}

function applyTableauToTableau(
  state: ReplayState,
  fromCol: number,
  fromIdx: number | undefined,
  toCol: number,
): ReplayState {
  const tableau  = state.tableau.map(p => [...p]);
  const fromPile = tableau[fromCol];

  let startIdx = fromIdx;
  if (startIdx == null) {
    startIdx = fromPile.findIndex(c => c.faceUp);
    if (startIdx < 0) return state;
  }

  if (startIdx >= fromPile.length || !fromPile[startIdx].faceUp) return state;
  const stack = fromPile.slice(startIdx);
  if (!canPlaceOnTableau(stack[0].card, tableau[toCol])) return state;

  tableau[fromCol] = fromPile.slice(0, startIdx);
  if (tableau[fromCol].length > 0) {
    const last = tableau[fromCol].length - 1;
    if (!tableau[fromCol][last].faceUp) {
      tableau[fromCol][last] = { ...tableau[fromCol][last], faceUp: true };
    }
  }
  tableau[toCol] = [...tableau[toCol], ...stack];
  return { ...state, tableau };
}

function applyTableauToFoundation(state: ReplayState, fromCol: number): ReplayState {
  const tableau = state.tableau.map(p => [...p]);
  const pile    = tableau[fromCol];
  if (!pile.length || !pile[pile.length - 1].faceUp) return state;

  const top         = pile[pile.length - 1];
  const fi          = foundationIndex(top.card);
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
  return { ...state, tableau, foundations };
}

function applyFoundationToTableau(state: ReplayState, fi: number, toCol: number): ReplayState {
  const foundations = state.foundations.map(p => [...p]);
  if (!foundations[fi].length) return state;

  const card    = foundations[fi][foundations[fi].length - 1];
  const tableau = state.tableau.map(p => [...p]);
  if (!canPlaceOnTableau(card, tableau[toCol])) return state;

  foundations[fi] = foundations[fi].slice(0, -1);
  tableau[toCol].push({ card, faceUp: true });
  return { ...state, foundations, tableau };
}

function applyMove(state: ReplayState, move: ReplayMove): ReplayState {
  switch (move.type) {
    case 'draw': return applyDraw(state);
    case 'wt':   return applyWasteToTableau(state, move.col!);
    case 'wf':   return applyWasteToFoundation(state);
    case 'tt':   return applyTableauToTableau(state, move.fromCol!, move.fromIdx, move.toCol!);
    case 'tf':   return applyTableauToFoundation(state, move.col!);
    case 'ft':   return applyFoundationToTableau(state, move.fi!, move.toCol!);
    default:     return state;
  }
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Build the complete list of board states for a replay.
 */
export function buildReplayStates(
  cards: number[],
  moves: ReplayMove[],
  drawMode = 'draw3',
): ReplayState[] {
  const initial: ReplayState = { ...dealKlondike(cards), drawMode };
  const states: ReplayState[] = [initial];

  for (const move of moves) {
    const prev = states[states.length - 1];
    const next = applyMove(prev, move);
    states.push(next);
  }
  return states;
}

/**
 * Return a human-readable description for a move, including the card name.
 */
export function describeMove(
  move: ReplayMove | null,
  prevState: ReplayState | null,
): string {
  if (!move || !prevState) return 'Initial position';

  const cardName = (cardId: number | undefined): string => {
    if (cardId == null) return '';
    const r = getRank(cardId);
    const s = getSuit(cardId);
    return `${rankLabel(r)}${s.symbol}`;
  };

  switch (move.type) {
    case 'draw': {
      if (prevState.stock.length === 0) return 'Flip waste to stock';
      const drawCount = prevState.drawMode === 'draw1' ? 1 : 3;
      const n = Math.min(drawCount, prevState.stock.length);
      return `Draw ${n} from stock`;
    }
    case 'wt': {
      const top = prevState.waste[prevState.waste.length - 1] as CardInPile | undefined;
      return `${cardName(top?.card)} → Column ${(move.col ?? 0) + 1}`;
    }
    case 'wf': {
      const top = prevState.waste[prevState.waste.length - 1] as CardInPile | undefined;
      return `${cardName(top?.card)} → Foundation`;
    }
    case 'tt': {
      const pile = prevState.tableau[move.fromCol!];
      const idx  = move.fromIdx ?? pile.findIndex(c => c.faceUp);
      const card = pile[idx] ? cardName(pile[idx].card) : '';
      return `${card} → Column ${(move.toCol ?? 0) + 1}`;
    }
    case 'tf': {
      const pile = prevState.tableau[move.col!];
      const card = pile.length ? cardName(pile[pile.length - 1].card) : '';
      return `${card} → Foundation`;
    }
    case 'ft': {
      const f    = prevState.foundations[move.fi!];
      const card = f.length ? cardName(f[f.length - 1]) : '';
      return `${card} → Column ${(move.toCol ?? 0) + 1}`;
    }
    default:
      return move.type;
  }
}
