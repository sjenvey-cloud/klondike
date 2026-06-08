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
                        onStockTap: { store.draw() }
                    )
                } else {
                    StockWasteView(
                        store: store,
                        cardWidth: cardWidth,
                        stockOnRight: false,
                        onWasteTap: { autoMoveWaste() },
                        onStockTap: { store.draw() }
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
        if store.moveWasteToFoundation() { return }
        for col in 0..<7 {
            if store.moveWasteToTableau(col: col) { return }
        }
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
        if isBottomCard, store.moveTableauToFoundation(col: col) { return }

        // Scan tableau columns left → right, skip source
        for toCol in 0..<7 where toCol != col {
            if store.moveTableau(fromCol: col, fromIdx: idx, toCol: toCol) { return }
        }
    }

    // MARK: - Auto-move: Foundation → Tableau

    /// Scans tableau columns left → right for the first legal landing spot.
    private func autoMoveFoundation(slot: Int) {
        guard store.state?.foundation[slot] != nil else { return }
        for col in 0..<7 {
            if store.moveFoundationToTableau(foundationIdx: slot, toCol: col) { return }
        }
    }
}
