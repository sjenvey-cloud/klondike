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
    /// Horizontal margin each side (set by GameView to fill the width symmetrically).
    var sideMargin: CGFloat = 16

    @Environment(PreferencesStore.self) private var prefs

    // Auto-complete modal state (DEV — shared web/iOS behaviour).
    @State private var showAutoComplete = false
    @State private var autoOffered = false

    // Custom drag (always-on-top, instant) — replaces SwiftUI .draggable.
    @State private var dragModel = BoardDragModel()

    private var stockOnRight: Bool { prefs.preferences.stockSide == "right" }

    var body: some View {
        VStack(spacing: 8) {
            // Top row: stock/waste and foundations — order driven by stockSide preference
            HStack(alignment: .top) {
                if stockOnRight {
                    FoundationView(
                        foundation: store.state?.foundation ?? [nil, nil, nil, nil],
                        cardWidth: cardWidth,
                        dragModel: dragModel,
                        onTap: { slot in autoMoveFoundation(slot: slot) }
                    )
                    Spacer()
                    StockWasteView(
                        store: store,
                        cardWidth: cardWidth,
                        stockOnRight: true,
                        dragModel: dragModel,
                        onWasteTap: { autoMoveWaste() },
                        onStockTap: { store.draw(); Haptics.draw() }
                    )
                } else {
                    StockWasteView(
                        store: store,
                        cardWidth: cardWidth,
                        stockOnRight: false,
                        dragModel: dragModel,
                        onWasteTap: { autoMoveWaste() },
                        onStockTap: { store.draw(); Haptics.draw() }
                    )
                    Spacer()
                    FoundationView(
                        foundation: store.state?.foundation ?? [nil, nil, nil, nil],
                        cardWidth: cardWidth,
                        dragModel: dragModel,
                        onTap: { slot in autoMoveFoundation(slot: slot) }
                    )
                }
            }
            .padding(.horizontal, sideMargin)

            // Tableau
            ScrollView {
                TableauView(
                    columns: store.state?.tableau ?? Array(repeating: [], count: 7),
                    cardWidth: cardWidth,
                    dragModel: dragModel,
                    onTap: { col, idx in autoMoveTableau(col: col, idx: idx) }
                )
                .padding(.horizontal, sideMargin)
                .padding(.bottom, 24)
            }
        }
        // Fill the available width (GameView sizes cardWidth + sideMargin to do so);
        // centre within the frame.
        .frame(maxWidth: .infinity)
        // Custom drag: a coordinate space the gestures + drop zones share, the lifted
        // card(s) rendered on top following the finger, and drop resolution.
        .coordinateSpace(name: BoardSpace.name)
        .onPreferenceChange(DropZonePreferenceKey.self) { dragModel.dropZones = $0 }
        .overlay {
            if dragModel.isDragging {
                DraggedStack(cards: dragModel.cards, cardWidth: dragModel.cardWidth)
                    .position(dragModel.location)
                    .allowsHitTesting(false)
            }
        }
        .onAppear {
            dragModel.onDrop = { src, target in
                switch target {
                case .column(let c):     _ = resolveDrop(CardMove(source: src), toColumn: c)
                case .foundation(let s): _ = resolveDrop(CardMove(source: src), toFoundation: s)
                }
            }
            dragModel.onMiss = { Haptics.invalid() }
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

    // MARK: - Drag-and-drop resolution (non-default moves)

    /// Resolve a card/sub-stack dropped on tableau column `col`. This is what lets a
    /// player make a specific move the left-to-right auto-move wouldn't pick — e.g.
    /// dropping a black 5 on the right-hand red 6 of two.
    private func resolveDrop(_ move: CardMove, toColumn col: Int) -> Bool {
        let ok: Bool
        switch move.source {
        case .waste:
            ok = store.moveWasteToTableau(col: col)
        case .tableau(let fromCol, let fromIdx):
            ok = fromCol == col ? false
                                : store.moveTableau(fromCol: fromCol, fromIdx: fromIdx, toCol: col)
        case .foundation(let slot):
            ok = store.moveFoundationToTableau(foundationIdx: slot, toCol: col)
        }
        if ok { Haptics.move() } else { Haptics.invalid() }
        return ok
    }

    /// Resolve a card dropped on a foundation slot. Foundation moves auto-route to the
    /// card's suit, so the exact slot dropped on need not match.
    private func resolveDrop(_ move: CardMove, toFoundation slot: Int) -> Bool {
        let ok: Bool
        switch move.source {
        case .waste:
            ok = store.moveWasteToFoundation()
        case .tableau(let fromCol, let fromIdx):
            // Only the bottom card of a column may go to a foundation.
            if let st = store.state, fromIdx == st.tableau[fromCol].count - 1 {
                ok = store.moveTableauToFoundation(col: fromCol)
            } else {
                ok = false
            }
        case .foundation:
            ok = false   // foundation → foundation is never a move
        }
        if ok { Haptics.move() } else { Haptics.invalid() }
        return ok
    }
}

// MARK: - Lifted card(s) overlay

/// The card (or tableau sub-stack) being dragged, rendered solid and on top of the
/// board, following the finger. Centred on the drag location.
private struct DraggedStack: View {
    let cards: [Card]
    let cardWidth: CGFloat

    private var step: CGFloat { cardWidth * 0.28 }

    var body: some View {
        ZStack(alignment: .top) {
            ForEach(Array(cards.enumerated()), id: \.offset) { i, card in
                CardView(card: card, width: cardWidth)
                    .offset(y: CGFloat(i) * step)
            }
        }
        .frame(width: cardWidth,
               height: cardWidth * 1.4 + CGFloat(max(0, cards.count - 1)) * step)
        .shadow(color: .black.opacity(0.35), radius: 8, y: 4)
    }
}
