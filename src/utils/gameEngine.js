// ── Card constants ────────────────────────────────────
export const SUITS = ['clubs', 'diamonds', 'hearts', 'spades'];
export const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const RED_SUITS = ['diamonds', 'hearts'];
export const BLACK_SUITS = ['clubs', 'spades'];

// Card ID: 1–52 maps to suit/value
// 1–13: clubs A–K, 14–26: diamonds A–K, 27–39: hearts A–K, 40–52: spades A–K
export const cardFromId = (id) => {
  const idx = id - 1;
  const suit = SUITS[Math.floor(idx / 13)];
  const value = VALUES[idx % 13];
  const rank = (idx % 13) + 1; // 1 = Ace, 13 = King
  return { id, suit, value, rank, faceUp: false };
};

export const isRed = (card) => RED_SUITS.includes(card.suit);
export const isBlack = (card) => BLACK_SUITS.includes(card.suit);

// ── Build initial game state from ordered card IDs ────
// drawCount: 1 (1-card draw) or 3 (3-card draw, default per spec)
export const buildGameState = (cardIds, drawCount = 3) => {
  const cards = cardIds.map(cardFromId);

  // Deal tableau: 7 piles, top card face up
  const tableau = [];
  let idx = 0;
  for (let i = 0; i < 7; i++) {
    const pile = [];
    for (let j = 0; j <= i; j++) {
      pile.push({ ...cards[idx], faceUp: j === i });
      idx++;
    }
    tableau.push(pile);
  }

  // Remaining 24 cards go to stock, all face down
  const stock = cards.slice(idx).map(c => ({ ...c, faceUp: false }));

  return {
    tableau,
    foundations: [[], [], [], []], // clubs, diamonds, hearts, spades
    stock,
    waste: [],
    drawCount,
  };
};

// ── Move validation ───────────────────────────────────

// Can a card be placed on a tableau pile?
export const canPlaceOnTableau = (card, pile) => {
  if (pile.length === 0) return card.rank === 13; // Only Kings on empty pile
  const top = pile[pile.length - 1];
  if (!top.faceUp) return false;
  return top.rank === card.rank + 1 && isRed(top) !== isRed(card);
};

// Can a card be placed on a foundation?
export const canPlaceOnFoundation = (card, foundation) => {
  if (foundation.length === 0) return card.rank === 1; // Ace starts foundation
  const top = foundation[foundation.length - 1];
  return top.suit === card.suit && top.rank === card.rank - 1;
};

// ── Win condition ─────────────────────────────────────
export const isGameWon = (foundations) =>
  foundations.every(f => f.length === 13);

// ── Draw from stock (DEV-15, DEV-58) ─────────────────
// Supports 1-card and 3-card draw modes.
// When stock is empty, flips waste back to stock face-down.
export const applyDrawStock = (state) => {
  let { stock, waste, drawCount } = state;

  if (stock.length === 0) {
    // Flip entire waste pile back to stock
    stock = [...waste].reverse().map(c => ({ ...c, faceUp: false }));
    waste = [];
  } else {
    const count = Math.min(drawCount, stock.length);
    const drawn = stock.slice(0, count).map(c => ({ ...c, faceUp: true }));
    stock = stock.slice(count);
    waste = [...waste, ...drawn];
  }

  return { ...state, stock, waste };
};

// ── Deep clone state snapshot (for undo) ─────────────
export const cloneState = (state) => JSON.parse(JSON.stringify(state));

// ── Move type labels (for server-side replay, DEV-59) ─
export const MOVE_TYPES = {
  DRAW_STOCK:          'draw',
  WASTE_TO_TABLEAU:    'wt',
  WASTE_TO_FOUNDATION: 'wf',
  TABLEAU_TO_TABLEAU:  'tt',
  TABLEAU_TO_FOUNDATION: 'tf',
  ABANDON:             'abandon',
};
