// Card encoding: 1-13 = Clubs, 14-26 = Diamonds, 27-39 = Hearts, 40-52 = Spades
// (Matches server-side suit order: clubs, diamonds, hearts, spades)
// Within each suit: 1=Ace, 2-10, 11=Jack, 12=Queen, 13=King

export interface SuitInfo {
  range: [number, number];
  color: 'black' | 'red';
  symbol: string;
  name: 'clubs' | 'diamonds' | 'hearts' | 'spades';
}

export interface CardInPile {
  card: number;
  faceUp: boolean;
}

export interface BoardState {
  tableau: CardInPile[][];
  stock: CardInPile[];
  waste: CardInPile[];
  foundations: number[][];
}

export const SUITS: Record<string, SuitInfo> = {
  CLUBS:    { range: [1,  13], color: 'black', symbol: '♣', name: 'clubs' },
  DIAMONDS: { range: [14, 26], color: 'red',   symbol: '♦', name: 'diamonds' },
  HEARTS:   { range: [27, 39], color: 'red',   symbol: '♥', name: 'hearts' },
  SPADES:   { range: [40, 52], color: 'black', symbol: '♠', name: 'spades' },
};

export const getSuit = (card: number): SuitInfo => {
  if (card >= 1  && card <= 13) return SUITS.CLUBS;
  if (card >= 14 && card <= 26) return SUITS.DIAMONDS;
  if (card >= 27 && card <= 39) return SUITS.HEARTS;
  if (card >= 40 && card <= 52) return SUITS.SPADES;
  return SUITS.CLUBS; // fallback (should never happen with valid card IDs)
};

export const getRank = (card: number): number => {
  if (card >= 1  && card <= 13) return card;
  if (card >= 14 && card <= 26) return card - 13;
  if (card >= 27 && card <= 39) return card - 26;
  if (card >= 40 && card <= 52) return card - 39;
  return 0;
};

export const getColor = (card: number): 'black' | 'red' => getSuit(card).color;

export const RANK_LABELS: Record<number, string> = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
export const rankLabel = (rank: number): string => RANK_LABELS[rank] ?? String(rank);

// Foundation index for server-side suit order (clubs=0 diamonds=1 hearts=2 spades=3)
export const foundationIndex = (card: number): number => {
  const name = getSuit(card).name;
  return ['clubs', 'diamonds', 'hearts', 'spades'].indexOf(name);
};

// Deal Klondike layout from a 52-card array returned by the server.
// Returns { tableau, stock, waste, foundations }
export const dealKlondike = (cardArray: number[]): BoardState => {
  const cards = [...cardArray];
  const tableau: CardInPile[][] = [];

  for (let i = 0; i < 7; i++) {
    const pile: CardInPile[] = [];
    for (let j = 0; j <= i; j++) {
      pile.push({ card: cards.shift()!, faceUp: j === i });
    }
    tableau.push(pile);
  }

  // Remaining 24 cards → stock (first element = top of draw pile)
  const stock: CardInPile[] = cards.map(card => ({ card, faceUp: false }));

  return {
    tableau,
    stock,
    waste: [],
    foundations: [[], [], [], []], // clubs, diamonds, hearts, spades
  };
};

export const canPlaceOnTableau = (card: number, targetPile: CardInPile[]): boolean => {
  if (targetPile.length === 0) return getRank(card) === 13;
  const top = targetPile[targetPile.length - 1];
  if (!top.faceUp) return false;
  return getRank(card) === getRank(top.card) - 1 && getColor(card) !== getColor(top.card);
};

export const canPlaceOnFoundation = (card: number, foundationPile: number[]): boolean => {
  const rank = getRank(card);
  if (foundationPile.length === 0) return rank === 1;
  const top = foundationPile[foundationPile.length - 1];
  return getSuit(card).name === getSuit(top).name && rank === getRank(top) + 1;
};

export const isGameWon = (foundations: number[][]): boolean =>
  foundations.every(p => p.length === 13);
