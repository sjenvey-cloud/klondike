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

// ── Move appliers ─────────────────────────────────────────────────────────
// Each function takes the current board state and returns a new state.
// State shape: { tableau, stock, waste, foundations, drawMode }
// tableau: [{ card: id, faceUp: bool }][] (7 piles)
// stock:   [{ card: id, faceUp: bool }]   (index 0 = top, drawn first via shift)
// waste:   [{ card: id, faceUp: bool }]   (last element = top / visible)
// foundations: number[][]                  (4 piles of raw card IDs)

function applyDraw(state) {
  let stock = [...state.stock];
  let waste = [...state.waste];
  const drawCount = state.drawMode === 'draw1' ? 1 : 3;

  if (stock.length === 0) {
    // Flip waste back to stock: waste[0] (bottom / first drawn) becomes stock[0] (top)
    stock = waste.map(c => ({ card: c.card, faceUp: false }));
    waste = [];
  } else {
    const count = Math.min(drawCount, stock.length);
    for (let i = 0; i < count; i++) {
      const c = stock.shift(); // draw from top (index 0)
      waste.push({ card: c.card, faceUp: true });
    }
  }
  return { ...state, stock, waste };
}

function applyWasteToTableau(state, col) {
  if (!state.waste.length) return state;
  const top     = state.waste[state.waste.length - 1];
  const tableau = state.tableau.map(p => [...p]);
  if (!canPlaceOnTableau(top.card, tableau[col])) return state;
  tableau[col].push({ card: top.card, faceUp: true });
  return { ...state, waste: state.waste.slice(0, -1), tableau };
}

function applyWasteToFoundation(state) {
  if (!state.waste.length) return state;
  const top         = state.waste[state.waste.length - 1];
  const fi          = foundationIndex(top.card);
  const foundations = state.foundations.map(p => [...p]);
  if (!canPlaceOnFoundation(top.card, foundations[fi])) return state;
  foundations[fi].push(top.card);
  return { ...state, waste: state.waste.slice(0, -1), foundations };
}

function applyTableauToTableau(state, fromCol, fromIdx, toCol) {
  const tableau   = state.tableau.map(p => [...p]);
  const fromPile  = tableau[fromCol];

  // Legacy token (tt:from:to without fromIdx): infer first face-up card
  let startIdx = fromIdx;
  if (startIdx == null) {
    startIdx = fromPile.findIndex(c => c.faceUp);
    if (startIdx < 0) return state;
  }

  if (startIdx >= fromPile.length || !fromPile[startIdx].faceUp) return state;
  const stack = fromPile.slice(startIdx);
  if (!canPlaceOnTableau(stack[0].card, tableau[toCol])) return state;

  tableau[fromCol] = fromPile.slice(0, startIdx);
  // Flip newly exposed card
  if (tableau[fromCol].length > 0) {
    const last = tableau[fromCol].length - 1;
    if (!tableau[fromCol][last].faceUp) {
      tableau[fromCol][last] = { ...tableau[fromCol][last], faceUp: true };
    }
  }
  tableau[toCol] = [...tableau[toCol], ...stack];
  return { ...state, tableau };
}

function applyTableauToFoundation(state, fromCol) {
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

function applyFoundationToTableau(state, fi, toCol) {
  const foundations = state.foundations.map(p => [...p]);
  if (!foundations[fi].length) return state;

  const card    = foundations[fi][foundations[fi].length - 1];
  const tableau = state.tableau.map(p => [...p]);
  if (!canPlaceOnTableau(card, tableau[toCol])) return state;

  foundations[fi] = foundations[fi].slice(0, -1);
  tableau[toCol].push({ card, faceUp: true });
  return { ...state, foundations, tableau };
}

function applyMove(state, move) {
  switch (move.type) {
    case 'draw': return applyDraw(state);
    case 'wt':   return applyWasteToTableau(state, move.col);
    case 'wf':   return applyWasteToFoundation(state);
    case 'tt':   return applyTableauToTableau(state, move.fromCol, move.fromIdx, move.toCol);
    case 'tf':   return applyTableauToFoundation(state, move.fromCol);
    case 'ft':   return applyFoundationToTableau(state, move.fi, move.toCol);
    default:     return state;
  }
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Build the complete list of board states for a replay.
 *
 * @param {number[]} cards     52-card deal order (from ReplayResponse.cards)
 * @param {object[]} moves     Parsed move list (from ReplayResponse.moves)
 * @param {string}   drawMode  "draw1" | "draw3"
 * @returns {object[]} Array of board states, length = moves.length + 1
 *   Index 0  = initial deal
 *   Index N  = state after move N-1
 */
export function buildReplayStates(cards, moves, drawMode = 'draw3') {
  const initial = { ...dealKlondike(cards), drawMode };
  const states  = [initial];

  for (const move of moves) {
    const prev = states[states.length - 1];
    const next = applyMove(prev, move);
    states.push(next);
  }
  return states;
}

/**
 * Return a human-readable description for a move, including the card name.
 *
 * @param {object|null} move        The ReplayMove for step N (null for initial)
 * @param {object|null} prevState   Board state BEFORE the move was applied
 */
export function describeMove(move, prevState) {
  if (!move || !prevState) return 'Initial position';

  const cardName = (cardId) => {
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
      const top = prevState.waste[prevState.waste.length - 1];
      return `${cardName(top?.card)} → Column ${move.col + 1}`;
    }
    case 'wf': {
      const top = prevState.waste[prevState.waste.length - 1];
      return `${cardName(top?.card)} → Foundation`;
    }
    case 'tt': {
      const pile = prevState.tableau[move.fromCol];
      const idx  = move.fromIdx ?? pile.findIndex(c => c.faceUp);
      const card = pile[idx] ? cardName(pile[idx].card) : '';
      return `${card} → Column ${move.toCol + 1}`;
    }
    case 'tf': {
      const pile = prevState.tableau[move.fromCol];
      const card = pile.length ? cardName(pile[pile.length - 1].card) : '';
      return `${card} → Foundation`;
    }
    case 'ft': {
      const f    = prevState.foundations[move.fi];
      const card = f.length ? cardName(f[f.length - 1]) : '';
      return `${card} → Column ${move.toCol + 1}`;
    }
    default:
      return move.type;
  }
}
