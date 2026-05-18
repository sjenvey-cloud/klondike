import Foundation

/// Full Klondike solitaire game state.
///
/// This is a pure value type — mutations return a new `GameState` (or mutate in-place
/// depending on call site). The `GameStore` `@Observable` wraps this and publishes changes.
///
/// Move recording: every legal move appends a token to `turns` in the same format
/// accepted by the Spring Boot replay validator:
///   draw, wt:col, wf, tt:fromCol:fromIdx:toCol, tf:col, ft:foundationIdx:toCol
struct GameState {

    // MARK: - Board state

    var stock:     [Card]         // remaining draw pile, face down
    var waste:     [Card]         // drawn cards, face up (top = last)
    var tableau:   [[Card]]       // 7 columns; top of each = last element
    var foundation: [Card?]       // 4 slots (one per suit); nil = empty

    // MARK: - Game metadata

    let seed:     Int64
    let drawMode: String   // "draw1" | "draw3"
    var drawCount: Int { drawMode == "draw1" ? 1 : 3 }

    var turns:     String = ""    // comma-separated move tokens
    var moveCount: Int    = 0
    var isNew:     Bool   = true  // true until first move

    // MARK: - History (undo)

    private(set) var history: [GameState] = []  // snapshots for undo

    // MARK: - Init from seed

    init(seed: Int64, drawMode: String) {
        self.seed     = seed
        self.drawMode = drawMode

        let cards = SeededShuffle.deal(seed: seed)
        // Deal tableau: column i gets (i+1) cards, last is face up
        var idx = 0
        var cols = [[Card]]()
        for col in 0..<7 {
            var column = Array(cards[idx ..< idx + col + 1])
            for j in 0..<column.count { column[j].isFaceUp = (j == column.count - 1) }
            cols.append(column)
            idx += col + 1
        }
        self.tableau    = cols
        // Stock top = cards[idx] (first card drawn), matching Java's poll() order.
        // Swift uses removeLast() for O(1) pops, so the array is stored reversed:
        // stock.last is drawn first, stock.first is drawn last.
        self.stock      = Array(cards[idx...].reversed()).map { var c = $0; c.isFaceUp = false; return c }
        self.waste      = []
        self.foundation = [nil, nil, nil, nil]
    }

    // MARK: - Win detection

    var isWon: Bool {
        foundation.compactMap { $0 }.filter { $0.rank == .king }.count == 4
    }

    // MARK: - Waste top

    var wasteTop: Card? { waste.last }

    // MARK: - Move: Draw

    mutating func draw() {
        saveHistory()
        if stock.isEmpty {
            // Flip waste back to stock
            stock = waste.reversed().map { var c = $0; c.isFaceUp = false; return c }
            waste = []
        } else {
            let count = min(drawCount, stock.count)
            for _ in 0..<count {
                var card = stock.removeLast()
                card.isFaceUp = true
                waste.append(card)
            }
        }
        appendTurn("draw")
    }

    // MARK: - Move: Waste → Tableau

    @discardableResult
    mutating func moveWasteToTableau(col: Int) -> Bool {
        guard let card = waste.last,
              canPlaceOnTableau(card, column: col) else { return false }
        saveHistory()
        waste.removeLast()
        tableau[col].append(card)
        appendTurn("wt:\(col)")
        return true
    }

    // MARK: - Move: Waste → Foundation

    @discardableResult
    mutating func moveWasteToFoundation() -> Bool {
        guard let card = waste.last,
              let slot = foundationSlot(for: card) else { return false }
        saveHistory()
        waste.removeLast()
        foundation[slot] = card
        appendTurn("wf")
        return true
    }

    // MARK: - Move: Tableau → Foundation

    @discardableResult
    mutating func moveTableauToFoundation(col: Int) -> Bool {
        guard let card = tableau[col].last,
              let slot = foundationSlot(for: card) else { return false }
        saveHistory()
        tableau[col].removeLast()
        flipTopIfNeeded(col: col)
        foundation[slot] = card
        appendTurn("tf:\(col)")
        return true
    }

    // MARK: - Move: Tableau → Tableau

    @discardableResult
    mutating func moveTableau(fromCol: Int, fromIdx: Int, toCol: Int) -> Bool {
        guard fromCol != toCol,
              fromIdx < tableau[fromCol].count else { return false }
        let stack = Array(tableau[fromCol][fromIdx...])
        guard let top = stack.first,
              canPlaceOnTableau(top, column: toCol) else { return false }
        saveHistory()
        tableau[fromCol].removeSubrange(fromIdx...)
        flipTopIfNeeded(col: fromCol)
        tableau[toCol].append(contentsOf: stack)
        appendTurn("tt:\(fromCol):\(fromIdx):\(toCol)")
        return true
    }

    // MARK: - Move: Foundation → Tableau

    @discardableResult
    mutating func moveFoundationToTableau(foundationIdx: Int, toCol: Int) -> Bool {
        guard let card = foundation[foundationIdx],
              canPlaceOnTableau(card, column: toCol) else { return false }
        saveHistory()
        foundation[foundationIdx] = previousFoundationCard(suitIndex: foundationIdx)
        tableau[toCol].append(card)
        appendTurn("ft:\(foundationIdx):\(toCol)")
        return true
    }

    // MARK: - Replay

    /// Replay a comma-separated turns string produced by the Python/Java solver.
    ///
    /// Mirrors `GameState.replay()` in the Spring Boot backend (GameState.java)
    /// so that any valid server-side turns string also validates here.
    ///
    /// - Returns: `true` if all tokens applied without error, `false` on the
    ///   first invalid move (with `errorMessage` set on the returned copy).
    @discardableResult
    mutating func replay(turns: String) -> Bool {
        guard !turns.isEmpty else { return false }
        for token in turns.split(separator: ",").map(String.init) {
            let parts = token.split(separator: ":").map(String.init)
            guard !parts.isEmpty else { continue }
            var ok = false
            switch parts[0] {
            case "draw":
                draw()
                ok = true
            case "wf":
                ok = moveWasteToFoundation()
            case "wt":
                if parts.count >= 2, let col = Int(parts[1]) {
                    ok = moveWasteToTableau(col: col)
                }
            case "tf":
                if parts.count >= 2, let col = Int(parts[1]) {
                    ok = moveTableauToFoundation(col: col)
                }
            case "tt":
                if parts.count >= 4,
                   let from = Int(parts[1]),
                   let fi   = Int(parts[2]),
                   let to   = Int(parts[3]) {
                    ok = moveTableau(fromCol: from, fromIdx: fi, toCol: to)
                }
            case "ft":
                if parts.count >= 3,
                   let fi  = Int(parts[1]),
                   let col = Int(parts[2]) {
                    ok = moveFoundationToTableau(foundationIdx: fi, toCol: col)
                }
            default:
                break
            }
            if !ok { return false }
        }
        return true
    }

    // MARK: - Undo

    mutating func undo() {
        guard !history.isEmpty else { return }
        let prev = history.removeLast()
        // Restore board without clobbering the history array itself
        stock       = prev.stock
        waste       = prev.waste
        tableau     = prev.tableau
        foundation  = prev.foundation
        turns       = prev.turns
        moveCount   = prev.moveCount
    }

    // MARK: - Auto-complete eligibility

    /// True when all remaining cards are face up (no hidden tableau cards).
    var canAutoComplete: Bool {
        !isWon && stock.isEmpty && waste.isEmpty &&
        tableau.allSatisfy { col in col.allSatisfy { $0.isFaceUp } }
    }

    // MARK: - Private helpers

    private mutating func saveHistory() {
        var snapshot = self
        snapshot.history = []   // don't nest history snapshots
        history.append(snapshot)
        if history.count > 100 { history.removeFirst() }  // cap memory
        isNew = false
    }

    private mutating func appendTurn(_ token: String) {
        turns = turns.isEmpty ? token : "\(turns),\(token)"
        moveCount += 1
    }

    private mutating func flipTopIfNeeded(col: Int) {
        guard !tableau[col].isEmpty,
              !tableau[col][tableau[col].count - 1].isFaceUp else { return }
        tableau[col][tableau[col].count - 1].isFaceUp = true
    }

    private func canPlaceOnTableau(_ card: Card, column: Int) -> Bool {
        if let top = tableau[column].last {
            return card.canStackOnTableau(top)
        }
        return card.rank == .king  // empty column accepts only Kings
    }

    private func foundationSlot(for card: Card) -> Int? {
        let slot = card.suit.rawValue
        if let top = foundation[slot] {
            return card.rank.rawValue == top.rank.rawValue + 1 ? slot : nil
        }
        return card.rank == .ace ? slot : nil
    }

    private func previousFoundationCard(suitIndex: Int) -> Card? {
        guard let current = foundation[suitIndex],
              current.rank != .ace else { return nil }
        let prevId = current.id - 1
        return Card(id: prevId, isFaceUp: true)
    }
}
