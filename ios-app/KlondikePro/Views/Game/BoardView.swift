import SwiftUI

// MARK: - BoardView

/// Core interaction view.
///
/// Single-tap UX: tapping any face-up card immediately auto-moves it to the
/// best legal destination without requiring a second "drop" tap.
///
/// Priority order:
///   1. Foundation (single bottom-of-column card or waste top only)
///   2. Tableau columns left → right (skipping source column)
///   Foundation cards tap back to the first legal tableau column.
struct BoardView: View {

    let store: GameStore
    let cardWidth: CGFloat

    @Environment(PreferencesStore.self) private var prefs

    // Auto-complete modal state (DEV — shared web/iOS behaviour).
    @State private var showAutoComplete = false
    @State private var autoOffered = false

    private var stockOnRight: Bool { prefs.preferences.stockSide == "right" }

    // DEV-316: the board's natural width (7 columns + inter-column gaps + the
    // .horizontal,16 padding on each row). Used to centre the board on wide
    // screens (iPad / landscape) instead of stretching the top row to the edges.
    private var boardWidth: CGFloat {
        let columnSpacing = max(2, cardWidth * 0.1)
        return cardWidth * 7 + columnSpacing * 6 + 32
    }

    var body: some View {
        VStack(spacing: 8) {
            // Top row: stock/waste and foundations — order driven by stockSide preference
            HStack(alignment: .top) {
                if stockOnRight {
                    FoundationView(
                        foundation: store.state?.foundation ?? [nil, nil, nil, nil],
                        cardWidth: cardWidth,
                        onTap: { slot in autoMoveFoundation(slot: slot) }
                    )
                    Spacer()
                    StockWasteView(
                        store: store,
                        cardWidth: cardWidth,
                        stockOnRight: true,
                        onWasteTap: { autoMoveWaste() },
                        onStockTap: { store.draw(); Haptics.draw() }
                    )
                } else {
                    StockWasteView(
                        store: store,
                        cardWidth: cardWidth,
                        stockOnRight: false,
                        onWasteTap: { autoMoveWaste() },
                        onStockTap: { store.draw(); Haptics.draw() }
                    )
                    Spacer()
                    FoundationView(
                        foundation: store.state?.foundation ?? [nil, nil, nil, nil],
                        cardWidth: cardWidth,
                        onTap: { slot in autoMoveFoundation(slot: slot) }
                    )
                }
            }
            .padding(.horizontal, 16)

            // Tableau
            ScrollView {
                TableauView(
                    columns: store.state?.tableau ?? Array(repeating: [], count: 7),
                    cardWidth: cardWidth,
                    onTap: { col, idx in autoMoveTableau(col: col, idx: idx) }
                )
                .padding(.horizontal, 16)
                .padding(.bottom, 24)
            }
        }
        // DEV-316: cap the board to its natural width and centre it, so on iPad /
        // landscape the top row doesn't stretch to the screen edges.
        .frame(maxWidth: boardWidth)
        .frame(maxWidth: .infinity)
        // Auto-complete modal — pops once the board is cleared and the deck is
        // down to its face-up cards. Shared canonical behaviour with the web.
        .onChange(of: store.canAutoComplete) { _, can in
            if can && !autoOffered && !store.isAutoCompleting {
                autoOffered = true
                showAutoComplete = true
            } else if !can && !store.isAutoCompleting {
                autoOffered = false   // left the end-state; allow a fresh prompt later
            }
        }
        .alert("Board Cleared!", isPresented: $showAutoComplete) {
            Button("Auto-Complete") { Task { await store.autoComplete() } }
            Button("Keep Playing", role: .cancel) { }
        } message: {
            Text("All piles are clear — auto-complete the remaining cards?")
        }
    }

    // MARK: - Auto-move: Waste top card

    /// Foundation first, then tableau left → right.
    private func autoMoveWaste() {
        guard store.state?.wasteTop != nil else { return }
        if store.moveWasteToFoundation() { Haptics.move(); return }
        for col in 0..<7 {
            if store.moveWasteToTableau(col: col) { Haptics.move(); return }
        }
        Haptics.invalid()   // DEV-340: tapped a card with no legal destination
    }

    // MARK: - Auto-move: Tableau card or stack

    /// - Single bottom card: foundation first, then tableau L→R.
    /// - Sub-stack from the middle: tableau L→R only (stacks cannot go to foundation).
    /// - Face-down cards: ignored.
    private func autoMoveTableau(col: Int, idx: Int) {
        guard let state = store.state else { return }
        guard idx < state.tableau[col].count else { return }
        guard state.tableau[col][idx].isFaceUp else { return }

        let isBottomCard = (idx == state.tableau[col].count - 1)

        // Foundation has priority for the bottom (top-of-column) card
        if isBottomCard, store.moveTableauToFoundation(col: col) { Haptics.move(); return }

        // Scan tableau columns left → right, skip source
        for toCol in 0..<7 where toCol != col {
            if store.moveTableau(fromCol: col, fromIdx: idx, toCol: toCol) { Haptics.move(); return }
        }
        Haptics.invalid()   // DEV-340: no legal destination for this card/stack
    }

    // MARK: - Auto-move: Foundation → Tableau

    /// Scans tableau columns left → right for the first legal landing spot.
    private func autoMoveFoundation(slot: Int) {
        guard store.state?.foundation[slot] != nil else { return }
        for col in 0..<7 {
            if store.moveFoundationToTableau(foundationIdx: slot, toCol: col) { Haptics.move(); return }
        }
        Haptics.invalid()   // DEV-340: foundation card can't return to any column
    }
}
