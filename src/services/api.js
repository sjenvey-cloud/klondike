const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

// ── User ──────────────────────────────────────────────
export const getUserByUsername = (username) =>
  fetch(`${BASE_URL}/user/username/${username}`).then(r => r.json());

export const createUser = (username) =>
  fetch(`${BASE_URL}/user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  }).then(r => r.json());

export const updateLastPlayed = (id) =>
  fetch(`${BASE_URL}/user/played`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  }).then(r => r.json());

// ── Deck ──────────────────────────────────────────────
export const shuffleDeck = () =>
  fetch(`${BASE_URL}/deck/shuffle`).then(r => r.json());

export const saveDeck = (cards) => {
  const body = {};
  cards.forEach((card, i) => { body[`card${i + 1}`] = card; });
  return fetch(`${BASE_URL}/deck`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => r.json());
};

export const checkDuplicate = (cards) => {
  const body = {};
  cards.forEach((card, i) => { body[`card${i + 1}`] = card; });
  return fetch(`${BASE_URL}/deck/isDupe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => r.json());
};

export const markDeckSolved = (id, description) =>
  fetch(`${BASE_URL}/deck/solved/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description }),
  }).then(r => r.json());

// ── Deal ──────────────────────────────────────────────
// status is optional — omit for solved, pass 'abandoned' for DEV-57
export const saveDeal = ({ moves, timeseconds, turns, deckid, userid, status }) =>
  fetch(`${BASE_URL}/deal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ moves, timeseconds, turns, deckid, userid, ...(status ? { status } : {}) }),
  }).then(r => r.json());

// DEV-57: explicit abandon endpoint (alias for saveDeal with status=abandoned)
export const abandonDeal = ({ moves, timeseconds, turns, deckid, userid }) =>
  saveDeal({ moves, timeseconds, turns, deckid, userid, status: 'abandoned' });

// DEV-59: server-side replay validation
export const validateDeal = ({ deckid, turns, claimedWon }) =>
  fetch(`${BASE_URL}/deal/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deckid: String(deckid),
      turns,
      claimedWon: String(claimedWon),
    }),
  }).then(r => r.json());

export const getHighscoresByMoves = (deckid, limit = 10) =>
  fetch(`${BASE_URL}/deal/highscores/deck/moves`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deckid, limit }),
  }).then(r => r.json());

export const getHighscoresByTime = (deckid, limit = 10) =>
  fetch(`${BASE_URL}/deal/highscores/deck/times`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deckid, limit }),
  }).then(r => r.json());

export const getUserHighscoresByMoves = (userid, limit = 10) =>
  fetch(`${BASE_URL}/deal/highscores/user/moves`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userid, limit }),
  }).then(r => r.json());
