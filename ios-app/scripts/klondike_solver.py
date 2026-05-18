#!/usr/bin/env python3
"""
Klondike Solitaire solver — mirrors Java GameState.java exactly.

Card IDs 1-52:
  1-13  = clubs    (suit 0)  A-K
  14-26 = diamonds (suit 1)  A-K
  27-39 = hearts   (suit 2)  A-K
  40-52 = spades   (suit 3)  A-K

Turns format (identical to Java GameState move tokens):
  draw                    - draw from stock (or flip waste when stock is empty)
  wt:<col>                - top waste card → tableau column (0-based)
  wf                      - top waste card → foundation
  tt:<from>:<fi>:<to>     - tableau stack from col[fi] → col to
  tf:<col>                - top of tableau col → foundation
  ft:<fi>:<col>           - top of foundation pile fi → tableau col
"""

import sys
from typing import Optional

# ---------------------------------------------------------------------------
# Card helpers
# ---------------------------------------------------------------------------

def rank(cid: int) -> int:
    """1 = Ace, 13 = King"""
    return ((cid - 1) % 13) + 1

def suit(cid: int) -> int:
    """0=clubs 1=diamonds 2=hearts 3=spades"""
    return (cid - 1) // 13

def is_red(cid: int) -> bool:
    return suit(cid) in (1, 2)  # diamonds, hearts

def card_id(suit_idx: int, r: int) -> int:
    """Reconstruct card ID from suit index and rank."""
    return suit_idx * 13 + r

def card_name(cid: int) -> str:
    vals = ['A','2','3','4','5','6','7','8','9','10','J','Q','K']
    suits = ['♣','♦','♥','♠']
    return f"{vals[rank(cid)-1]}{suits[suit(cid)]}"

# ---------------------------------------------------------------------------
# Seeded shuffle (xorshift32 + Fisher-Yates)
# Mirrors SeededShuffle.java exactly
# ---------------------------------------------------------------------------

def xorshift32(state: int) -> int:
    state = (state ^ ((state << 13) & 0xFFFFFFFF)) & 0xFFFFFFFF
    state = (state ^ (state >> 17)) & 0xFFFFFFFF   # unsigned right shift
    state = (state ^ ((state << 5) & 0xFFFFFFFF)) & 0xFFFFFFFF
    return state

def seeded_shuffle(seed: int) -> list:
    deck = list(range(1, 53))
    state = int(seed) & 0xFFFFFFFF
    for i in range(51, 0, -1):
        state = xorshift32(state)
        j = state % (i + 1)          # state already unsigned 32-bit
        deck[i], deck[j] = deck[j], deck[i]
    return deck

# ---------------------------------------------------------------------------
# Game state — mirrors Java GameState.java
#
# stock: list[int]  stock[0] = next card to draw (matches Java's deque front)
# waste: list[int]  waste[-1] = top (most recently drawn, playable)
# tab:   list[list[tuple(int,bool)]]  7 columns, each (card_id, face_up)
# found: list[int]  top rank per suit (0=empty, 13=complete)
#
# Flip behaviour (Java applyDraw when stock empty):
#   iterates waste from last→first, addFirst() each → stock front = waste[0]
#   In Python: self.stock = self.waste[:]  (pop(0) draws waste[0] first)
# ---------------------------------------------------------------------------

class Game:
    __slots__ = ('draw_count', 'tab', 'found', 'stock', 'waste', 'turns_list')

    def __init__(self, seed: int, draw_count: int = 1):
        self.draw_count = draw_count
        self.turns_list = []

        deck = seeded_shuffle(seed)

        # Deal tableau: column i has (i+1) cards, last is face-up
        self.tab = []
        idx = 0
        for i in range(7):
            col = [(deck[idx + j], j == i) for j in range(i + 1)]
            self.tab.append(col)
            idx += i + 1

        # Remaining 24 cards → stock; stock[0] drawn first (matches Java poll())
        self.stock = deck[idx:]
        self.waste = []
        self.found = [0, 0, 0, 0]   # clubs, diamonds, hearts, spades

    # -----------------------------------------------------------------------
    # Cloning
    # -----------------------------------------------------------------------

    def clone(self) -> 'Game':
        g = object.__new__(Game)
        g.draw_count  = self.draw_count
        g.turns_list  = self.turns_list[:]
        g.tab         = [col[:] for col in self.tab]
        g.found       = self.found[:]
        g.stock       = self.stock[:]
        g.waste       = self.waste[:]
        return g

    # -----------------------------------------------------------------------
    # State hash for cycle detection
    # -----------------------------------------------------------------------

    def state_key(self):
        return (
            tuple(tuple(col) for col in self.tab),
            tuple(self.found),
            tuple(self.stock),
            tuple(self.waste),
        )

    def stock_waste_key(self):
        """Lighter key — just stock+waste order, for cycle detection during draw loops."""
        return (tuple(self.stock), tuple(self.waste))

    # -----------------------------------------------------------------------
    # Win / progress metrics
    # -----------------------------------------------------------------------

    def is_won(self) -> bool:
        return all(f == 13 for f in self.found)

    def foundation_total(self) -> int:
        return sum(self.found)

    def hidden_total(self) -> int:
        """Number of face-down tableau cards remaining."""
        return sum(1 for col in self.tab for (_, up) in col if not up)

    def turns_string(self) -> str:
        return ",".join(self.turns_list)

    # -----------------------------------------------------------------------
    # Placement rules
    # -----------------------------------------------------------------------

    def can_on_tab(self, cid: int, col: int) -> bool:
        pile = self.tab[col]
        if not pile:
            return rank(cid) == 13
        top_id, top_up = pile[-1]
        return (top_up and
                rank(top_id) == rank(cid) + 1 and
                is_red(top_id) != is_red(cid))

    def can_on_found(self, cid: int) -> bool:
        fi = suit(cid)
        return self.found[fi] == rank(cid) - 1

    # -----------------------------------------------------------------------
    # Move application
    # -----------------------------------------------------------------------

    def do_draw(self):
        if not self.stock:
            # Flip: Java addFirst(waste[N])…addFirst(waste[0]) → front=waste[0]
            # Equivalent: stock = waste[:] (same order), pop(0) draws waste[0]
            self.stock = self.waste[:]
            self.waste = []
        else:
            n = min(self.draw_count, len(self.stock))
            for _ in range(n):
                self.waste.append(self.stock.pop(0))
        self.turns_list.append("draw")

    def do_wf(self):
        cid = self.waste[-1]
        self.waste.pop()
        self.found[suit(cid)] += 1
        self.turns_list.append("wf")

    def do_wt(self, col: int):
        cid = self.waste[-1]
        self.waste.pop()
        self.tab[col].append((cid, True))
        self.turns_list.append(f"wt:{col}")

    def do_tf(self, col: int):
        cid, _ = self.tab[col][-1]
        self.tab[col].pop()
        self.found[suit(cid)] += 1
        if self.tab[col]:
            c, _ = self.tab[col][-1]
            self.tab[col][-1] = (c, True)
        self.turns_list.append(f"tf:{col}")

    def do_tt(self, from_col: int, from_idx: int, to_col: int):
        moving = self.tab[from_col][from_idx:]
        self.tab[from_col] = self.tab[from_col][:from_idx]
        if self.tab[from_col]:
            c, _ = self.tab[from_col][-1]
            self.tab[from_col][-1] = (c, True)
        self.tab[to_col].extend(moving)
        self.turns_list.append(f"tt:{from_col}:{from_idx}:{to_col}")

    def do_ft(self, fi: int, col: int):
        r = self.found[fi]
        cid = card_id(fi, r)
        self.found[fi] -= 1
        self.tab[col].append((cid, True))
        self.turns_list.append(f"ft:{fi}:{col}")

    # -----------------------------------------------------------------------
    # Move generation — returns list of (priority, tag, apply_fn)
    # priority: lower = higher priority
    # -----------------------------------------------------------------------

    def all_moves(self) -> list:
        moves = []

        # Waste → foundation (priority 0)
        if self.waste:
            wc = self.waste[-1]
            if self.can_on_found(wc):
                moves.append((0, 'wf', lambda g: g.do_wf()))

        # Tableau → foundation (priority 0)
        for col in range(7):
            if self.tab[col]:
                cid, up = self.tab[col][-1]
                if up and self.can_on_found(cid):
                    moves.append((0, f'tf:{col}',
                                  (lambda c=col: lambda g: g.do_tf(c))()))

        # Tableau → tableau (priority depends on hidden cards uncovered)
        for fc in range(7):
            pile = self.tab[fc]
            fup = next((i for i, (_, up) in enumerate(pile) if up), -1)
            if fup < 0:
                continue
            n_hidden = fup  # face-down cards that would be flipped

            for tc in range(7):
                if tc == fc:
                    continue
                cid = pile[fup][0]
                if self.can_on_tab(cid, tc):
                    # Priority 1: uncovers hidden card(s)
                    # Priority 2: king to empty (no hidden uncovered)
                    # Priority 3: other (shuffle same face-up cards)
                    if n_hidden > 0:
                        pri = 1
                    elif not self.tab[tc]:  # empty column — king goes here
                        pri = 1
                    else:
                        pri = 3
                    moves.append((pri, f'tt:{fc}:{fup}:{tc}',
                                  (lambda f=fc, fi=fup, t=tc: lambda g: g.do_tt(f, fi, t))()))
                # Also try moving just the top card when it's different from the full stack
                if fup < len(pile) - 1:
                    top_idx = len(pile) - 1
                    top_cid = pile[top_idx][0]
                    if self.can_on_tab(top_cid, tc):
                        moves.append((3, f'tt:{fc}:{top_idx}:{tc}',
                                      (lambda f=fc, fi=top_idx, t=tc: lambda g: g.do_tt(f, fi, t))()))

        # Waste → tableau (priority 2)
        if self.waste:
            wc = self.waste[-1]
            for col in range(7):
                if self.can_on_tab(wc, col):
                    moves.append((2, f'wt:{col}',
                                  (lambda c=col: lambda g: g.do_wt(c))()))

        # Draw (priority 4 — last resort)
        if self.stock or self.waste:
            moves.append((4, 'draw', lambda g: g.do_draw()))

        moves.sort(key=lambda x: x[0])
        return moves

# ---------------------------------------------------------------------------
# Replay verifier — confirms a turns string is valid for a seed
# ---------------------------------------------------------------------------

def verify_turns(seed: int, turns_str: str, draw_count: int = 1) -> tuple:
    """Returns (is_won: bool, error: str or None, move_count: int)"""
    g = Game(seed, draw_count)
    if not turns_str:
        return (False, "Empty turns string", 0)

    tokens = turns_str.split(',')
    for i, tok in enumerate(tokens):
        tok = tok.strip()
        if not tok:
            continue

        parts = tok.split(':')
        ok = True
        try:
            if tok == 'draw':
                g.do_draw()
            elif tok == 'wf':
                if not g.waste:
                    return (False, f"Move {i+1}: wf but waste is empty", i)
                if not g.can_on_found(g.waste[-1]):
                    return (False, f"Move {i+1}: wf invalid — {card_name(g.waste[-1])} can't go to foundation", i)
                g.do_wf()
            elif parts[0] == 'wt':
                col = int(parts[1])
                if not g.waste:
                    return (False, f"Move {i+1}: wt but waste is empty", i)
                if not g.can_on_tab(g.waste[-1], col):
                    return (False, f"Move {i+1}: wt:{col} invalid", i)
                g.do_wt(col)
            elif parts[0] == 'tf':
                col = int(parts[1])
                if not g.tab[col]:
                    return (False, f"Move {i+1}: tf:{col} but col is empty", i)
                cid, up = g.tab[col][-1]
                if not up or not g.can_on_found(cid):
                    return (False, f"Move {i+1}: tf:{col} invalid", i)
                g.do_tf(col)
            elif parts[0] == 'tt':
                fc, fi, tc = int(parts[1]), int(parts[2]), int(parts[3])
                if fi >= len(g.tab[fc]):
                    return (False, f"Move {i+1}: tt:{fc}:{fi}:{tc} — fromIdx out of range", i)
                cid = g.tab[fc][fi][0]
                if not g.can_on_tab(cid, tc):
                    return (False, f"Move {i+1}: tt:{fc}:{fi}:{tc} invalid", i)
                g.do_tt(fc, fi, tc)
            elif parts[0] == 'ft':
                fi, col = int(parts[1]), int(parts[2])
                if g.found[fi] == 0:
                    return (False, f"Move {i+1}: ft:{fi}:{col} — foundation empty", i)
                cid = card_id(fi, g.found[fi])
                if not g.can_on_tab(cid, col):
                    return (False, f"Move {i+1}: ft:{fi}:{col} invalid", i)
                g.do_ft(fi, col)
            else:
                return (False, f"Move {i+1}: unknown token '{tok}'", i)
        except Exception as e:
            return (False, f"Move {i+1}: exception — {e}", i)

    won = g.is_won()
    return (won, None if won else "Game not won after all moves", len(tokens))

# ---------------------------------------------------------------------------
# Greedy solver — with lookahead to avoid cycling
# ---------------------------------------------------------------------------

def greedy_solve(seed: int, draw_count: int = 1,
                 move_order: list = None,
                 max_steps: int = 8000) -> Optional[str]:
    """
    Greedy solver with one-step lookahead to avoid revisiting states.

    On each step: sort moves by priority (optionally shuffling ties), then
    try each move in order and apply the FIRST one that leads to an
    unvisited state.  Stops when no such move exists.

    move_order is unused (kept for API compat); pass any value to enable
    Monte Carlo randomisation — seeded externally via random.seed().
    """
    import random as _rnd
    from itertools import groupby as _groupby

    g = Game(seed, draw_count)
    visited = set()

    for _ in range(max_steps):
        if g.is_won():
            return g.turns_string()

        cur_key = g.state_key()
        if cur_key in visited:
            break
        visited.add(cur_key)

        moves = g.all_moves()   # sorted by priority asc
        if not moves:
            break

        # Optionally shuffle within each priority group
        if move_order is not None:
            result = []
            for _, group in _groupby(moves, key=lambda x: x[0]):
                g_list = list(group)
                _rnd.shuffle(g_list)
                result.extend(g_list)
            moves = result

        # Apply the first move whose resulting state we haven't seen
        made_move = False
        for _, _, fn in moves:
            child = g.clone()
            fn(child)
            if child.state_key() not in visited:
                fn(g)       # apply to the real game
                made_move = True
                break

        if not made_move:
            break   # all moves lead to visited states — dead end

    return g.turns_string() if g.is_won() else None


def monte_carlo_solve(seed: int, draw_count: int = 1,
                      trials: int = 300) -> Optional[str]:
    """
    Run many greedy trials with different random tie-breaking.
    Returns the shortest winning turns string found, or None.
    """
    import random as _rnd
    best = None
    for trial in range(trials):
        _rnd.seed(trial)
        turns = greedy_solve(seed, draw_count, move_order=True)
        if turns is not None:
            n = turns.count(',') + 1
            if best is None or n < best[0]:
                best = (n, turns)
    return best[1] if best else None

# ---------------------------------------------------------------------------
# DFS solver with visited-state pruning
# ---------------------------------------------------------------------------

def dfs_solve(seed: int, draw_count: int = 1, max_depth: int = 500,
              max_visited: int = 300_000) -> Optional[str]:
    """DFS with full state hashing. Returns turns string or None."""
    root = Game(seed, draw_count)
    visited = set()

    def dfs(g: Game, depth: int) -> Optional[Game]:
        if g.is_won():
            return g
        if depth >= max_depth or len(visited) >= max_visited:
            return None
        key = g.state_key()
        if key in visited:
            return None
        visited.add(key)

        for _, _, fn in g.all_moves():
            child = g.clone()
            fn(child)
            result = dfs(child, depth + 1)
            if result is not None:
                return result
        return None

    result = dfs(root, 0)
    return result.turns_string() if result else None

# ---------------------------------------------------------------------------
# Main: scan seeds
# ---------------------------------------------------------------------------

def main():
    draw_count = 1
    scan_limit = 1000

    print(f"Scanning seeds 1–{scan_limit} (draw{draw_count}) for winnable games…",
          flush=True)

    winners = []

    # Phase 1: Monte Carlo greedy (many random tie-breaking orderings)
    for seed in range(1, scan_limit + 1):
        turns = monte_carlo_solve(seed, draw_count, trials=100)
        if turns is not None:
            n = turns.count(',') + 1
            winners.append((seed, turns, n))
            print(f"  ✅ MC seed {seed:5d}: {n} moves", flush=True)
            if len(winners) >= 5:
                break
        elif seed % 50 == 0:
            print(f"  … {seed}/{scan_limit} ({len(winners)} winners)", flush=True)

    # Phase 2: DFS fallback for first 30 seeds
    if not winners:
        print("\nMC greedy failed — running DFS on seeds 1-30…", flush=True)
        for seed in range(1, 31):
            turns = dfs_solve(seed, draw_count)
            if turns is not None:
                n = turns.count(',') + 1
                winners.append((seed, turns, n))
                print(f"  ✅ DFS seed {seed}: {n} moves", flush=True)
                break

    # Report best result
    if winners:
        # Pick the solution with fewest moves
        winners.sort(key=lambda x: x[2])
        seed, turns, n_moves = winners[0]

        # Verify
        ok, err, _ = verify_turns(seed, turns, draw_count)
        if not ok:
            print(f"\n❌ Verification FAILED for seed {seed}: {err}")
            return

        deck = seeded_shuffle(seed)
        first3 = deck[:3]

        print("\n" + "="*72)
        print("WINNING GAME — USE THESE VALUES IN SWIFT TESTS")
        print("="*72)
        print(f"Seed        : {seed}")
        print(f"Draw mode   : draw{draw_count}")
        print(f"Move count  : {n_moves}")
        print(f"Verified    : ✅ valid win")
        print(f"First 3 ids : {first3}   ({', '.join(card_name(c) for c in first3)})")
        print(f"All 52 ids  : {deck}")
        print(f"\nTurns string ({n_moves} tokens):")
        print(turns)
        print("="*72)
    else:
        print("\n❌ No winning game found in the scanned range.")

    # Always print the reference seed vectors
    ref_seed = 2029734459
    ref_deck = seeded_shuffle(ref_seed)
    print(f"\nReference seed {ref_seed}:")
    print(f"  First 3 : {ref_deck[:3]}  ({', '.join(card_name(c) for c in ref_deck[:3])})")
    print(f"  All 52  : {ref_deck}")

    # Additional seed vectors for SeededShuffleTests
    for s in [1, 2, 1000, 999999, 2000000000]:
        d = seeded_shuffle(s)
        print(f"\nSeed {s:12d}: {d[:3]} → {', '.join(card_name(c) for c in d[:3])}")
        print(f"  All: {d}")

if __name__ == '__main__':
    sys.setrecursionlimit(200_000)
    main()
