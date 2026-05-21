import SwiftUI

// MARK: - CardSource

/// Identifies where a selected card (or stack of cards) came from.
enum CardSource: Equatable {
    case waste
    case tableau(col: Int, fromIdx: Int)
    case foundation(slot: Int)
}

// MARK: - BoardView

/// Core interaction view: wires tap handlers and manages selection state.
struct BoardView: View {

    let store: GameStore
    let cardWidth: CGFloat
    @State private var selected: CardSource? = nil

    var body: some View {
        VStack(spacing: 8) {
            // Top row: stock/waste on the left, foundations on the right
            HStack(alignment: .top) {
                StockWasteView(
                    store: store,
                    cardWidth: cardWidth,
                    onWasteTap: { handleWasteTap() },
                    onStockTap: { store.draw(); selected = nil }
                )
                Spacer()
                FoundationView(
                    foundation: store.state?.foundation ?? [nil, nil, nil, nil],
                    cardWidth: cardWidth,
                    onTap: { slot in handleFoundationTap(slot: slot) }
                )
            }
            .padding(.horizontal, 16)

            // Tableau
            ScrollView {
                TableauView(
                    columns: store.state?.tableau ?? Array(repeating: [], count: 7),
                    cardWidth: cardWidth,
                    selected: selected,
                    onTap: { col, idx in handleTableauTap(col: col, idx: idx) },
                    onColumnTap: { col in handleColumnTap(col: col) }
                )
                .padding(.horizontal, 16)
                .padding(.bottom, 24)
            }
        }
    }

    // MARK: - Tap Handlers

    private func handleWasteTap() {
        guard let state = store.state, state.wasteTop != nil else { return }
        switch selected {
        case .waste:
            selected = nil  // deselect
        case .some:
            selected = .waste  // switch selection to waste
        case nil:
            selected = .waste
        }
    }

    private func handleFoundationTap(slot: Int) {
        switch selected {
        case .waste:
            if store.moveWasteToFoundation() { selected = nil }
        case .tableau(let col, _):
            if store.moveTableauToFoundation(col: col) { selected = nil }
        case .foundation:
            selected = .foundation(slot: slot)  // switch foundation selection
        case nil:
            if store.state?.foundation[slot] != nil {
                selected = .foundation(slot: slot)
            }
        }
    }

    private func handleTableauTap(col: Int, idx: Int) {
        guard let state = store.state else { return }
        guard idx < state.tableau[col].count else { return }
        let card = state.tableau[col][idx]

        switch selected {
        case .waste:
            if store.moveWasteToTableau(col: col) {
                selected = nil
            } else {
                selected = card.isFaceUp ? .tableau(col: col, fromIdx: idx) : nil
            }
        case .tableau(let fromCol, let fromIdx):
            if store.moveTableau(fromCol: fromCol, fromIdx: fromIdx, toCol: col) {
                selected = nil
            } else if card.isFaceUp {
                selected = .tableau(col: col, fromIdx: idx)
            } else {
                selected = nil
            }
        case .foundation(let slot):
            if store.moveFoundationToTableau(foundationIdx: slot, toCol: col) {
                selected = nil
            } else if card.isFaceUp {
                selected = .tableau(col: col, fromIdx: idx)
            }
        case nil:
            if card.isFaceUp {
                selected = .tableau(col: col, fromIdx: idx)
            }
        }
    }

    private func handleColumnTap(col: Int) {
        switch selected {
        case .waste:
            if store.moveWasteToTableau(col: col) { selected = nil }
        case .tableau(let fromCol, let fromIdx):
            if store.moveTableau(fromCol: fromCol, fromIdx: fromIdx, toCol: col) { selected = nil }
        case .foundation(let slot):
            if store.moveFoundationToTableau(foundationIdx: slot, toCol: col) { selected = nil }
        case nil:
            break
        }
    }
}
